import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
SEED_PATH = DATA_DIR / "event-candidates.json"
LOCAL_STATE_PATH = DATA_DIR / "runtime-events.json"
UPSTASH_URL = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "").strip()
UPSTASH_KEY = os.environ.get("SJDG_EVENTS_STORE_KEY", "sjdg:events:state:v1")


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize_event(event, index=0):
    return {
        "candidate_id": event.get("candidate_id") or f"cand_runtime_{int(datetime.now().timestamp())}_{index}",
        "source_id": event.get("source_id") or "manual-admin",
        "fetch_job_id": event.get("fetch_job_id") or "manual-admin",
        "post_id": event.get("post_id", "") or "",
        "posting_url": event.get("posting_url", "") or "",
        "source_url": event.get("source_url") or "/admin",
        "source_type": event.get("source_type") or "manual_entry",
        "collected_at": event.get("collected_at") or now_iso(),
        "raw_text": event.get("raw_text", "") or "",
        "media_urls": event.get("media_urls") if isinstance(event.get("media_urls"), list) else [],
        "title": event.get("title") or "Untitled event",
        "summary": event.get("summary", "") or "",
        "category": event.get("category") or "community",
        "start_date": event.get("start_date") or None,
        "end_date": event.get("end_date") or None,
        "start_time_text": event.get("start_time_text", "") or "",
        "timezone": event.get("timezone") or "America/Mexico_City",
        "venue_name": event.get("venue_name", "") or "",
        "venue_reference": event.get("venue_reference", "") or "",
        "location_scope": event.get("location_scope") or "town",
        "organizer_name": event.get("organizer_name", "") or "",
        "confidence_score": float(event.get("confidence_score", 1) or 1),
        "confidence_reasons": event.get("confidence_reasons") if isinstance(event.get("confidence_reasons"), list) else [],
        "duplicate_fingerprint": event.get("duplicate_fingerprint", "") or "",
        "review_status": event.get("review_status") or "pending",
        "review_notes": event.get("review_notes", "") or "",
    }


def seed_events():
    if not SEED_PATH.exists():
        return []
    payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    items = payload.get("candidates", []) if isinstance(payload, dict) else payload
    return [normalize_event(item, index) for index, item in enumerate(items)]


def default_state():
    updated_at = now_iso()
    if SEED_PATH.exists():
        payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        updated_at = payload.get("generated_at") or updated_at
    return {
        "version": 1,
        "updated_at": updated_at,
        "mode": "seed",
        "events": seed_events(),
    }


class LocalFileStore:
    mode = "local_file"

    def load(self):
        if not LOCAL_STATE_PATH.exists():
            return None
        payload = json.loads(LOCAL_STATE_PATH.read_text(encoding="utf-8"))
        payload["mode"] = self.mode
        payload["events"] = [normalize_event(item, index) for index, item in enumerate(payload.get("events", []))]
        return payload

    def save(self, events):
        payload = {
            "version": 1,
            "updated_at": now_iso(),
            "events": [normalize_event(item, index) for index, item in enumerate(events)],
        }
        LOCAL_STATE_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        payload["mode"] = self.mode
        return payload


class UpstashStore:
    mode = "upstash"

    def _command(self, command):
        request = urllib.request.Request(
            UPSTASH_URL,
            data=json.dumps(command).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {UPSTASH_TOKEN}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))

    def load(self):
        raw = self._command(["GET", UPSTASH_KEY])
        result = raw.get("result")
        if not result:
            return None
        payload = json.loads(result)
        payload["mode"] = self.mode
        payload["events"] = [normalize_event(item, index) for index, item in enumerate(payload.get("events", []))]
        return payload

    def save(self, events):
        payload = {
            "version": 1,
            "updated_at": now_iso(),
            "events": [normalize_event(item, index) for index, item in enumerate(events)],
        }
        self._command(["SET", UPSTASH_KEY, json.dumps(payload, ensure_ascii=False)])
        payload["mode"] = self.mode
        return payload


def get_store():
    if UPSTASH_URL and UPSTASH_TOKEN:
        return UpstashStore()
    return LocalFileStore()


def load_event_state():
    store = get_store()
    try:
        loaded = store.load()
        if loaded:
            return loaded
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError):
        pass
    payload = default_state()
    payload["mode"] = "seed"
    return payload


def prune_old_events(events, days=60):
    """Drop approved/rejected events whose start_date is more than `days` days in the past.
    Pending and needs_more_info candidates are always kept so nothing falls out of the queue.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    result = []
    for event in events:
        status = event.get("review_status", "")
        start_date = event.get("start_date") or ""
        if status in {"approved", "rejected"} and start_date and start_date < cutoff:
            continue
        result.append(event)
    return result


def save_event_state(events):
    store = get_store()
    return store.save(prune_old_events(events))
