# Family Tree — Manual Preview-Deploy Verification Checklist

This checklist covers the reviewer's manual verification on a Vercel preview deploy.
The automated tests and local build are green; the items below require a running
deployment with cookies, auth, and the protected API.

## Setup
- Deploy the `feature/family-tree` branch to a Vercel **preview**.
- Set the following environment variables on the preview deployment:
  - `FAMILY_TREE_PASSWORD` — the shared access password.
  - `FAMILY_TREE_SECRET` — the secret used to sign/verify the auth cookie.

## Checks — visit `/es/familia`
- [ ] **(a) Wrong password shows the error.** Enter an incorrect password and click
  Enter. The `#ft-error` message (localized "wrong password" text) appears and the
  tree stays hidden.
- [ ] **(b) Correct password reveals the tree.** Enter the correct
  `FAMILY_TREE_PASSWORD`. The login panel hides, `#ft-canvas` shows, and the
  pedigree renders with clickable nodes (drawer opens on click).
- [ ] **(c) Cookie-gated API returns 401 with no cookie.** In a fresh incognito
  session (no auth cookie), request `GET /api/family-tree` directly. It returns
  HTTP 401 — the tree JSON is never served without a valid signed cookie.
- [ ] **(d) No names inlined in page source.** View-source of `/es/familia` (and
  `/en/family`) contains **NO** individual names. The tree data is fetched at
  runtime from the protected API, not inlined into the static HTML.
- [ ] **(e) Page is not indexable.** The page `<head>` contains
  `<meta name="robots" content="noindex, nofollow">`.

## Notes
- `family-tree.js` is served statically from the site root (copied to
  `dist/family-tree.js` by the build's passthrough step) and loaded via
  `<script src="/family-tree.js" defer>`.
- The same flow applies to the English route `/en/family`.
