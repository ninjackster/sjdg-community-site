#!/usr/bin/env python3

import argparse
import base64
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
REGISTRY_PATH = DATA_DIR / "source-registry.js"
MANIFEST_PATH = DATA_DIR / "fetch-manifest.js"
DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; SJDGEventsWorker/1.0; +https://sjdg.mx/events)"
ARTICLE_KEYWORDS = (
    "evento", "event", "agenda", "programa", "festival", "fiesta", "cultura",
    "turismo", "san-jose", "san-jose-de-gracia", "gracia", "delegacion",
)
STATIC_ASSET_SUFFIXES = (
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".css", ".js",
    ".pdf", ".mp4", ".webm", ".ico", ".xml", ".zip",
)


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_js_array(path):
    text = Path(path).read_text(encoding="utf-8")
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"Could not find array literal in {path}")

    literal = text[start:end + 1]
    literal = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)", r'\1"\2"\3', literal)

    def replace_string(match):
        value = match.group(1)
        # Decode JS single-quote string escape sequences without corrupting UTF-8.
        # Only handle the common JS escapes (\n, \t, \\, \') rather than
        # unicode_escape which re-encodes multibyte characters and breaks Spanish.
        value = value.replace("\\'", "'").replace("\\\\", "\\").replace("\\n", "\n").replace("\\t", "\t").replace("\\r", "\r")
        return json.dumps(value)

    literal = re.sub(r"'([^'\\]*(?:\\.[^'\\]*)*)'", replace_string, literal)
    return json.loads(literal)


def load_worker_sources():
    registry = {item["id"]: item for item in load_js_array(REGISTRY_PATH)}
    manifest = load_js_array(MANIFEST_PATH)

    sources = []
    for job in manifest:
        source = registry.get(job.get("sourceId"))
        if not source or not job.get("enabled"):
            continue
        if not str(source.get("url", "")).startswith("http"):
            continue
        sources.append({
            "job_id": job["id"],
            "source_id": source["id"],
            "name": source.get("name", source["id"]),
            "platform": source.get("platform", ""),
            "url": source.get("url", ""),
            "kind": source.get("kind", ""),
            "fetch_mode": job.get("fetchMode", ""),
            "login_required": bool(job.get("loginRequired")),
            "schedule": job.get("schedule", ""),
        })
    return sources


def normalize_url(url):
    parsed = urllib.parse.urlsplit(url)
    cleaned = parsed._replace(fragment="")
    return urllib.parse.urlunsplit(cleaned)


def canonical_facebook_post_url(url):
    if not url:
        return ""

    parsed = urllib.parse.urlsplit(url)
    host = parsed.netloc.lower()
    if "facebook.com" not in host:
        return ""

    path = parsed.path.rstrip("/")
    query = urllib.parse.parse_qs(parsed.query)

    permalink_story = query.get("story_fbid", [None])[0]
    permalink_id = query.get("id", [None])[0]
    if path == "/permalink.php" and permalink_story and permalink_id:
        query_string = urllib.parse.urlencode({"story_fbid": permalink_story, "id": permalink_id})
        return f"https://www.facebook.com/permalink.php?{query_string}"

    # ?fbid=NNNN — current standard Facebook permalink format
    fbid = query.get("fbid", [None])[0]
    if fbid and re.fullmatch(r"\d+", fbid):
        return f"https://www.facebook.com/permalink.php?story_fbid={fbid}&id={permalink_id or fbid}"

    group_match = re.search(r"^/groups/([^/]+)/posts/(\d+)$", path)
    if group_match:
        return f"https://www.facebook.com/groups/{group_match.group(1)}/posts/{group_match.group(2)}/"

    page_post_match = re.search(r"^/([^/]+)/posts/(\d+)$", path)
    if page_post_match:
        return f"https://www.facebook.com/{page_post_match.group(1)}/posts/{page_post_match.group(2)}"

    return ""


def extract_post_id(url):
    if not url:
        return ""
    permalink_match = re.search(r"[?&]story_fbid=(\d+)", url)
    if permalink_match:
        return permalink_match.group(1)
    fbid_match = re.search(r"[?&]fbid=(\d+)", url)
    if fbid_match:
        return fbid_match.group(1)
    path_match = re.search(r"/posts/(\d+)", url)
    if path_match:
        return path_match.group(1)
    return ""


