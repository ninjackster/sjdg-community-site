# Events Backend

The site now has a real backend path for shared events plus flyer OCR import.

## What is live now

- `GET /api/events`
  - Public events feed for `/events`
  - Returns the shared event set when backend storage is configured
- `PUT /api/events`
  - Saves the full event list from `/admin`
  - Uses `SJDG_ADMIN_TOKEN` when configured
- `POST /api/import-flyer`
  - Accepts a posting URL, direct image URL, caption text, or uploaded image payload
  - Tries page metadata first, then OCR / vision extraction
  - Returns a normalized event candidate for the admin queue

## Environment variables

- `SJDG_ADMIN_TOKEN`
  - Shared secret for admin writes and flyer imports
- `UPSTASH_REDIS_REST_URL`
  - Enables persistent shared storage
- `UPSTASH_REDIS_REST_TOKEN`
  - Token for the Upstash REST API
- `SJDG_EVENTS_STORE_KEY`
  - Optional Redis key override
  - Default: `sjdg:events:state:v1`
- `OPENAI_API_KEY`
  - Enables OCR / vision extraction for flyer images
- `OPENAI_VISION_MODEL`
  - Optional model override
  - Default: `gpt-4o-mini`

## Fallback behavior

- If Upstash is not configured:
  - local development writes to `data/runtime-events.json`
  - deployed Vercel writes are not durable
- If OpenAI is not configured:
  - flyer import falls back to simple text heuristics
  - direct image OCR quality will be limited

## Admin workflow

1. Open `/admin`
2. Paste the admin token into the token field
3. Use the import form with one of:
   - posting URL
   - image URL
   - flyer upload
   - optional caption text
4. Review the imported candidate
5. Save changes to push the full list to the live backend

## Current automation limit

The backend now supports live shared storage and real flyer import with OCR, but it does not yet crawl entire Facebook feeds by itself.

That missing step is a browser worker:

- public Facebook page discovery usually needs Playwright or another browser automation layer
- website sources can be fetched server-side more easily
- direct post URLs already work well with the current import endpoint because it can read page metadata and flyer images

For this project, the next automation layer should be a scheduled browser capture worker that:

- opens the known Facebook pages in the source registry
- collects recent post URLs
- sends each post through `/api/import-flyer`
