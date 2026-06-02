# Family photos

Committed portrait images for the private family tree, served at `/family-photos/<file>`
(this directory is passed through to `dist/` by `scripts/lib/passthrough.js`).

## How to add a photo
1. A relative suggests a photo via the tree's "Suggest a relative" / "Suggest a correction"
   form. It arrives in the review queue (`fam_subs`) as a resized data-URI.
2. On approval, save the image here as `<individualId>.jpg` (e.g. `I71.jpg`), reasonably
   sized (the UI shows it at 40–88px circles; ~400px square is plenty).
3. Set that person's `photo` field in `content/family/tree.json` to `"/family-photos/<id>.jpg"`.
4. Commit. The node avatar, detail card, and correction-form thumbnail will show it; people
   without a photo fall back to initials automatically.
