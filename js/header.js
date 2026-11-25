(() => {
  const placeholder = document.querySelector("#site-header");
  if (!placeholder) return;

  const isCartPage = window.location.pathname.includes("/pages/cart/");
  const isProductPage = window.location.pathname.includes("/pages/product/");
  const isCheckoutPage = window.location.pathname.includes("/pages/checkout/");
  const isNestedPage = isCartPage || isProductPage || isCheckoutPage;
  if (isCartPage) document.body.classList.add("cart-page-layout");
  const base = isNestedPage ? "../.." : ".";
  const searchId = isCartPage ? "cart-search" : "product-search";
  const cartLink = isCartPage ? "cart.html" : `${base}/pages/cart/cart.html`;
  const favoritesLink = isNestedPage
    ? `${base}/index.html?favorites=1#products`
    : "#products";

  placeholder.innerHTML = `
    <div class="top-strip">
      <div class="container strip-inner">
        <span>Học cùng nét nhỏ - kiến thức nhỏ, tương lai lớn!</span>
        <div>
          <span>Miễn phí vận chuyển cho đơn từ 350.000đ</span>
        </div>
      </div>
    </div>
    <header class="header">
      <div class="container header-main">
        <a class="brand" href="${base}/index.html" aria-label="Nét nhỏ">
          <span class="brand-mark">✎</span><span>nét nhỏ.</span>
        </a>
        <form class="search" id="${searchId}" role="search" aria-label="Tìm kiếm sản phẩm">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="m16 16 4 4"></path>
          </svg>
          <input
            type="search"
            placeholder="Tìm kiếm sản phẩm..."
            role="combobox"
            aria-autocomplete="list"
            aria-controls="search-suggestions-list"
            aria-expanded="false"
          />
          <div class="search-suggestions" id="search-suggestions" hidden>
            <p class="search-suggestions-status" id="search-suggestions-status" aria-live="polite"></p>
            <div class="search-suggestions-list" id="search-suggestions-list" role="listbox"></div>
            <a class="search-suggestions-more" id="search-suggestions-more"></a>
          </div>
        </form>
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

  const search = placeholder.querySelector(`#${searchId}`);
  const searchInput = search.querySelector("input");
  const suggestions = search.querySelector("#search-suggestions");
  const suggestionsStatus = search.querySelector("#search-suggestions-status");
  const suggestionsList = search.querySelector("#search-suggestions-list");
  const suggestionsMore = search.querySelector("#search-suggestions-more");
  const categoryNames = {
    notebook: "Sổ & vở",
    pen: "Bút & viết",
    color: "Màu & vẽ",
    accessory: "Túi & phụ kiện",
    stationery: "Văn phòng phẩm",
    desk: "Đồ dùng bàn học",
    gift: "Bộ quà tặng",
  };
  let searchProducts = [];

  function normalizeSearchText(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLocaleLowerCase("vi");
  }

  function closeSuggestions() {
    suggestions.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
  }

  function renderSuggestions() {
    const query = searchInput.value.trim();
    if (!query) {
      closeSuggestions();
      return;
    }

    if (searchProducts.length === 0) {
      suggestionsStatus.textContent = "Đang tải gợi ý sản phẩm...";
      suggestionsList.replaceChildren();
      suggestionsMore.hidden = true;
      suggestions.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
      return;
    }

    const normalizedQuery = normalizeSearchText(query);
    const matches = searchProducts.filter((product) => {
      const searchableText = [
        product.name,
        ...product.category.map((category) => categoryNames[category] || ""),
      ].join(" ");
      return normalizeSearchText(searchableText).includes(normalizedQuery);
    });

    suggestionsList.replaceChildren(
      ...matches.slice(0, 6).map((product) => {
        const link = document.createElement("a");
        link.className = "search-suggestion";
        link.href = `${base}/pages/product/product.html?id=${encodeURIComponent(product.id)}`;
        link.setAttribute("role", "option");

        const image = document.createElement("img");
        image.src = product.image;
        image.alt = "";
        image.loading = "lazy";

        const details = document.createElement("span");
        details.className = "search-suggestion-details";
        const name = document.createElement("strong");
        name.textContent = product.name;
        const category = document.createElement("small");
        category.textContent = product.category
          .map((item) => categoryNames[item])
          .filter(Boolean)
          .join(" · ");
        details.append(name, category);

        const price = document.createElement("strong");
        price.className = "search-suggestion-price";
        price.textContent = `${product.price.toLocaleString("vi-VN")}đ`;
        link.append(image, details, price);
        return link;
      }),
    );
    suggestionsStatus.textContent = matches.length
      ? `Gợi ý sản phẩm (${matches.length})`
      : `Không tìm thấy sản phẩm cho “${query}”.`;
    suggestionsMore.hidden = matches.length === 0;
    suggestionsMore.href = `${base}/index.html?search=${encodeURIComponent(query)}#products`;
    suggestionsMore.textContent = `Xem tất cả kết quả cho “${query}”`;
    suggestions.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  searchInput.addEventListener("input", renderSuggestions);
  searchInput.addEventListener("focus", renderSuggestions);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSuggestions();
    } else if (event.key === "ArrowDown" && !suggestions.hidden) {
      const firstSuggestion = suggestionsList.querySelector("a");
      if (firstSuggestion) {
        event.preventDefault();
        firstSuggestion.focus();
      }
    }
  });
  search.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      window.location.href = `${base}/index.html?search=${encodeURIComponent(query)}#products`;
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!search.contains(event.target)) closeSuggestions();
  });

  window.mockApi
    .getProducts({ limit: 100 })
    .then(({ products }) => {
      searchProducts = products;
      if (searchInput.value.trim()) renderSuggestions();
    })
    .catch((error) => {
      console.error("Không thể tải gợi ý tìm kiếm:", error);
      if (searchInput.value.trim()) {
        suggestionsStatus.textContent =
          "Không tải được gợi ý sản phẩm. Vui lòng thử tìm lại.";
        suggestionsList.replaceChildren();
        suggestionsMore.hidden = true;
        suggestions.hidden = false;
        searchInput.setAttribute("aria-expanded", "true");
      }
    });

  if (isCartPage) {
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