def fetch_url(url, timeout=30):
    request = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="ignore")


def extract_links_from_html(html, base_url):
    links = []
    for href in re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE):
        absolute = urllib.parse.urljoin(base_url, href)
        links.append(normalize_url(absolute))
    return links


def discover_website_urls(source, max_items):
    try:
        html = fetch_url(source["url"])
    except urllib.error.URLError as error:
        raise RuntimeError(f"Could not fetch {source['url']}: {error}") from error

    base = urllib.parse.urlsplit(source["url"])
    candidates = []
    seen = {normalize_url(source["url"])}

    for link in extract_links_from_html(html, source["url"]):
        parsed = urllib.parse.urlsplit(link)
        if parsed.scheme not in {"http", "https"}:
            continue
        if parsed.netloc != base.netloc:
            continue
        if link in seen:
            continue
        if any(parsed.path.lower().endswith(suffix) for suffix in STATIC_ASSET_SUFFIXES):
            continue
        if parsed.path in {"", "/"}:
            continue

        joined = f"{parsed.path}?{parsed.query}".lower()
        if not any(keyword in joined for keyword in ARTICLE_KEYWORDS):
            continue

        seen.add(link)
        candidates.append({
            "posting_url": link,
            "caption_text": "",
            "image_url": "",
        })
        if len(candidates) >= max_items:
            break

    if not candidates:
        candidates.append({
            "posting_url": source["url"],
            "caption_text": "",
            "image_url": "",
        })

    return candidates[:max_items]


def write_storage_state_if_needed():
    base64_state = os.environ.get("FACEBOOK_STORAGE_STATE_BASE64", "").strip()
    json_state = os.environ.get("FACEBOOK_STORAGE_STATE_JSON", "").strip()

    if not base64_state and not json_state:
        return None

    temp_file = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
    if base64_state:
        temp_file.write(base64.b64decode(base64_state).decode("utf-8"))
    else:
        temp_file.write(json_state)
    temp_file.flush()
    temp_file.close()
    return temp_file.name


def has_storage_state():
    return bool(
        os.environ.get("FACEBOOK_STORAGE_STATE_BASE64", "").strip()
        or os.environ.get("FACEBOOK_STORAGE_STATE_JSON", "").strip()
    )


def capture_page_artifact(page, artifact_dir, filename):
    if not artifact_dir:
        return
    artifact_dir.mkdir(parents=True, exist_ok=True)
    try:
        page.screenshot(path=str(artifact_dir / filename), full_page=True)
    except Exception:
        return


def discover_facebook_posts(source, max_items, artifact_dir=None):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise RuntimeError(
            "Playwright is not installed. Install worker dependencies first."
        ) from error

    storage_state_path = write_storage_state_if_needed()
    discovered = []
    seen = set()

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context_kwargs = {}
            if storage_state_path:
                context_kwargs["storage_state"] = storage_state_path
            context = browser.new_context(**context_kwargs)

            try:
                source_page = context.new_page()
                source_page.goto(source["url"], wait_until="domcontentloaded", timeout=45000)
                source_page.wait_for_timeout(3000)
                for _ in range(2):
                    source_page.mouse.wheel(0, 2200)
                    source_page.wait_for_timeout(1200)

                capture_page_artifact(source_page, artifact_dir, f"{source['source_id']}-feed.png")

                anchors = source_page.evaluate(
                    """() => Array.from(document.querySelectorAll('a[href]')).map((anchor) => ({
                      href: anchor.href,
                      text: (anchor.innerText || anchor.getAttribute('aria-label') || '').trim()
                    }))"""
                )

                post_urls = []
                for anchor in anchors:
                    canonical = canonical_facebook_post_url(anchor.get("href", ""))
                    if not canonical or canonical in seen:
                        continue
                    seen.add(canonical)
                    post_urls.append(canonical)
                    if len(post_urls) >= max_items:
                        break

                for index, posting_url in enumerate(post_urls):
                    post_page = context.new_page()
                    try:
                        post_page.goto(posting_url, wait_until="domcontentloaded", timeout=45000)
                        post_page.wait_for_timeout(2500)
                        capture_page_artifact(post_page, artifact_dir, f"{source['source_id']}-post-{index + 1}.png")
                        body_text = post_page.evaluate(
                            "() => (document.body && document.body.innerText ? document.body.innerText : '').slice(0, 6000)"
                        )
                        image_url = post_page.evaluate(
                            """() => {
                              const images = Array.from(document.images)
                                .map((img) => img.currentSrc || img.src || '')
                                .filter((src) => /^https?:/i.test(src));
                              return images.find((src) => !/scontent|profile_pic/i.test(src)) || images[0] || '';
                            }"""
                        )
                        discovered.append({
                            "posting_url": posting_url,
                            "caption_text": body_text.strip(),
                            "image_url": image_url,
                        })
                    finally:
                        post_page.close()
            finally:
                context.close()
                browser.close()
    finally:
        if storage_state_path:
            try:
                os.unlink(storage_state_path)
            except OSError:
                pass

    return discovered


