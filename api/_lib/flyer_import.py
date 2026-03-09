import json
import os
import re
import secrets
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html import unescape


DEFAULT_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_API_URL = "https://api.openai.com/v1/responses"


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slugify(value):
    cleaned = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return cleaned or "unknown"


def extract_meta_tag(html, key):
    patterns = [
        rf'<meta[^>]+property=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']{re.escape(key)}["\']',
        rf'<meta[^>]+name=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']{re.escape(key)}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return unescape(match.group(1).strip())
    return ""


def fetch_open_graph(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; SJDGEventsBot/1.0; +https://sjdg.mx/events)"
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        html = response.read().decode("utf-8", errors="ignore")
    return {
        "title": extract_meta_tag(html, "og:title"),
        "description": extract_meta_tag(html, "og:description") or extract_meta_tag(html, "description"),
        "image": extract_meta_tag(html, "og:image"),
    }


def extract_facebook_post_id(posting_url):
    if not posting_url:
        return ""
    permalink_match = re.search(r"[?&]story_fbid=(\d+)", posting_url)
    if permalink_match:
        return permalink_match.group(1)
    path_match = re.search(r"/posts/(\d+)", posting_url)
    if path_match:
        return path_match.group(1)
    group_match = re.search(r"/groups/[^/]+/posts/(\d+)", posting_url)
    if group_match:
        return group_match.group(1)
    return ""


def heuristics_from_text(text):
    normalized = text or ""
    iso_date = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", normalized)
    time_match = re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b", normalized)
    lines = [line.strip() for line in normalized.splitlines() if line.strip()]
    title = lines[0][:120] if lines else "Untitled event"
    venue_name = ""
    organizer_name = ""
    summary_lines = []

    venue_terms = ("plaza", "casa de cultura", "templo", "lienzo", "auditorio", "cancha", "campo", "centro", "parroquia")
    organizer_terms = ("delegacion", "gobierno", "casa de cultura", "fiestas", "cruz roja", "ayuntamiento", "comite", "vecinos")

    for line in lines[1:]:
        lower = line.lower()
        if not venue_name and any(term in lower for term in venue_terms):
            venue_name = line
            continue
        if not organizer_name and any(term in lower for term in organizer_terms):
            organizer_name = line
            continue
        summary_lines.append(line)

    category = "community"
    lower_text = normalized.lower()
    if any(term in lower_text for term in ("banda", "musica", "concierto", "baile")):
        category = "music"
    elif any(term in lower_text for term in ("taller", "danza", "cultura", "cine", "exposicion")):
        category = "culture"
    elif any(term in lower_text for term in ("carrera", "torneo", "partido", "deportivo", "5k")):
        category = "sports"
    elif any(term in lower_text for term in ("beneficencia", "apoyo", "recaudacion", "cruz roja")):
        category = "fundraiser"

    location_scope = "town"
    if "tepatitlan" in lower_text and "san jose de gracia" not in lower_text:
        location_scope = "municipality"

    return {
        "title": title,
        "summary": " ".join(summary_lines)[:280] or normalized[:280],
        "category": category,
        "start_date": iso_date.group(1) if iso_date else "",
        "end_date": "",
        "start_time_text": time_match.group(0) if time_match else "",
        "venue_name": venue_name,
        "venue_reference": "",
        "organizer_name": organizer_name,
        "location_scope": location_scope,
        "review_notes": "Fallback parsing used. Review before publishing.",
        "raw_text": normalized,
    }


def openai_extract(image_url="", image_data_url="", caption_text="", page_title="", page_description=""):
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    prompt = (
        "You extract community event data from Mexican Spanish flyers and captions. "
        "Return JSON only with keys: title, summary, category, start_date, end_date, "
        "start_time_text, venue_name, venue_reference, organizer_name, location_scope, "
        "review_notes, raw_text. "
        "Use ISO date format YYYY-MM-DD only when exact. "
        "location_scope must be one of: town, municipality, unknown, out_of_scope. "
        "Treat San Jose de Gracia, Tepatitlan, Jalisco as town scope. "
        "If information is missing, use empty strings."
    )

    content = [{"type": "input_text", "text": prompt}]
    if caption_text:
        content.append({"type": "input_text", "text": f"Caption or post text:\n{caption_text}"})
    if page_title or page_description:
        content.append({
            "type": "input_text",
            "text": f"Page metadata:\nTitle: {page_title}\nDescription: {page_description}",
        })
    if image_data_url:
        content.append({"type": "input_image", "image_url": image_data_url})
    elif image_url:
        content.append({"type": "input_image", "image_url": image_url})

    payload = {
        "model": DEFAULT_MODEL,
        "input": [
            {
                "role": "user",
                "content": content,
            }
        ],
    }

    request = urllib.request.Request(
        OPENAI_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        result = json.loads(response.read().decode("utf-8"))

    text = result.get("output_text", "")
    if not text:
        chunks = []
        for item in result.get("output", []):
            for content_item in item.get("content", []):
                if content_item.get("type") == "output_text" and content_item.get("text"):
                    chunks.append(content_item["text"])
        text = "\n".join(chunks)

    if not text:
        raise RuntimeError("OpenAI did not return any text output.")

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise RuntimeError("OpenAI response did not contain valid JSON.")
    return json.loads(text[start:end + 1])


def derive_source_type(source_url, posting_url, image_url):
    url = posting_url or source_url or ""
    if "facebook.com" in url:
        return "facebook_post"
    if image_url and not url:
        return "flyer_image"
    return "website_article"


def confidence_from_extracted(extracted, source_id):
    score = 0.4
    reasons = []

    if extracted.get("start_date"):
        score += 0.2
        reasons.append("found event date")
    if extracted.get("start_time_text"):
        score += 0.1
        reasons.append("found event time")
    if extracted.get("venue_name"):
        score += 0.1
        reasons.append("found venue")
    if extracted.get("organizer_name"):
        score += 0.05
        reasons.append("found organizer")
    if extracted.get("location_scope") == "town":
        score += 0.1
        reasons.append("matched town scope")
    if source_id in {"official-town-facebook", "fiestas-patronales-facebook", "casa-cultura-facebook"}:
        score += 0.05
        reasons.append("high-trust source")
    if extracted.get("location_scope") in {"municipality", "out_of_scope"}:
        score -= 0.2
        reasons.append("outside town scope")

    return max(0.05, min(round(score, 2), 0.99)), reasons


def review_status(extracted, confidence):
    if extracted.get("location_scope") in {"municipality", "out_of_scope"}:
        return "rejected"
    if not extracted.get("start_date") or not extracted.get("venue_name"):
        return "needs_more_info"
    if confidence >= 0.85:
        return "approved"
    return "pending"


def build_candidate(payload, source_url, posting_url, image_url, extracted, source_type):
    source_id = payload.get("source_id") or "manual-admin"
    title = extracted.get("title") or "Untitled event"
    start_date = extracted.get("start_date") or ""
    venue_name = extracted.get("venue_name") or ""
    duplicate_fingerprint = "|".join([
        slugify(title),
        start_date or "unknown-date",
        slugify(venue_name or extracted.get("venue_reference", "")),
    ])
    confidence_score, confidence_reasons = confidence_from_extracted(extracted, source_id)
    post_id = payload.get("post_id") or extract_facebook_post_id(posting_url)

    return {
        "candidate_id": f"cand_import_{int(datetime.now().timestamp())}_{secrets.token_hex(3)}",
        "source_id": source_id,
        "fetch_job_id": f"import-{source_id}",
        "post_id": post_id,
        "posting_url": posting_url or "",
        "source_url": source_url or posting_url or "",
        "source_type": source_type,
        "collected_at": now_iso(),
        "raw_text": extracted.get("raw_text", "") or payload.get("caption_text", "") or "",
        "media_urls": [image_url] if image_url else [],
        "title": title,
        "summary": extracted.get("summary", "") or "",
        "category": extracted.get("category", "") or "community",
        "start_date": extracted.get("start_date") or None,
        "end_date": extracted.get("end_date") or None,
        "start_time_text": extracted.get("start_time_text", "") or "",
        "timezone": "America/Mexico_City",
        "venue_name": venue_name,
        "venue_reference": extracted.get("venue_reference", "") or "",
        "location_scope": extracted.get("location_scope") or "town",
        "organizer_name": extracted.get("organizer_name", "") or "",
        "confidence_score": confidence_score,
        "confidence_reasons": confidence_reasons,
        "duplicate_fingerprint": duplicate_fingerprint,
        "review_status": review_status(extracted, confidence_score),
        "review_notes": extracted.get("review_notes", "") or "",
    }


def process_flyer_import(payload, registry):
    posting_url = (payload.get("posting_url") or "").strip()
    source_id = (payload.get("source_id") or "manual-admin").strip()
    source = next((item for item in registry if item.get("id") == source_id), None)
    source_url = (payload.get("source_url") or "").strip() or (source.get("url") if source else "")
    image_url = (payload.get("image_url") or "").strip()
    image_base64 = (payload.get("image_base64") or "").strip()
    mime_type = (payload.get("image_mime_type") or "image/jpeg").strip()
    caption_text = (payload.get("caption_text") or "").strip()
    page_title = ""
    page_description = ""

    if posting_url and not image_url and not caption_text:
        try:
            meta = fetch_open_graph(posting_url)
            page_title = meta.get("title", "")
            page_description = meta.get("description", "")
            image_url = image_url or meta.get("image", "")
            caption_text = caption_text or page_description
        except Exception:
            pass

    extracted = None
    image_data_url = ""
    if image_base64:
        image_data_url = f"data:{mime_type};base64,{image_base64}"

    if image_url or image_data_url:
        try:
            extracted = openai_extract(
                image_url=image_url,
                image_data_url=image_data_url,
                caption_text=caption_text,
                page_title=page_title,
                page_description=page_description,
            )
        except Exception as error:
            if not caption_text and not page_title and not page_description:
                raise RuntimeError(str(error))

    if not extracted:
        free_text = "\n".join(part for part in [caption_text, page_title, page_description] if part).strip()
        if not free_text:
            raise RuntimeError("No image, caption text, or page metadata was available to extract an event.")
        extracted = heuristics_from_text(free_text)

    source_type = derive_source_type(source_url, posting_url, image_url)
    candidate = build_candidate(payload, source_url, posting_url, image_url, extracted, source_type)
    return {
        "candidate": candidate,
        "meta": {
            "used_openai": bool((image_url or image_data_url) and OPENAI_API_KEY),
            "fetched_page_meta": bool(page_title or page_description),
        },
    }
