# Events Worker

The scheduled worker discovers recent source posts and imports them into the live events backend.

## What it does

- loads enabled sources from [data/source-registry.js](/Users/jaimemurillo/Desktop/SJDG%20Webpage/data/source-registry.js)
- loads enabled fetch jobs from [data/fetch-manifest.js](/Users/jaimemurillo/Desktop/SJDG%20Webpage/data/fetch-manifest.js)
- discovers recent URLs from public Facebook pages and enabled website sources
- sends each discovered URL through `/api/import-flyer`
- deduplicates against the live event store by:
  - `posting_url`
  - `source_id + post_id`
  - `duplicate_fingerprint`
- writes new candidates back to `/api/events`

## Scheduler

The GitHub Actions workflow is in [.github/workflows/events-worker.yml](/Users/jaimemurillo/Desktop/SJDG%20Webpage/.github/workflows/events-worker.yml).

It runs every 6 hours at minute 17 UTC:

- `17 */6 * * *`

Why this shape:

- GitHub Actions scheduled workflows can run as often as every 5 minutes and use UTC ([GitHub Docs](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows))
- GitHub notes that schedules at the top of the hour are more likely to be delayed, so the workflow is offset to minute 17
- Vercel Cron Jobs call functions directly and are useful, but on Hobby the minimum interval is once per day and execution can land anywhere within the hour ([Vercel Cron Jobs](https://vercel.com/docs/cron-jobs), [Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing))

## Secrets to configure

In GitHub repository secrets:

- `SJDG_SITE_BASE_URL`
  - Example: `https://your-site.vercel.app`
- `SJDG_ADMIN_TOKEN`
  - Must match the backend admin token
- `FACEBOOK_STORAGE_STATE_BASE64`
  - Optional
  - Base64-encoded Playwright storage state JSON if you want the worker to access logged-in Facebook pages/groups

## Worker dependencies

The worker uses Python Playwright.

Official install flow:

- `pip install playwright`
- `playwright install`

Reference: [Playwright Python library docs](https://playwright.dev/python/docs/library)

## Local run

Install dependencies first, then run:

```bash
python -m pip install -r requirements-worker.txt
python -m playwright install chromium
python scripts/events_feed_worker.py \
  --base-url https://your-site.vercel.app \
  --admin-token YOUR_ADMIN_TOKEN \
  --summary-path .worker-artifacts/summary.json \
  --artifact-dir .worker-artifacts
```

Useful options:

- `--check-config`
  - validates source + manifest parsing only
- `--dry-run`
  - discovers and imports candidates but does not save to `/api/events`
- `--source official-town-facebook`
  - limit a run to one source

## Current limits

- Public Facebook feed automation is still brittle and depends on what Facebook exposes to anonymous browsers
- Logged-in group access is only available if you provide a storage state secret
- Website discovery is intentionally conservative and only imports same-domain links that look event-related
- The worker skips duplicates; it does not yet intelligently merge changed details into existing events
