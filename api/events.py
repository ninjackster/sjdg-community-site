from http.server import BaseHTTPRequestHandler

from api._lib.event_backend import load_event_state, save_event_state
from api._lib.http_helpers import admin_token_required, json_response, read_json_body, require_admin_auth, send_options


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        send_options(self)

    def do_GET(self):
        state = load_event_state()
        json_response(self, 200, {
            "ok": True,
            "mode": state.get("mode", "seed"),
            "updated_at": state.get("updated_at"),
            "auth_required": admin_token_required(),
            "events": state.get("events", []),
        })

    def do_PUT(self):
        if not require_admin_auth(self):
            json_response(self, 401, {"ok": False, "error": "Admin token required."})
            return

        try:
            payload = read_json_body(self)
            events = payload.get("events")
            if not isinstance(events, list):
                raise ValueError("Expected an events array.")
            state = save_event_state(events)
            json_response(self, 200, {
                "ok": True,
                "mode": state.get("mode", "seed"),
                "updated_at": state.get("updated_at"),
                "events": state.get("events", []),
            })
        except Exception as error:
            json_response(self, 400, {"ok": False, "error": str(error)})
