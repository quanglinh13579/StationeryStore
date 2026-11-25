(() => {
  const STORAGE_KEY = "stationery-favorites";
  const CHANGE_EVENT = "stationery:favorites-change";

  function getAll() {
    try {
      const storedFavorites = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(storedFavorites)) return [];
      return [
        ...new Set(storedFavorites.filter((id) => typeof id === "string")),
      ];
    } catch {
      return [];
    }
  }

  function notifyChange() {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  function toggle(id) {
    const favorites = new Set(getAll());
    const isFavorite = favorites.has(id);

    if (isFavorite) {
      favorites.delete(id);
    } else {
      favorites.add(id);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    notifyChange();
  }

  function subscribe(callback) {
    window.addEventListener(CHANGE_EVENT, callback);
    return () => window.removeEventListener(CHANGE_EVENT, callback);
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      notifyChange();
    }
  });

  window.stationeryFavorites = Object.freeze({
    getAll,
    toggle,
    subscribe,
  });
})();
