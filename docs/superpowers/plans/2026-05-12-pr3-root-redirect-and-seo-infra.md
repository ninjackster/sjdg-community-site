# PR 3 — Root Language Redirect + SEO Infrastructure Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/` redirect to `/en/` or `/es/` based on visitor's `Accept-Language` header. Delete the legacy single-language `index.html`. Verify Search Console picks up the new sitemap. Fix the lingering `<html lang>` / OG-locale signal mismatches.

**Architecture:** Vercel `redirects` block in `vercel.json` matches the root path `/` and routes by header. Spanish-preferring visitors land on `/es/`, everyone else on `/en/`. The redirect is **307** (temporary) — language preference can change, so we don't want browsers/proxies caching it permanently. The legacy root `index.html` is deleted from the repo (the new `dist/en/index.html` and `dist/es/index.html` from PR 1 already serve content). hreflang is already handled per-page by `buildPage()` from PR 1, so no template changes are needed.

**Tech Stack:** Vanilla HTML/CSS/JS + Node build (no changes). Vercel redirects (header matching).

**Project root:** `/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage`

**Spec reference:** `docs/superpowers/specs/2026-05-12-seo-overhaul-design.md` (PR 3 row in the PR sequence)

**Out of scope for PR 3:**
- Per-business static pages (PR 4)
- Topic / tourist landing pages (PR 5)
- Search Console Domain property setup + `.org` 301 redirect (PR 6)
- Per-language sitemap split (decided against — current single sitemap with `xhtml:link hreflang` alternates is what Google recommends)

---

## Locked design decisions

1. **`/` redirect:** Use Vercel `redirects` with `has` header matching on `Accept-Language`. Match `^.*\bes\b.*$` (any tag containing `es` — covers `es`, `es-MX`, `es-419`, `en;q=0.9, es;q=0.8`, etc.) → `/es/`. Default fallback → `/en/`.
2. **Redirect status code:** **307 Temporary** — visitor language preference is not permanent (they may switch via the language toggle, return on a different device, share the link). 308 would tell browsers/CDNs to cache the redirect across sessions, which would lock a visitor into one language permanently.
3. **Legacy `index.html`:** Delete from repo root. The PR 1 passthrough was copying it to `dist/index.html`, which has been silently overshadowed by `/en/` and `/es/` since PR 1 (the language switcher in the legacy file is now broken anyway because the bilingual layouts use a different DOM structure). Remove cleanly.
4. **`<html lang>` / OG-locale mismatch fix:** The mismatch only existed in the legacy `index.html`. With it deleted, the bilingual templates from PR 1 already emit correct `<html lang>` and matching OG locale per page. No template change needed — but verify after the legacy delete.
5. **robots.txt:** Already points to `/sitemap.xml` (correct). No changes needed.

---

## File Structure

**Modified files:**

| Path | Change |
|------|--------|
| `vercel.json` | Add `/` → language-matched redirect (307). Existing 4 legacy 301 redirects from PR 2 are preserved. |
| `tests/passthrough.test.js` | Remove `index.html` from `LEGACY_FILES` array (it no longer lives at root). |

**Deleted files:**

| Path | Reason |
|------|--------|
| `index.html` | Replaced by `/en/` and `/es/`. Vercel handles `/` via redirect. |

**Untouched:** All build system code, all templates, all content JSON, all other passthrough files (`admin-businesses.html`, images, sitemap, robots, api/).

---

## Pre-flight: Worktree setup (controller responsibility)

```bash
cd "/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage"
git worktree add .worktrees/pr3-root-redirect -b feat/pr3-root-redirect
cd .worktrees/pr3-root-redirect
npm test    # baseline — should be 33 passing from PR 2
```

If baseline fails, stop and investigate.

---

## Task 1: Vercel `/` redirect by Accept-Language

Add the root-path language detection to `vercel.json`. Vercel evaluates `redirects` in order, so the Spanish match must come before the English fallback.

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Replace `vercel.json`**

Current content (after PR 2):
```json
{
  "cleanUrls": true,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "redirects": [
    { "source": "/businesses", "destination": "/en/businesses", "permanent": true },
    { "source": "/faq",        "destination": "/en/faq",        "permanent": true },
    { "source": "/tour",       "destination": "/en/tour",       "permanent": true },
    { "source": "/advertise",  "destination": "/en/advertise",  "permanent": true }
  ]
}
```