class ApiClient:
    def __init__(self, base_url, admin_token, timeout=60):
        self.base_url = base_url.rstrip("/")
        self.admin_token = admin_token.strip()
        self.timeout = timeout

    def _request(self, path, method="GET", payload=None, auth=False):
        url = f"{self.base_url}{path}"
        body = None
        headers = {
            "Accept": "application/json",
            "User-Agent": DEFAULT_USER_AGENT,
        }
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if auth:
            headers["Authorization"] = f"Bearer {self.admin_token}"

        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            data = response.read().decode("utf-8")
        parsed = json.loads(data or "{}")
        if parsed.get("ok") is False:
            raise RuntimeError(parsed.get("error") or f"API error from {path}")
        return parsed

    def get_events(self):
        return self._request("/api/events")

    def import_flyer(self, payload):
        return self._request("/api/import-flyer", method="POST", payload=payload, auth=True)

    def save_events(self, events):
        return self._request("/api/events", method="PUT", payload={"events": events}, auth=True)


def existing_keys(events):
    posting_urls = set()
    source_post_ids = set()
    fingerprints = set()

    for event in events:
        posting_url = event.get("posting_url", "")
        if posting_url:
            posting_urls.add(posting_url)

        post_id = event.get("post_id", "")
        source_id = event.get("source_id", "")
        if source_id and post_id:
            source_post_ids.add((source_id, post_id))

        fingerprint = event.get("duplicate_fingerprint", "")
        if fingerprint:
            fingerprints.add(fingerprint)

    return posting_urls, source_post_ids, fingerprints


def summarize_summary(summary, path):
    if not path:
        return
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def should_include_source(source, allow_source_ids):
    if not allow_source_ids:
        return True
    return source["source_id"] in allow_source_ids


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Discover recent source posts and import them into the live SJDG events backend.")
    parser.add_argument("--base-url", default=os.environ.get("SJDG_SITE_BASE_URL", "").strip(), help="Deployed site base URL, e.g. https://sjdg.mx")
    parser.add_argument("--admin-token", default=os.environ.get("SJDG_ADMIN_TOKEN", "").strip(), help="Admin token for protected API routes")
    parser.add_argument("--source", action="append", default=[], help="Limit the run to one or more source IDs")
    parser.add_argument("--max-posts-per-source", type=int, default=int(os.environ.get("WORKER_MAX_POSTS_PER_SOURCE", "3")), help="How many discovered URLs to process per source")
    parser.add_argument("--dry-run", action="store_true", help="Discover and import candidates without writing them back to /api/events")
    parser.add_argument("--summary-path", default=os.environ.get("WORKER_SUMMARY_PATH", "").strip(), help="Optional JSON summary output path")
    parser.add_argument("--artifact-dir", default=os.environ.get("WORKER_ARTIFACT_DIR", "").strip(), help="Optional screenshot artifact directory")
    parser.add_argument("--check-config", action="store_true", help="Validate source and manifest parsing without contacting the API")
    return parser.parse_args(argv)


