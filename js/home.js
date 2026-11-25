const REVIEW_PAGE_SIZE = 3;
const productGrid = document.querySelector("#product-grid");
const productsRetry = document.querySelector("#products-retry");
const productPrev = document.querySelector("#product-prev");
const productNext = document.querySelector("#product-next");
const searchInput = document.querySelector("#product-search");
const searchStatus = document.querySelector("#search-status");
const favoriteCount = document.querySelector("#favorite-count");
const favoritesToggle = document.querySelector("#favorites-toggle");
const cartCount = document.querySelector("#cart-count");

let productCards = [];
let activeFilter = "all";
let favoritesView = false;
let catalogLoading = false;
let cartItems = 0;
const favoriteIds = new Set();

const reviewGrid = document.querySelector("#review-grid");
const reviewsStatus = document.querySelector("#reviews-status");
const reviewsMore = document.querySelector("#reviews-more");
const reviewsCollapse = document.querySelector("#reviews-collapse");
let reviewCards = [];
let reviewTotal = 0;
let reviewOffset = 0;
let reviewsExpanded = false;
let reviewsInitialized = false;

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
  favoriteButton.setAttribute("aria-label", `Thêm ${product.name} vào yêu thích`);
  favoriteButton.setAttribute("aria-pressed", "false");
  favoriteButton.textContent = "♡";
  favoriteButton.addEventListener("click", () => {
    const isFavorite = favoriteIds.has(product.id);
    if (isFavorite) {
      favoriteIds.delete(product.id);
    } else {
      favoriteIds.add(product.id);
    }
    favoriteButton.setAttribute("aria-pressed", String(!isFavorite));
    favoriteButton.setAttribute(
      "aria-label",
      `${isFavorite ? "Thêm" : "Bỏ"} ${product.name} vào yêu thích`,
    );
    favoriteButton.textContent = isFavorite ? "♡" : "♥";
    updateProducts();
  });

  const image = document.createElement("img");
  image.src = product.image;
  image.alt = product.name;
  image.loading = "lazy";
  imageContainer.append(favoriteButton, image);

  const name = document.createElement("h3");
  name.textContent = product.name;

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
  addButton.addEventListener("click", () => {
    cartItems += 1;
    cartCount.textContent = String(cartItems);
    searchStatus.textContent = `Đã thêm “${product.name}” vào giỏ hàng.`;
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
  productNext.disabled = maxScroll <= 1 || productGrid.scrollLeft >= maxScroll - 1;
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

  if (favoritesView && favoriteIds.size === 0) {
    searchStatus.textContent =
      "Bạn chưa có sản phẩm yêu thích. Hãy nhấn ♡ trên sản phẩm để lưu lại.";
  } else if (filteredProducts.length === 0) {
    searchStatus.textContent = "Không tìm thấy sản phẩm phù hợp.";
  } else if (favoritesView) {
    searchStatus.textContent =
      `Đang hiển thị ${filteredProducts.length} sản phẩm yêu thích.`;
  } else if (query || activeFilter !== "all") {
    searchStatus.textContent = `Hiển thị ${filteredProducts.length} sản phẩm.`;
  } else {
    searchStatus.textContent = `Hiển thị ${filteredProducts.length} sản phẩm.`;
  }

  updateProductControls();
}

async function loadProducts() {
  if (catalogLoading) return;
  catalogLoading = true;
  productsRetry.disabled = true;
  searchStatus.textContent = "Đang tải sản phẩm...";

  try {
    const result = await window.mockApi.getProducts({ limit: 100 });
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
    searchStatus.textContent = "Tải sản phẩm không thành công. Vui lòng thử lại.";
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
    document.querySelectorAll(".tabs button").forEach((tab) => {
      tab.classList.toggle("active", tab === control);
    });
    productGrid.scrollLeft = 0;
    updateProducts();
  });
});

favoritesToggle.addEventListener("click", () => {
  favoritesView = !favoritesView;
  activeFilter = "all";
  document.querySelectorAll(".tabs button").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === "all");
  });
  productGrid.scrollLeft = 0;
  updateProducts();
});

searchInput.addEventListener("input", () => {
  productGrid.scrollLeft = 0;
  updateProducts();
});

productsRetry.addEventListener("click", loadProducts);
productGrid.addEventListener("scroll", updateProductControls, { passive: true });
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
  product.textContent = `Đã mua sản phẩm: ${review.product}`;

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
    const result = await window.mockApi.getReviews({
      offset: 0,
      limit: REVIEW_PAGE_SIZE,
    });
    reviewTotal = result.total;
    reviewCards = result.reviews.map(createReviewCard);
    reviewGrid.replaceChildren(...reviewCards);
    reviewOffset =
      result.nextOffset === null ? result.total : result.nextOffset;
    reviewsInitialized = true;
    updateReviewVisibility();
  } catch (error) {
    console.error("Không thể tải đánh giá:", error);
    reviewsStatus.textContent = "Tải đánh giá không thành công. Vui lòng thử lại.";
    reviewsMore.textContent = "Thử tải lại đánh giá";
  } finally {
    reviewsMore.disabled = false;
  }
}

async function loadNextReviewPage() {
  if (!reviewGrid || !reviewsStatus || !reviewsMore) return;
  reviewsMore.disabled = true;
  reviewsMore.textContent = "Đang tải...";
  reviewsStatus.textContent = "Đang tải thêm đánh giá...";

  try {
    const result = await window.mockApi.getReviews({
      offset: reviewOffset,
      limit: REVIEW_PAGE_SIZE,
    });
    const newCards = result.reviews.map(createReviewCard);
    reviewCards.push(...newCards);
    reviewGrid.append(...newCards);
    reviewOffset =
      result.nextOffset === null ? result.total : result.nextOffset;
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

loadProducts();
if (reviewGrid && reviewsMore) {
  loadInitialReviews();
}
