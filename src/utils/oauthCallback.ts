export function normalizeOAuthCallbackPath() {
  if (window.location.pathname !== '/auth/callback') return;
  const search = new URLSearchParams(window.location.search);
  search.set('view', 'app');
  window.history.replaceState({}, '', `/?${search.toString()}${window.location.hash}`);
}