Replace with:
```json
{
  "cleanUrls": true,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "redirects": [
    {
      "source": "/",
      "has": [
        { "type": "header", "key": "accept-language", "value": ".*\\b(es)\\b.*" }
      ],
      "destination": "/es/",
      "permanent": false
    },
    { "source": "/", "destination": "/en/", "permanent": false },

    { "source": "/businesses", "destination": "/en/businesses", "permanent": true },
    { "source": "/faq",        "destination": "/en/faq",        "permanent": true },
    { "source": "/tour",       "destination": "/en/tour",       "permanent": true },
    { "source": "/advertise",  "destination": "/en/advertise",  "permanent": true }
  ]
}
```

**Notes:**
- The `value` regex is JSON-escaped: `.*\\b(es)\\b.*` becomes the regex `.*\b(es)\b.*` at runtime, which matches any Accept-Language containing `es` as a whole word (`es`, `es-MX`, `en, es;q=0.5`, etc.).
- `permanent: false` produces a 307 redirect (Vercel's documented behavior). If you need to confirm: Vercel docs say `permanent: true` → 308, `permanent: false` → 307.
- The Spanish match comes BEFORE the English fallback. Vercel evaluates the array in order; the first match wins.

- [ ] **Step 2: Sanity-parse the JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json'))" && echo ok`
Expected: `ok`

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All 33 tests still pass — `vercel.json` isn't covered by tests, but no other code changed so the baseline holds.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat: redirect / to /en/ or /es/ based on Accept-Language"
```

---

## Task 2: Delete legacy `index.html`, update passthrough test

The legacy English-only `index.html` has been overshadowed by `/en/` and `/es/` since PR 1. Vercel's `cleanUrls: true` plus the new `/` redirect from Task 1 means nobody hits the old file via any URL anymore. Remove it.

**Files:**
- Delete: `index.html`
- Modify: `tests/passthrough.test.js`

- [ ] **Step 1: Delete the legacy file**

```bash
git rm index.html
```

- [ ] **Step 2: Update `tests/passthrough.test.js`**

Open the file. Find this block (currently lines 10–18 after PR 2):

```javascript
const LEGACY_FILES = [
  'index.html',
  'admin-businesses.html',
  'robots.txt',
  ...
];
```

Remove the `'index.html',` line. The array becomes:

```javascript
const LEGACY_FILES = [
  'admin-businesses.html',
  'robots.txt',
  ...
];
```

(All other entries stay — `admin-businesses.html`, robots, sitemap, favicons, images.)

- [ ] **Step 3: Run a clean build**

```bash
rm -rf dist && node scripts/build.js 2>&1 | tail -15
```

Expected output:
```
✓ copied legacy passthrough files
✓ wrote dist/en/index.html (...)
✓ wrote dist/es/index.html (...)
✓ wrote dist/en/businesses.html (...)
... (10 page writes)
Build complete.
```

Verify `dist/index.html` does NOT exist:
```bash
test -f dist/index.html && echo "STILL EXISTS — WRONG" || echo "correctly absent"
```
Expected: `correctly absent`

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All 33 tests pass. The passthrough test now skips the deleted `index.html` entry.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: delete legacy index.html, root redirect handles / now"
```

---

## Task 3: Local end-to-end smoke test

Verify the redirect logic works correctly with `vercel dev`.

- [ ] **Step 1: Start `vercel dev` in background**

```bash
vercel dev --yes > /tmp/vercel-pr3.log 2>&1 &
sleep 10
```

- [ ] **Step 2: Test root redirect — English default**

```bash
CURL=/usr/bin/curl
$CURL -sI -H "Accept-Language: en-US,en;q=0.9" http://localhost:3000/ | grep -iE "^(HTTP|location)"
```

Expected:
```
HTTP/1.1 307 Temporary Redirect
location: /en/
```

- [ ] **Step 3: Test root redirect — Spanish detection**

```bash
$CURL -sI -H "Accept-Language: es-MX,es;q=0.9,en;q=0.5" http://localhost:3000/ | grep -iE "^(HTTP|location)"
```

Expected:
```
HTTP/1.1 307 Temporary Redirect
location: /es/
```

- [ ] **Step 4: Test root redirect — Spanish secondary preference**

```bash
$CURL -sI -H "Accept-Language: en-US,en;q=0.9,es;q=0.7" http://localhost:3000/ | grep -iE "^(HTTP|location)"
```

Expected: `location: /es/` (because the regex matches any `es` token in the header — this is intentional; users with Spanish in their preference list deserve the Spanish version).

If you want to be stricter (only redirect to `/es/` when Spanish is the PRIMARY language), the regex would need a more complex match. Defer that nuance to a follow-up — broader Spanish detection is the safer default for a Mexico-focused site.

- [ ] **Step 5: Test root redirect — no Accept-Language header (curl default)**

```bash
$CURL -sI http://localhost:3000/ | grep -iE "^(HTTP|location)"
```

Expected: `location: /en/` (the fallback). Some clients send no Accept-Language; English is the default.

- [ ] **Step 6: Verify all other routes unchanged**

```bash
echo "=== BILINGUAL ==="
for path in /en/ /es/ /en/businesses /es/negocios /en/faq /es/preguntas /en/tour /es/recorrido /en/advertise /es/anuncios; do
  echo "$path → $($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")"
done

echo "=== LEGACY REDIRECTS (unchanged from PR 2) ==="
for path in /businesses /faq /tour /advertise; do
  loc=$($CURL -sI "http://localhost:3000$path" | grep -i ^location)
  echo "$path → $($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path") | $loc"
done

echo "=== STATIC ==="
for path in /sitemap.xml /robots.txt /admin-businesses; do
  echo "$path → $($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")"
done
```

Expected:
- All 10 bilingual URLs → 200
- All 4 legacy redirects → 308 with `location: /en/<slug>`
- All 3 static → 200

- [ ] **Step 7: Verify the homepage's `<html lang>` matches OG locale (consistency check)**

```bash
$CURL -s http://localhost:3000/en/ | grep -E '<html lang|og:locale'
$CURL -s http://localhost:3000/es/ | grep -E '<html lang|og:locale'
```

Expected:
- `/en/`: `<html lang="en">` and `<meta property="og:locale" content="en_US" />`
- `/es/`: `<html lang="es-MX">` and `<meta property="og:locale" content="es_MX" />`

If the OG locale is wrong, that's a content/template bug — fix `content/pages/home.json`'s `meta.og_locale_primary` and re-build. (It was set correctly in PR 1, so this should pass without fix.)

- [ ] **Step 8: Stop the dev server**

```bash
pkill -f "vercel dev"
```

- [ ] **Step 9: No commit — verification only**

If anything failed, fix the underlying file (`vercel.json` regex, `home.json` meta, etc.) and re-run.

---

## Task 4: Push, PR, deploy

- [ ] **Step 1: Push the branch**

```bash
git status
git log --oneline -6
git push -u origin feat/pr3-root-redirect
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base main --head feat/pr3-root-redirect --repo ninjackster/sjdg-community-site \
  --title "feat: PR 3 — root / redirect by Accept-Language + delete legacy index.html" \
  --body "$(cat <<'EOF'
## Summary

Third of nine PRs in the SEO overhaul. Closes the loop on bilingual URL routing.

- \`/\` now 307-redirects to \`/en/\` or \`/es/\` based on visitor's \`Accept-Language\` header (regex matches any \`es\` tag — covers \`es\`, \`es-MX\`, \`es-419\`, etc.)
- Legacy single-language \`index.html\` deleted from repo root — it was being overshadowed by \`/en/\` and \`/es/\` anyway and had stale i18n JS
- Existing 4 legacy URL redirects from PR 2 (\`/businesses\` → \`/en/businesses\`, etc.) preserved unchanged
- Per-page hreflang and \`<html lang>\` already correct from PR 1/2 — no template changes needed

## Why 307, not 308

Visitor language preference is not permanent — they may switch via the toggle, return on a different device, or share the link with someone else. 308 would tell browsers and CDNs to cache the redirect across sessions, locking a visitor into one language. 307 keeps the redirect re-evaluated on each request.

## Test plan

- [ ] Vercel preview: \`/\` with \`Accept-Language: en-US\` → 307 to \`/en/\`
- [ ] Vercel preview: \`/\` with \`Accept-Language: es-MX\` → 307 to \`/es/\`
- [ ] Vercel preview: \`/\` with no Accept-Language → 307 to \`/en/\`
- [ ] All 10 bilingual URLs return 200
- [ ] All 4 PR 2 legacy redirects still 308 to \`/en/<slug>\`
- [ ] \`/admin-businesses\`, \`/sitemap.xml\`, \`/robots.txt\` return 200
- [ ] Browser visit from MX-language browser lands on \`/es/\` automatically

## Out of scope (later PRs)

- Per-business static pages with LocalBusiness schema (PR 4)
- Tourist intent landing pages (PR 5)
- Search Console Domain property + \`.org\` 301 redirect (PR 6)
EOF
)"
```

- [ ] **Step 3: Wait for Vercel preview deploy**

After push, Vercel auto-deploys a preview (Git is wired since end of PR 1). Watch for the preview URL via:

```bash
sleep 60
gh pr checks --repo ninjackster/sjdg-community-site $(gh pr view --json number -q .number --repo ninjackster/sjdg-community-site)
```

Or just open the PR in a browser and look for the Vercel check.

- [ ] **Step 4: Smoke-test the preview URL**

Same script as Task 3 Step 2-6 but replacing `http://localhost:3000` with the preview URL.

- [ ] **Step 5: Hand off to user for review and merge**

User squash-merges via `gh pr merge --squash`. Vercel auto-deploys main to production.

After merge, clean up worktree:
```bash
cd /tmp
git -C "/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage" worktree remove .worktrees/pr3-root-redirect
```

---

## Task 5: Submit sitemap to Search Console (manual, post-merge)

This is a one-time manual action the user takes after the PR is merged and production is live.

- [ ] **Step 1: Open Search Console**

Navigate to https://search.google.com/search-console and select the property `https://www.sanjosedegracia.net/` (or, ideally, the new Domain property — see PR 6 for setting that up).

- [ ] **Step 2: Submit the sitemap**

Left sidebar → **Sitemaps** → enter `sitemap.xml` in the "Add a new sitemap" field → **Submit**.

The sitemap should report "Success" within a few minutes. Google will start crawling the bilingual URLs over the following days.

- [ ] **Step 3: Request indexing for top URLs (optional)**

For the highest-priority pages, you can request immediate indexing:
1. Top sidebar → **URL inspection** → enter `https://www.sanjosedegracia.net/en/businesses`
2. Click **Request indexing**
3. Repeat for: `/es/negocios`, `/en/`, `/es/`, `/en/tour`, `/es/recorrido`

This jumps the crawl queue. Google typically processes within hours.

- [ ] **Step 4: Mark complete in your records**

Note the date and which URLs you submitted. Track Search Console weekly to see indexing status and impressions for Spanish queries.

---

## Self-Review Checklist (controller runs before handoff)

- [ ] Spec coverage: PR 3 row in spec → root redirect ✓, hreflang on legacy pages (legacy deleted, so moot) ✓, sitemap split (decided against, single sitemap with hreflang alternates is correct), `<html lang>` correctness (already done in PR 1, verified in Task 3) ✓
- [ ] No "TBD" / vague handwave steps
- [ ] Function/property names consistent (no functions touched in this PR — only config and one HTML deletion)
- [ ] Each implementation task ends with a commit
- [ ] No tests broken — `tests/passthrough.test.js` updated to match new file layout

## What ships in PR 3

- `/` 307-redirect by `Accept-Language` (Mexico → Spanish, others → English)
- Legacy `index.html` removed (no longer needed)
- Cleaner repo: only `admin-businesses.html` remains as a non-bilingual root file
- All routes from PRs 1–2 continue to work

## What does NOT ship in PR 3

- Per-business static pages → PR 4
- Topic / tourist landing pages → PR 5
- Search Console Domain property + `.org` redirect → PR 6
- Per-language sitemap split → not planned (current single sitemap with hreflang alternates is what Google recommends)

## Risks and mitigations

- **Wrong-language landings:** A user in MX with English browser settings will get `/en/`, and an expat in the US with Spanish browser settings will get `/es/`. The existing language toggle (preserved in base.html) handles correction. The 307 means a fresh visit will re-evaluate the header, so swapping browser language preference works immediately on next visit.
- **CDN caching:** Vercel may cache the redirect briefly per Accept-Language header value. 307 (vs 308) signals "do not cache permanently." For paranoid cases, we could add a `Vary: Accept-Language` response header — defer until we see actual caching issues.
- **Bot behavior:** Googlebot crawls with `Accept-Language: en-US` by default, so it will land on `/en/`. The hreflang tags from PR 1 ensure the Spanish version is discovered through the alternate links. Verified pattern.
