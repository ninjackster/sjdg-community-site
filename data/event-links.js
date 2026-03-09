(function () {
  function isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value);
  }

  function parseUrl(value) {
    try {
      return new URL(value, window.location.origin);
    } catch (error) {
      return null;
    }
  }

  function buildFacebookPostingUrl(sourceUrl, postId) {
    if (!sourceUrl || !postId) return '';
    const parsed = parseUrl(sourceUrl);
    if (!parsed) return '';

    const host = 'https://www.facebook.com';
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts[0] === 'groups' && pathParts[1]) {
      return `${host}/groups/${pathParts[1]}/posts/${encodeURIComponent(postId)}/`;
    }

    if (parsed.pathname === '/profile.php') {
      const id = parsed.searchParams.get('id');
      if (id) {
        return `${host}/permalink.php?story_fbid=${encodeURIComponent(postId)}&id=${encodeURIComponent(id)}`;
      }
    }

    if (pathParts[0]) {
      return `${host}/${pathParts[0]}/posts/${encodeURIComponent(postId)}`;
    }

    return `${host}/posts/${encodeURIComponent(postId)}`;
  }

  function resolvePostingUrl(event, registry) {
    if (!event) return '#';

    const source = Array.isArray(registry) ? registry.find((item) => item.id === event.source_id) : null;
    const sourceUrl = event.source_url || (source ? source.url : '');
    const postingUrl = isHttpUrl(event.posting_url) ? event.posting_url : '';
    const platform = source ? source.platform : '';
    const explicitMatchesSource = postingUrl && sourceUrl && postingUrl === sourceUrl;

    if (event.post_id && (platform === 'facebook' || /facebook\.com/i.test(sourceUrl))) {
      const facebookUrl = buildFacebookPostingUrl(sourceUrl, event.post_id);
      if (facebookUrl && (!postingUrl || explicitMatchesSource)) return facebookUrl;
    }

    return postingUrl || (isHttpUrl(sourceUrl) ? sourceUrl : '') || '#';
  }

  window.SJDG_EVENT_LINKS = {
    buildFacebookPostingUrl,
    resolvePostingUrl
  };
})();
