(() => {
  const API_BASE_URL = "http://localhost:3000/api";
  localStorage.removeItem("stationery-auth-token");
  localStorage.removeItem("authUser");

  class ApiError extends Error {
    constructor(status, message) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  async function request(path, options = {}) {
    const headers = { Accept: "application/json", ...options.headers };
    const token = sessionStorage.getItem("stationery-auth-token");
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const result =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        result?.message || "Không thể hoàn tất yêu cầu.",
      );
    }
    return result;
  }

  function withQuery(path, values) {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  window.stationeryApi = Object.freeze({
    ApiError,
    isAuthenticated() {
      return Boolean(sessionStorage.getItem("stationery-auth-token"));
    },
    logout() {
      sessionStorage.removeItem("stationery-auth-token");
      sessionStorage.removeItem("authUser");
      localStorage.removeItem("stationery-auth-token");
      localStorage.removeItem("authUser");
    },
    get(path) {
      return request(path);
    },
    post(path, body) {
      return request(path, { method: "POST", body: JSON.stringify(body) });
    },
    put(path, body) {
      return request(path, { method: "PUT", body: JSON.stringify(body) });
    },
    patch(path, body) {
      return request(path, { method: "PATCH", body: JSON.stringify(body) });
    },
    delete(path) {
      return request(path, { method: "DELETE" });
    },
    getProducts(params = {}) {
      return request(withQuery("/products", params));
    },
    getProduct(id) {
      return request(`/products/${encodeURIComponent(id)}`);
    },
    getCategories() {
      return request("/categories");
    },
    getReviews(params = {}) {
      return request(withQuery("/reviews", params));
    },
    createReview(review) {
      return request("/reviews", {
        method: "POST",
        body: JSON.stringify(review),
      });
    },
    getCart() {
      return request("/cart");
    },
    addCartItem(item) {
      return request("/cart/items", {
        method: "POST",
        body: JSON.stringify(item),
      });
    },
    updateCartItem(id, item) {
      return request(`/cart/items/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(item),
      });
    },
    removeCartItem(id, variant = "") {
      return request(
        withQuery(`/cart/items/${encodeURIComponent(id)}`, { variant }),
        { method: "DELETE" },
      );
    },
    clearCart() {
      return request("/cart", { method: "DELETE" });
    },
    getFavorites() {
      return request("/favorites");
    },
    addFavorite(id) {
      return request("/favorites", {
        method: "POST",
        body: JSON.stringify({ productId: id }),
      });
    },
    removeFavorite(id) {
      return request(`/favorites/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    createOrder(order, idempotencyKey) {
      return request("/orders", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(order),
      });
    },
  });
})();
