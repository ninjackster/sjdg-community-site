(function () {
  const STORAGE_KEY = 'sjdg_admin_event_store_v2';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function seedEvents() {
    return clone(Array.isArray(window.SJDG_EVENT_CANDIDATES) ? window.SJDG_EVENT_CANDIDATES : []);
  }

  function readStored() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.events)) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function normalizeEvent(event, index) {
    return {
      candidate_id: event.candidate_id || `cand_manual_${Date.now()}_${index}`,
      source_id: event.source_id || 'manual-admin',
      fetch_job_id: event.fetch_job_id || 'manual-admin',
      post_id: event.post_id || '',
      posting_url: event.posting_url || '',
      source_url: event.source_url || '/admin',
      source_type: event.source_type || 'manual_entry',
      collected_at: event.collected_at || new Date().toISOString(),
      raw_text: event.raw_text || '',
      media_urls: Array.isArray(event.media_urls) ? event.media_urls : [],
      title: event.title || 'Untitled event',
      summary: event.summary || '',
      category: event.category || 'community',
      start_date: event.start_date || null,
      end_date: event.end_date || null,
      start_time_text: event.start_time_text || '',
      timezone: event.timezone || 'America/Mexico_City',
      venue_name: event.venue_name || '',
      venue_reference: event.venue_reference || '',
      location_scope: event.location_scope || 'town',
      organizer_name: event.organizer_name || '',
      confidence_score: typeof event.confidence_score === 'number' ? event.confidence_score : 1,
      confidence_reasons: Array.isArray(event.confidence_reasons) ? event.confidence_reasons : [],
      duplicate_fingerprint: event.duplicate_fingerprint || '',
      review_status: event.review_status || 'pending',
      review_notes: event.review_notes || ''
    };
  }

  function getEvents() {
    const stored = readStored();
    const events = stored ? stored.events : seedEvents();
    return events.map(normalizeEvent);
  }

  function getMeta() {
    const stored = readStored();
    if (stored) {
      return {
        mode: 'local',
        savedAt: stored.savedAt || null
      };
    }
    return {
      mode: 'seed',
      savedAt: window.SJDG_EVENT_CANDIDATES_UPDATED_AT || null
    };
  }

  function saveEvents(events) {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      events: events.map(normalizeEvent)
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload;
  }

  function reset() {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function exportPayload() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      events: getEvents()
    };
  }

  function importPayload(payload) {
    if (!payload || !Array.isArray(payload.events)) {
      throw new Error('Invalid import payload.');
    }
    return saveEvents(payload.events);
  }

  window.SJDG_EVENT_STORE = {
    STORAGE_KEY,
    getEvents,
    getMeta,
    saveEvents,
    reset,
    exportPayload,
    importPayload,
    normalizeEvent
  };
})();
