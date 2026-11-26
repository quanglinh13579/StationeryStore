(() => {
  const api = window.stationeryApi;
  const listeners = new Set();
  let favoriteIds = new Set();

  function notify() {
    listeners.forEach((listener) => listener([...favoriteIds]));
  }

  function setFavorites(products) {
    favoriteIds = new Set(products.map((product) => product.id));
    notify();
  }

  window.stationeryFavorites = Object.freeze({
    getAll() {
      return [...favoriteIds];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async load() {
      if (!api.isAuthenticated()) {
        setFavorites([]);
        return [];
      }
      const result = await api.getFavorites();
      setFavorites(result.products);
      return [...favoriteIds];
    },
    async toggle(productId) {
      if (!api.isAuthenticated()) {
        throw new api.ApiError(401, "Đăng nhập để sử dụng danh sách yêu thích.");
      }
      const result = favoriteIds.has(productId)
        ? await api.removeFavorite(productId)
        : await api.addFavorite(productId);
      setFavorites(result.products);
    },
  });
})();
