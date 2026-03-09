#!/usr/bin/env python3

import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RAW_RECORDS_PATH = DATA_DIR / "raw-source-records.json"
REGISTRY_JS_PATH = DATA_DIR / "source-registry.js"
MANIFEST_JS_PATH = DATA_DIR / "fetch-manifest.js"
SCHEMA_JS_PATH = DATA_DIR / "event-candidate-schema.js"
CANDIDATES_JSON_PATH = DATA_DIR / "event-candidates.json"
CANDIDATES_JS_PATH = DATA_DIR / "event-candidates.js"

TOP_SOURCES = {
    "official-town-facebook",
    "fiestas-patronales-facebook",
    "casa-cultura-facebook",
}


def load_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def extract_single_quoted_values(text, field_name):
    pattern = re.compile(rf"{re.escape(field_name)}:\s*'([^']+)'")
    return pattern.findall(text)


def extract_required_fields(text):
    match = re.search(r"required:\s*\[(.*?)\]", text, re.DOTALL)
    if not match:
      return []
    return re.findall(r"'([^']+)'", match.group(1))


def parse_key_value_text(raw_text):
    result = {}
    for line in raw_text.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip().lower()] = value.strip()
    return result


def slugify(value):
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "unknown"


def compute_confidence(source_id, extracted):
    score = 0.35
    reasons = []

    if extracted.get("date"):
        score += 0.2
        reasons.append("found explicit date")
    if extracted.get("time") and "confirmar" not in extracted["time"].lower():
        score += 0.1
        reasons.append("found explicit time")
    if extracted.get("venue"):
        score += 0.1
        reasons.append("found venue")
    if extracted.get("organizer"):
        score += 0.05
        reasons.append("found organizer")
    if extracted.get("location_scope") == "town":
        score += 0.15
        reasons.append("matched town scope")
    if source_id in TOP_SOURCES:
        score += 0.1
        reasons.append("high-trust local source")
    if extracted.get("location_scope") in {"municipality", "out_of_scope"}:
        score -= 0.2
        reasons.append("outside town scope")
    if source_id in {"mayor-facebook", "for-sale-group", "ayuntamiento-tepatitlan"}:
        score -= 0.05
        reasons.append("requires stricter review")

    score = max(0.05, min(score, 0.99))
    return round(score, 2), reasons


def derive_status(extracted, confidence):
    scope = extracted.get("location_scope", "unknown")
    if scope in {"municipality", "out_of_scope"}:
        return "rejected"
    if not extracted.get("date") or not extracted.get("venue"):
        return "needs_more_info"
    if confidence >= 0.85 and scope == "town":
        return "approved"
    return "pending"


def build_candidate(raw_record):
    extracted = parse_key_value_text(raw_record["raw_text"])
    confidence, reasons = compute_confidence(raw_record["source_id"], extracted)
    title = extracted.get("title", "Untitled Event")
    venue_name = extracted.get("venue")
    start_date = extracted.get("date")
    start_time_text = extracted.get("time")
    duplicate_fingerprint = "|".join([
        slugify(title),
        start_date or "unknown-date",
        slugify(venue_name or extracted.get("venue_reference", "unknown-venue")),
    ])

    return {
        "candidate_id": f"cand_{raw_record['record_id']}",
        "source_id": raw_record["source_id"],
        "fetch_job_id": f"fetch-{raw_record['source_id']}",
        "post_id": raw_record.get("post_id", ""),
        "posting_url": raw_record.get("posting_url", ""),
        "source_url": raw_record["source_url"],
        "source_type": raw_record["source_type"],
        "collected_at": raw_record["collected_at"],
        "raw_text": raw_record["raw_text"],
        "media_urls": raw_record.get("media_urls", []),
        "title": title,
        "summary": extracted.get("details"),
        "category": extracted.get("category"),
        "start_date": start_date,
        "end_date": extracted.get("end_date"),
        "start_time_text": start_time_text,
        "timezone": "America/Mexico_City",
        "venue_name": venue_name,
        "venue_reference": extracted.get("venue_reference"),
        "location_scope": extracted.get("location_scope", "unknown"),
        "organizer_name": extracted.get("organizer"),
        "confidence_score": confidence,
        "confidence_reasons": reasons,
        "duplicate_fingerprint": duplicate_fingerprint,
        "review_status": derive_status(extracted, confidence),
        "review_notes": extracted.get("details"),
    }


def validate_candidate(candidate, required_fields):
    missing = [field for field in required_fields if not candidate.get(field)]
    if missing:
        raise ValueError(f"Candidate {candidate['candidate_id']} missing required fields: {', '.join(missing)}")


def build():
    raw_records = load_json(RAW_RECORDS_PATH)
    registry_text = REGISTRY_JS_PATH.read_text(encoding="utf-8")
    manifest_text = MANIFEST_JS_PATH.read_text(encoding="utf-8")
    schema_text = SCHEMA_JS_PATH.read_text(encoding="utf-8")

    registry_ids = set(extract_single_quoted_values(registry_text, "id"))
    manifest_source_ids = set(extract_single_quoted_values(manifest_text, "sourceId"))
    required_fields = extract_required_fields(schema_text)

    unknown_manifest_sources = sorted(manifest_source_ids - registry_ids)
    if unknown_manifest_sources:
        raise ValueError(f"Manifest references unknown sources: {', '.join(unknown_manifest_sources)}")

    candidates = []
    for raw_record in raw_records:
        if raw_record["source_id"] not in registry_ids:
            raise ValueError(f"Raw record {raw_record['record_id']} references unknown source {raw_record['source_id']}")
        candidate = build_candidate(raw_record)
        validate_candidate(candidate, required_fields)
        candidates.append(candidate)

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    output = {
        "generated_at": generated_at,
        "count": len(candidates),
        "candidates": candidates,
    }

    CANDIDATES_JSON_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    CANDIDATES_JS_PATH.write_text(
        "window.SJDG_EVENT_CANDIDATES_UPDATED_AT = "
        + json.dumps(generated_at)
        + ";\nwindow.SJDG_EVENT_CANDIDATES = "
        + json.dumps(candidates, indent=2, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )

    approved = sum(1 for candidate in candidates if candidate["review_status"] == "approved")
    pending = sum(1 for candidate in candidates if candidate["review_status"] == "pending")
    needs_more_info = sum(1 for candidate in candidates if candidate["review_status"] == "needs_more_info")
    rejected = sum(1 for candidate in candidates if candidate["review_status"] == "rejected")

    print(f"Generated {len(candidates)} candidates")
    print(f"Approved: {approved}")
    print(f"Pending: {pending}")
    print(f"Needs more info: {needs_more_info}")
    print(f"Rejected: {rejected}")


if __name__ == "__main__":
    build()
