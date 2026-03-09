import json
import os


def json_response(handler, status_code, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler):
    length = int(handler.headers.get("content-length", "0") or "0")
    raw = handler.rfile.read(length).decode("utf-8") if length > 0 else ""
    if not raw:
        return {}
    return json.loads(raw)


def send_options(handler):
    handler.send_response(204)
    handler.send_header("Allow", "GET, POST, PUT, OPTIONS")
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()


def admin_token_required():
    return bool(os.environ.get("SJDG_ADMIN_TOKEN", "").strip())


def request_admin_token(handler):
    header = handler.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return handler.headers.get("x-admin-token", "").strip()


def require_admin_auth(handler):
    expected = os.environ.get("SJDG_ADMIN_TOKEN", "").strip()
    if not expected:
        return False
    return request_admin_token(handler) == expected