def run(argv):
    args = parse_args(argv)
    sources = load_worker_sources()
    allow_source_ids = {item.strip() for item in args.source if item.strip()}

    if args.check_config:
        print(f"Loaded {len(sources)} enabled worker sources")
        for source in sources:
            print(f"- {source['source_id']} [{source['fetch_mode']}] {source['url']}")
        return 0

    if not args.base_url:
        print("Missing --base-url or SJDG_SITE_BASE_URL", file=sys.stderr)
        return 2
    if not args.admin_token:
        print("Missing --admin-token or SJDG_ADMIN_TOKEN", file=sys.stderr)
        return 2

    artifact_dir = Path(args.artifact_dir) if args.artifact_dir else None
    api = ApiClient(args.base_url, args.admin_token)
    state = api.get_events()
    events = list(state.get("events", []))
    posting_urls, source_post_ids, fingerprints = existing_keys(events)

    summary = {
        "started_at": now_iso(),
        "base_url": args.base_url,
        "dry_run": args.dry_run,
        "existing_events": len(events),
        "sources": [],
        "imported_count": 0,
        "skipped_duplicates": 0,
        "errors": [],
    }

    for source in sources:
        if not should_include_source(source, allow_source_ids):
            continue

        source_summary = {
            "source_id": source["source_id"],
            "name": source["name"],
            "fetch_mode": source["fetch_mode"],
            "discovered_urls": 0,
            "imported": 0,
            "skipped": 0,
            "errors": [],
        }

        if source["login_required"] and not has_storage_state():
            source_summary["errors"].append("Skipped because login is required and no Facebook storage state secret is configured.")
            summary["sources"].append(source_summary)
            continue

        try:
            if source["fetch_mode"] == "browser_capture":
                discovered = discover_facebook_posts(source, args.max_posts_per_source, artifact_dir=artifact_dir)
            elif source["fetch_mode"] == "html_scrape":
                discovered = discover_website_urls(source, args.max_posts_per_source)
            else:
                discovered = []
        except Exception as error:
            source_summary["errors"].append(str(error))
            summary["errors"].append({"source_id": source["source_id"], "error": str(error)})
            summary["sources"].append(source_summary)
            continue

        source_summary["discovered_urls"] = len(discovered)

        for item in discovered:
            posting_url = item.get("posting_url", "")
            post_id = extract_post_id(posting_url)
            if posting_url and posting_url in posting_urls:
                source_summary["skipped"] += 1
                summary["skipped_duplicates"] += 1
                continue
            if post_id and (source["source_id"], post_id) in source_post_ids:
                source_summary["skipped"] += 1
                summary["skipped_duplicates"] += 1
                continue

            try:
                imported = api.import_flyer({
                    "source_id": source["source_id"],
                    "source_url": source["url"],
                    "posting_url": posting_url,
                    "post_id": post_id,
                    "image_url": item.get("image_url", ""),
                    "caption_text": item.get("caption_text", ""),
                })
            except Exception as error:
                source_summary["errors"].append(f"{posting_url or source['url']}: {error}")
                summary["errors"].append({"source_id": source["source_id"], "posting_url": posting_url, "error": str(error)})
                continue

            candidate = imported.get("candidate", {})
            if candidate.get("posting_url") and candidate["posting_url"] in posting_urls:
                source_summary["skipped"] += 1
                summary["skipped_duplicates"] += 1
                continue
            if candidate.get("post_id") and (candidate.get("source_id"), candidate.get("post_id")) in source_post_ids:
                source_summary["skipped"] += 1
                summary["skipped_duplicates"] += 1
                continue
            if candidate.get("duplicate_fingerprint") and candidate["duplicate_fingerprint"] in fingerprints:
                source_summary["skipped"] += 1
                summary["skipped_duplicates"] += 1
                continue

            events.append(candidate)
            source_summary["imported"] += 1
            summary["imported_count"] += 1

            if candidate.get("posting_url"):
                posting_urls.add(candidate["posting_url"])
            if candidate.get("source_id") and candidate.get("post_id"):
                source_post_ids.add((candidate["source_id"], candidate["post_id"]))
            if candidate.get("duplicate_fingerprint"):
                fingerprints.add(candidate["duplicate_fingerprint"])

        summary["sources"].append(source_summary)

    if not args.dry_run and summary["imported_count"] > 0:
        saved = api.save_events(events)
        summary["saved_event_count"] = len(saved.get("events", []))
        summary["save_mode"] = saved.get("mode", "")
        summary["saved_at"] = saved.get("updated_at", "")
    else:
        summary["saved_event_count"] = len(events)
        summary["save_mode"] = "dry_run" if args.dry_run else state.get("mode", "")
        summary["saved_at"] = now_iso()

    summary["finished_at"] = now_iso()
    summarize_summary(summary, args.summary_path)
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1:]))
