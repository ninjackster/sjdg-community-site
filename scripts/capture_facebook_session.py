#!/usr/bin/env python3
"""
Run this once to capture a Facebook login session for the events worker.

Usage:
    python scripts/capture_facebook_session.py

A browser window will open. Log into Facebook normally, then come back here
and press Enter. The session will be saved and the base64 secret printed.
"""

import base64
import json
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright is not installed. Run:")
    print("  pip install -r requirements-worker.txt")
    print("  playwright install chromium")
    sys.exit(1)

OUTPUT_PATH = Path(__file__).parent.parent / "data" / "facebook-session.json"


def main():
    print("Opening browser — log into Facebook, then come back here and press Enter.")
    print()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False, slow_mo=100)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        page.goto("https://www.facebook.com/login", wait_until="domcontentloaded")

        input("Log into Facebook in the browser window, then press Enter here... ")

        storage_state = context.storage_state()
        context.close()
        browser.close()

    OUTPUT_PATH.write_text(json.dumps(storage_state, indent=2), encoding="utf-8")

    encoded = base64.b64encode(OUTPUT_PATH.read_bytes()).decode("ascii")

    print()
    print("Session saved. Add this as the FACEBOOK_STORAGE_STATE_BASE64 GitHub secret:")
    print()
    print(encoded)
    print()
    print(f"(Also saved locally to {OUTPUT_PATH} — do NOT commit this file.)")


if __name__ == "__main__":
    main()
