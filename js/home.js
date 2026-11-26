const REVIEW_PAGE_SIZE = 3;
const productGrid = document.querySelector("#product-grid");
const productsRetry = document.querySelector("#products-retry");
const productPrev = document.querySelector("#product-prev");
const productNext = document.querySelector("#product-next");
const searchInput = document.querySelector("#product-search input");
searchInput.value =
  new URLSearchParams(window.location.search).get("search") || "";
const searchStatus = document.querySelector("#search-status");
const favoriteCount = document.querySelector("#favorite-count");
const favoritesToggle = document.querySelector("#favorites-toggle");
const favoriteStore = window.stationeryFavorites;

let productCards = [];
let activeFilter = "all";
let favoritesView =
  new URLSearchParams(window.location.search).get("favorites") === "1";
let catalogLoading = false;
const favoriteIds = new Set(favoriteStore.getAll());

const reviewGrid = document.querySelector("#review-grid");
const reviewsStatus = document.querySelector("#reviews-status");
const reviewsMore = document.querySelector("#reviews-more");
const reviewsCollapse = document.querySelector("#reviews-collapse");
let reviewCards = [];
let reviewTotal = 0;
let reviewOffset = 0;
let reviewsExpanded = false;
let reviewsInitialized = false;

function showProductActionError(error, authMessage) {
  const message = error.status === 401 ? authMessage : error.message;
  if (error.status === 401) window.stationeryAuthPrompt.show(message);
  searchStatus.textContent = message;
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.dataset.category = product.category.join(" ");
  card.dataset.popular = String(product.popular);
  card.dataset.sale = String(product.sale);
  card.dataset.latest = String(product.latest);
  card.dataset.productId = product.id;

  const imageContainer = document.createElement("div");
  imageContainer.className = "product-image";
  const favoriteButton = document.createElement("button");
  favoriteButton.className = "heart";
  favoriteButton.type = "button";
  const isInitiallyFavorite = favoriteIds.has(product.id);
  favoriteButton.setAttribute(
    "aria-label",
    `${isInitiallyFavorite ? "Bỏ" : "Thêm"} ${product.name} ${isInitiallyFavorite ? "khỏi" : "vào"} yêu thích`,
  );
  favoriteButton.setAttribute("aria-pressed", String(isInitiallyFavorite));
  favoriteButton.textContent = isInitiallyFavorite ? "♥" : "♡";
  favoriteButton.addEventListener("click", async () => {
    try {
      await favoriteStore.toggle(product.id);
    } catch (error) {
      showProductActionError(error, "Đăng nhập để lưu sản phẩm yêu thích.");
    }
  });

  const image = document.createElement("img");
  image.src = product.image;
  image.alt = product.name;
  image.loading = "lazy";
  const detailLink = document.createElement("a");
  detailLink.href = `pages/product/product.html?id=${encodeURIComponent(product.id)}`;
  detailLink.setAttribute("aria-label", `Xem chi tiết ${product.name}`);
  detailLink.append(image);
  imageContainer.append(favoriteButton, detailLink);

  const name = document.createElement("h3");
  const nameLink = document.createElement("a");
  nameLink.href = detailLink.href;
  nameLink.textContent = product.name;
  name.append(nameLink);

  const rating = document.createElement("p");
  rating.className = "rating";
  rating.append(
    document.createTextNode(
      `${"★".repeat(Math.round(product.rating))}${"☆".repeat(5 - Math.round(product.rating))} `,
    ),
  );
  const reviewCount = document.createElement("a");
  reviewCount.className = "review-count";
  reviewCount.href = "#reviews";
  reviewCount.textContent = `(${product.reviewCount})`;
  rating.append(reviewCount);

  const price = document.createElement("div");
  price.className = "price";
  const currentPrice = document.createElement("strong");
  currentPrice.textContent = `${product.price.toLocaleString("vi-VN")}đ`;
  price.append(currentPrice);
  if (product.originalPrice) {
    const originalPrice = document.createElement("del");
    originalPrice.textContent = `${product.originalPrice.toLocaleString("vi-VN")}đ`;
    price.append(originalPrice);
  }

  const addButton = document.createElement("button");
  addButton.className = "add-cart";
  addButton.type = "button";
  addButton.setAttribute("aria-label", `Thêm ${product.name} vào giỏ hàng`);
  addButton.textContent = "＋";
  addButton.disabled = product.stock < 1;
  addButton.addEventListener("click", async () => {
    try {
      await window.stationeryCart.add(product.id, 1);
      searchStatus.textContent = `Đã thêm “${product.name}” vào giỏ hàng.`;
    } catch (error) {
      showProductActionError(error, "Đăng nhập để thêm sản phẩm vào giỏ hàng.");
    }
  });
  price.append(addButton);

  card.append(imageContainer, name, rating, price);
  return card;
}

function matchesCurrentFilter(product) {
  return (
    activeFilter === "all" ||
    (activeFilter === "latest" && product.latest) ||
    (activeFilter === "popular" && product.popular) ||
    (activeFilter === "sale" && product.sale) ||
    product.category.includes(activeFilter)
  );
}

