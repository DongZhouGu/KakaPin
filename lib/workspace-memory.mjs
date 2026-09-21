const KEY = 'kakapin.workspace.v1';
const empty = () => ({ lastProjectId: null, places: {} });
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9-]+$/.test(value);

export function readWorkspace(storage) {
  try {
    const value = JSON.parse(storage.getItem(KEY));
    if (!value || typeof value.places !== 'object' || !value.places) return empty();
    const places = {};
    for (const [id, place] of Object.entries(value.places)) {
      if (!validId(id) || !place || typeof place !== 'object') continue;
      places[id] = {
        sceneId: typeof place.sceneId === 'string' ? place.sceneId.slice(0, 200) : null,
        offset: Number.isFinite(place.offset) ? Math.max(0, place.offset) : 0,
        openedAt: Number.isFinite(place.openedAt) ? place.openedAt : 0,
        libraryTab: ['media', 'templates', 'text'].includes(place.libraryTab) ? place.libraryTab : 'media',
        inspectorTab: place.inspectorTab === 'global' ? 'global' : 'scene',
      };
    }
    return { lastProjectId: validId(value.lastProjectId) ? value.lastProjectId : null, places };
  } catch { return empty(); }
}

export function saveWorkspacePlace(storage, id, place, opened = false) {
  if (!validId(id)) return;
  try {
    const state = readWorkspace(storage);
    state.places[id] = { ...state.places[id], ...place, openedAt: opened ? Date.now() : state.places[id]?.openedAt || Date.now() };
    if (opened) state.lastProjectId = id;
    storage.setItem(KEY, JSON.stringify(state));
  } catch { /* Editing still works when browser storage is unavailable. */ }
}
