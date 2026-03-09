import re
from http.server import BaseHTTPRequestHandler
from pathlib import Path

from api._lib.flyer_import import process_flyer_import
from api._lib.http_helpers import json_response, read_json_body, require_admin_auth, send_options


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "data" / "source-registry.js"


def load_registry():
    text = REGISTRY_PATH.read_text(encoding="utf-8")
    items = []
    pattern = re.compile(
        r"id:\s*'([^']+)'.*?platform:\s*'([^']+)'.*?url:\s*'([^']+)'",
        re.DOTALL,
    )
    for match in pattern.finditer(text):
        items.append({
            "id": match.group(1),
            "platform": match.group(2),
            "url": match.group(3),
        })
    return items


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        send_options(self)

    def do_POST(self):
        if not require_admin_auth(self):
            json_response(self, 401, {"ok": False, "error": "Admin token required."})
            return

        try:
            payload = read_json_body(self)
            result = process_flyer_import(payload, load_registry())
            json_response(self, 200, {"ok": True, **result})
        except Exception as error:
            json_response(self, 400, {"ok": False, "error": str(error)})
