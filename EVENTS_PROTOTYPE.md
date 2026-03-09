# Events Prototype

Build the prototype data:

```bash
python3 scripts/build_events_prototype.py
```

Preview the site locally:

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000/events.html`

On Vercel or any host that respects [vercel.json](/Users/jaimemurillo/Desktop/SJDG%20Webpage/vercel.json), the clean route is:

- `/events`
- `/admin` for the admin console
- `/events-prototype` for the internal prototype assets page

What this prototype includes:

- Source registry for town and municipal event sources
- Browser-persisted `/admin` console for editing event records
- Fetch manifest for each source
- Normalized `event_candidate` schema
- Mock raw source records
- Generated candidate review queue on the events page
