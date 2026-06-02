# Suggest-a-Correction on the Popout (Design)

**Date:** 2026-06-02 · **Owner:** Jaime Murillo
**Area:** popout card (`openCard`/new `openEdit` in `family-tree.js`), `/api/family-suggest.js`, new `scripts/lib/family-subs.js`.

## Goal

Let a logged-in family member suggest a correction to an existing person (fix a spelling, add a date) from that person's popout. Corrections are review-gated suggestions (never live edits), stored in the same queue as new-relative suggestions.

## Decisions

- **Editable fields:** structured, prefilled with current values — given, surnames, birth date, death date, note. No photo.
- **Storage:** same Redis hash `fam_subs`, tagged `kind:'edit'` with `targetId` + proposed fields. Surfaces in the existing `family-admin.js` review list.

## Components

**`scripts/lib/family-subs.js` (new, pure, tested).** `buildEditSubmission(body, id, ts) → { sub } | { error }`:
- Requires `body.targetId` (string) → else `{ error:'targetId required' }`.
- Requires non-empty `given` (≤60 chars) → else `{ error:'name required' }`.
- `surnames`: array or space-separated string → up to 3, each ≤40, trimmed, non-empty.
- `birth`/`death`: trimmed strings ≤40 or null.
- `note`: string ≤600 → stored as `notes:{en,es}` (same value both langs, mirroring the new-relative path).
- Returns `sub = { id, kind:'edit', status:'pending', targetId, names:{given,surnames}, birth:{date,place:null}, death:{date,place:null}, notes, ts }`.

**`/api/family-suggest.js` (extend).** After auth + storage checks: if `body.kind === 'edit'`, call `buildEditSubmission`; on `{error}` return 400; else `HSET fam_subs id JSON` and return `{ok:true}`. The existing new-relative path (no `kind` / `kind:'new'`) is unchanged.

**`family-tree.js` (client).**
- Card: add button `#ft-edit` "✎ Sugerir una corrección / Suggest a correction" under `#ft-suggest`.
- `openEdit(ind)`: modal prefilled from `ind` (given, surnames join ' ', birth.date, death.date, notes[lang]). Submit → `POST /api/family-suggest` `{ kind:'edit', targetId: ind.id, given, surnames, birth, death, note }`. Same messaging/disable-on-success as `openSuggest`. Name required (client guard mirrors API).

## Review

`family-admin.js` GET returns all `fam_subs` (edits included). Reviewer sees `kind:'edit'`, `targetId`, proposed fields; approve/reject/delete by id already work. No admin change.

## Testing

- `tests/family-subs.test.js`: valid edit → correct shape; missing targetId → error; missing given → error; surnames string "Murillo Mena" → ['Murillo','Mena']; surnames array clamp to 3; birth/death trim + null; note clamp 600.
- Browser on preview: open a card → "Suggest a correction" → change birth date → submit → "Enviado para revisión" (200).

## Rollout

Branch `feature/suggest-correction`, TDD, preview verify, pause for review before prod. Additive: one tested lib + one API branch + one client modal/button. No layout/data change.
