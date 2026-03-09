(function () {
  const ADMIN_TOKEN_KEY = 'sjdg_admin_api_token_v1';

  async function request(url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    let payload = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = { ok: false, error: text };
      }
    }

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Request failed with status ${response.status}.`);
    }

    return payload;
  }

  function getAdminToken() {
    try {
      return window.localStorage.getItem(ADMIN_TOKEN_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function setAdminToken(value) {
    const token = (value || '').trim();
    try {
      if (!token) {
        window.localStorage.removeItem(ADMIN_TOKEN_KEY);
      } else {
        window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
      }
    } catch (error) {
      return '';
    }
    return token;
  }

  function authHeaders() {
    const token = getAdminToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function fetchEvents() {
    return request('/api/events', {
      headers: {
        Accept: 'application/json'
      }
    });
  }

  function saveEvents(events) {
    return request('/api/events', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ events })
    });
  }

  function importFlyer(payload) {
    return request('/api/import-flyer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(payload)
    });
  }

  window.SJDG_LIVE_EVENTS_API = {
    ADMIN_TOKEN_KEY,
    getAdminToken,
    setAdminToken,
    fetchEvents,
    saveEvents,
    importFlyer
  };
})();
