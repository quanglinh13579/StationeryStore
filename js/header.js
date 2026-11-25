(() => {
  const placeholder = document.querySelector("#site-header");
  if (!placeholder) return;

  const isCartPage = window.location.pathname.includes("/pages/cart/");
  if (isCartPage) document.body.classList.add("cart-page-layout");
  const base = isCartPage ? "../.." : ".";
  const searchId = isCartPage ? "cart-search" : "product-search";
  const searchTag = isCartPage ? "form" : "label";
  const cartLink = isCartPage ? "cart.html" : `${base}/pages/cart/cart.html`;
  const favoritesLink = isCartPage
    ? `${base}/index.html?favorites=1#products`
    : "#products";

  placeholder.innerHTML = `
    <div class="top-strip">
      <div class="container strip-inner">
        <span>Miễn phí giao hàng từ 350.000đ</span>
        <div>
          <a href="tel:19002525">Hotline: 1900 2525</a>
          <a href="${isCartPage ? `${base}/index.html#store` : "#store"}">Địa chỉ cửa hàng</a>
        </div>
      </div>
    </div>
    <header class="header">
      <div class="container header-main">
        <a class="brand" href="${base}/index.html" aria-label="Nét nhỏ">
          <span class="brand-mark">✎</span><span>nét nhỏ.</span>
        </a>
        <${searchTag} class="search" id="${searchId}" ${isCartPage ? 'role="search"' : 'aria-label="Tìm kiếm sản phẩm"'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="m16 16 4 4"></path>
          </svg>
          <input type="search" placeholder="Tìm kiếm sản phẩm..." />
        </${searchTag}>
        <div class="header-actions">
          <a href="${base}/pages/auth/login.html">
            <img src="${base}/assets/icons/login-icon.svg" alt="Login" width="20" height="20" class="action-icon" />
            <span>Đăng nhập</span>
          </a>
          <a id="favorites-toggle" href="${favoritesLink}" aria-label="Chỉ xem sản phẩm yêu thích" aria-pressed="false">
            <span class="action-icon">♡</span>
            <span>Yêu thích</span>
            <b id="favorite-count">0</b>
          </a>
          <a href="${cartLink}" aria-label="Giỏ hàng">
            <img src="${base}/assets/icons/cart-icon.svg" alt="Cart" width="20" height="20" class="action-icon" />
            <span>Giỏ hàng</span>
            <b id="cart-count">0</b>
          </a>
        </div>
      </div>
      <nav class="container nav">
        <a href="${base}/index.html#products" data-filter="all">Tất cả sản phẩm</a>
        <a href="${base}/index.html#products" data-filter="notebook">Sổ &amp; vở</a>
        <a href="${base}/index.html#products" data-filter="pen">Bút &amp; viết</a>
        <a href="${base}/index.html#products" data-filter="stationery">Văn phòng phẩm</a>
        <a href="${base}/index.html#products" data-filter="accessory">Thời trang</a>
        <a href="${base}/index.html#categories">Đồ chơi học tập</a>
        <a class="nav-highlight" href="${base}/index.html#products" data-filter="sale">Ưu đãi hôm nay</a>
      </nav>
    </header>
  `;

  const favoriteCount = placeholder.querySelector("#favorite-count");
  const updateFavoriteCount = () => {
    favoriteCount.textContent = String(
      window.stationeryFavorites.getAll().length,
    );
  };
  updateFavoriteCount();
  window.stationeryFavorites.subscribe(updateFavoriteCount);

  if (isCartPage) {
    const search = placeholder.querySelector("#cart-search");
    search.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = search.querySelector("input").value.trim();
      window.location.href = `${base}/index.html${query ? `?search=${encodeURIComponent(query)}#products` : "#products"}`;
    });

    try {
      const cart = JSON.parse(localStorage.getItem("stationery-cart"));
      const count = Array.isArray(cart)
        ? cart.reduce((total, item) => total + item.quantity, 0)
        : 0;
      const cartCount = placeholder.querySelector("#cart-count");
      if (cartCount) cartCount.textContent = String(count);
    } catch {}
  }
})();