function updateProductControls() {
  const maxScroll = productGrid.scrollWidth - productGrid.clientWidth;
  productPrev.disabled = productGrid.scrollLeft <= 1;
  productNext.disabled =
    maxScroll <= 1 || productGrid.scrollLeft >= maxScroll - 1;
}

function updateProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase("vi");
  const filteredProducts = productCards.filter(({ product }) => {
    return (
      matchesCurrentFilter(product) &&
      (!favoritesView || favoriteIds.has(product.id)) &&
      product.name.toLocaleLowerCase("vi").includes(query)
    );
  });
  const visibleCards = new Set(filteredProducts.map(({ card }) => card));

  productCards.forEach(({ card }) => {
    card.hidden = !visibleCards.has(card);
  });

  favoriteCount.textContent = String(favoriteIds.size);
  favoritesToggle.setAttribute("aria-pressed", String(favoritesView));
  favoritesToggle.setAttribute(
    "aria-label",
    favoritesView ? "Hiển thị tất cả sản phẩm" : "Chỉ xem sản phẩm yêu thích",
  );

  if (favoritesView && !window.stationeryApi.isAuthenticated()) {
    searchStatus.textContent =
      "Đăng nhập để xem danh sách sản phẩm yêu thích của bạn.";
  } else if (favoritesView && favoriteIds.size === 0) {
    searchStatus.textContent =
      "Bạn chưa có sản phẩm yêu thích. Hãy nhấn ♡ trên sản phẩm để lưu lại.";
  } else if (filteredProducts.length === 0) {
    searchStatus.textContent = "Không tìm thấy sản phẩm phù hợp.";
  } else if (favoritesView) {
    searchStatus.textContent = `Đang hiển thị ${filteredProducts.length} sản phẩm yêu thích.`;
  } else if (query || activeFilter !== "all") {
    searchStatus.textContent = `Hiển thị ${filteredProducts.length} sản phẩm.`;
  } else {
    searchStatus.textContent = `Hiển thị ${filteredProducts.length} sản phẩm.`;
  }

  updateProductControls();
}

function updateFavoriteButtons() {
  productCards.forEach(({ product, card }) => {
    const button = card.querySelector(".heart");
    const isFavorite = favoriteIds.has(product.id);
    button.setAttribute("aria-pressed", String(isFavorite));
    button.setAttribute(
      "aria-label",
      isFavorite
        ? `Bỏ ${product.name} khỏi yêu thích`
        : `Thêm ${product.name} vào yêu thích`,
    );
    button.textContent = isFavorite ? "♥" : "♡";
  });
}

favoriteStore.subscribe(() => {
  favoriteIds.clear();
  favoriteStore.getAll().forEach((id) => favoriteIds.add(id));
  updateFavoriteButtons();
  updateProducts();
});

async function loadProducts() {
  if (catalogLoading) return;
  catalogLoading = true;
  productsRetry.disabled = true;
  searchStatus.textContent = "Đang tải sản phẩm...";

  try {
    const [result, categories] = await Promise.all([
      window.stationeryApi.getProducts({ limit: 100 }),
      window.stationeryApi.getCategories(),
    ]);
    try {
      await favoriteStore.load();
    } catch (error) {
      console.error("Không thể tải danh sách yêu thích:", error);
    }
    categories.categories.forEach((category) => {
      const count = document.querySelector(
        `[data-category-count="${category.slug}"]`,
      );
      if (count) count.textContent = String(category.productsCount);
    });
    productGrid.replaceChildren();
    productCards = result.products.map((product) => {
      const card = createProductCard(product);
      productGrid.append(card);
      return { product, card };
    });
    productsRetry.hidden = true;
    updateProducts();
  } catch (error) {
    console.error("Không thể tải sản phẩm:", error);
    searchStatus.textContent =
      "Tải sản phẩm không thành công. Vui lòng thử lại.";
    productsRetry.hidden = false;
  } finally {
    catalogLoading = false;
    productsRetry.disabled = false;
  }
}

document.querySelectorAll("[data-filter]").forEach((control) => {
  control.addEventListener("click", () => {
    activeFilter = control.dataset.filter;
    favoritesView = false;
    const url = new URL(window.location.href);
    url.searchParams.delete("favorites");
    window.history.replaceState({}, "", url);
    document.querySelectorAll(".tabs button").forEach((tab) => {
      tab.classList.toggle("active", tab === control);
    });
    productGrid.scrollLeft = 0;
    updateProducts();
  });
});

favoritesToggle.addEventListener("click", (event) => {
  event.preventDefault();
  favoritesView = true;
  activeFilter = "all";
  const url = new URL(window.location.href);
  url.searchParams.set("favorites", "1");
  window.history.replaceState({}, "", url);
  document.querySelectorAll(".tabs button").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === "all");
  });
  productGrid.scrollLeft = 0;
  updateProducts();
  document.querySelector("#products")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

searchInput.addEventListener("input", () => {
  productGrid.scrollLeft = 0;
  updateProducts();
});

