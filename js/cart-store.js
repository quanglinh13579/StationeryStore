(() => {
  const api = window.stationeryApi;
  let items = [];
  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener(items));
  }

  function updateItems(nextItems) {
    items = nextItems;
    notify();
  }

  async function refresh() {
    if (!api.isAuthenticated()) {
      updateItems([]);
      return items;
    }
    const result = await api.getCart();
    updateItems(result.items);
    return items;
  }

  window.stationeryCart = Object.freeze({
    getItems() {
      return [...items];
    },
    getCount() {
      return items.reduce((total, item) => total + item.quantity, 0);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    async add(productId, quantity, variant = "") {
      const result = await api.addCartItem({ productId, quantity, variant });
      updateItems(result.items);
      return result;
    },
    async update(productId, quantity, variant = "") {
      const result = await api.updateCartItem(productId, { quantity, variant });
      updateItems(result.items);
      return result;
    },
    async remove(productId, variant = "") {
      const result = await api.removeCartItem(productId, variant);
      updateItems(result.items);
      return result;
    },
    async clear() {
      const result = await api.clearCart();
      updateItems([]);
      return result;
    },
  });
})();