productsRetry.addEventListener("click", loadProducts);
productGrid.addEventListener("scroll", updateProductControls, {
  passive: true,
});
productPrev.addEventListener("click", () => {
  productGrid.scrollBy({
    left: -productGrid.clientWidth * 0.8,
    behavior: "smooth",
  });
});
productNext.addEventListener("click", () => {
  productGrid.scrollBy({
    left: productGrid.clientWidth * 0.8,
    behavior: "smooth",
  });
});
window.addEventListener("resize", updateProductControls);

function createReviewCard(review) {
  const card = document.createElement("article");
  const stars = document.createElement("strong");
  stars.textContent = "★".repeat(review.rating);

  const comment = document.createElement("p");
  comment.textContent = review.comment;

  const customer = document.createElement("div");
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = Array.from(review.name)[0];

  const details = document.createElement("div");
  const name = document.createElement("b");
  name.textContent = review.name;
  const product = document.createElement("small");
  product.textContent = `Sản phẩm: ${review.product}`;

  details.append(name, product);
  customer.append(avatar, details);
  card.append(stars, comment, customer);
  return card;
}

function updateReviewVisibility() {
  if (!reviewGrid || !reviewsStatus || !reviewsMore || !reviewsCollapse) return;
  reviewCards.forEach((card, index) => {
    card.hidden = !reviewsExpanded && index >= REVIEW_PAGE_SIZE;
  });
  reviewsStatus.textContent = reviewsExpanded
    ? `Đang hiển thị ${reviewCards.length} / ${reviewTotal} đánh giá.`
    : `Đang hiển thị ${Math.min(reviewCards.length, REVIEW_PAGE_SIZE)} / ${reviewTotal} đánh giá.`;
  reviewsMore.hidden =
    reviewTotal <= REVIEW_PAGE_SIZE ||
    (reviewsExpanded && reviewOffset >= reviewTotal);
  reviewsMore.textContent =
    reviewOffset >= reviewTotal && reviewCards.length > REVIEW_PAGE_SIZE
      ? "Xem tất cả đánh giá"
      : "Xem thêm đánh giá";
  reviewsCollapse.hidden = !reviewsExpanded;
}

async function loadInitialReviews() {
  if (!reviewGrid || !reviewsStatus || !reviewsMore || !reviewsCollapse) return;
  reviewsMore.disabled = true;
  reviewsMore.hidden = false;
  reviewsMore.textContent = "Đang tải đánh giá...";
  reviewsStatus.textContent = "Đang tải đánh giá...";

  try {
    const result = await window.stationeryApi.getReviews({
      page: 1,
      limit: REVIEW_PAGE_SIZE,
    });
    reviewTotal = result.total;
    reviewCards = result.reviews.map(createReviewCard);
    reviewGrid.replaceChildren(...reviewCards);
    reviewOffset = result.reviews.length;
    reviewsInitialized = true;
    updateReviewVisibility();
  } catch (error) {
    console.error("Không thể tải đánh giá:", error);
    reviewsStatus.textContent =
      "Tải đánh giá không thành công. Vui lòng thử lại.";
    reviewsMore.textContent = "Thử tải lại đánh giá";
  } finally {
    reviewGrid.setAttribute("aria-busy", "false");
    reviewsMore.disabled = false;
  }
}

async function loadNextReviewPage() {
  if (!reviewGrid || !reviewsStatus || !reviewsMore) return;
  reviewsMore.disabled = true;
  reviewsMore.textContent = "Đang tải...";
  reviewsStatus.textContent = "Đang tải thêm đánh giá...";

  try {
    const result = await window.stationeryApi.getReviews({
      page: Math.floor(reviewOffset / REVIEW_PAGE_SIZE) + 1,
      limit: REVIEW_PAGE_SIZE,
    });
    const newCards = result.reviews.map(createReviewCard);
    reviewCards.push(...newCards);
    reviewGrid.append(...newCards);
    reviewOffset += result.reviews.length;
    reviewsExpanded = true;
    updateReviewVisibility();
  } catch (error) {
    console.error("Không thể tải thêm đánh giá:", error);
    reviewsStatus.textContent =
      "Tải thêm đánh giá không thành công. Bấm thử lại để tiếp tục.";
    reviewsMore.textContent = "Thử tải lại đánh giá";
  } finally {
    reviewsMore.disabled = false;
  }
}

if (reviewsMore) {
  reviewsMore.addEventListener("click", () => {
    if (!reviewsInitialized) {
      loadInitialReviews();
    } else if (reviewOffset < reviewTotal) {
      loadNextReviewPage();
    } else {
      reviewsExpanded = true;
      updateReviewVisibility();
    }
  });
}

if (reviewsCollapse) {
  reviewsCollapse.addEventListener("click", () => {
    reviewsExpanded = false;
    updateReviewVisibility();
  });
}

window.addEventListener("stationery:review-created", () => {
  loadInitialReviews();
  loadProducts();
});

loadProducts();
if (reviewGrid && reviewsMore) {
  loadInitialReviews();
}
