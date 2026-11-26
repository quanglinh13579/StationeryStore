const productId = new URLSearchParams(window.location.search).get("id");
const productStatus = document.querySelector("#product-page-status");
const productContent = document.querySelector("#product-detail-content");
const cartCount = document.querySelector("#cart-count");
const favoriteStore = window.stationeryFavorites;
const cartStore = window.stationeryCart;
const productColors = [
  { name: "Xanh cobalt", value: "#286db3" },
  { name: "Cam đất", value: "#ec7846" },
  { name: "Xanh sage", value: "#9baa86" },
];

let currentProduct = null;
let allProducts = [];
let selectedColor = "";

function formatPrice(price) {
  return `${price.toLocaleString("vi-VN")}đ`;
}

function formatRating(rating) {
  const roundedRating = Math.round(rating);
  return `${"★".repeat(roundedRating)}${"☆".repeat(5 - roundedRating)}`;
}

function showProductActionError(error, authMessage) {
  const status = document.querySelector("#detail-cart-status");
  const message = error.status === 401 ? authMessage : error.message;
  if (error.status === 401) window.stationeryAuthPrompt.show(message);
  status.textContent = message;
}

function getCategoryName(product) {
  const names = {
    notebook: "Sổ & vở",
    pen: "Bút viết",
    color: "Màu & vẽ",
    accessory: "Túi & phụ kiện",
    stationery: "Văn phòng phẩm",
    desk: "Văn phòng phẩm",
    gift: "Bộ quà tặng",
  };
  return names[product.category[0]] || "Văn phòng phẩm";
}

function getDescription(product) {
  return product.description;
}

function updateCartCount() {
  cartCount.textContent = String(cartStore.getCount());
}

function updateFavoriteButtons() {
  document.querySelectorAll("[data-favorite-product-id]").forEach((button) => {
    const isFavorite = favoriteStore
      .getAll()
      .includes(button.dataset.favoriteProductId);
    const productName = button.dataset.favoriteProductName || "sản phẩm";
    button.setAttribute("aria-pressed", String(isFavorite));
    button.setAttribute(
      "aria-label",
      isFavorite
        ? `Bỏ ${productName} khỏi yêu thích`
        : `Thêm ${productName} vào yêu thích`,
    );
    button.textContent = isFavorite ? "♥" : "♡";
  });
}

async function addToCart(product, quantity, variant = "") {
  await cartStore.add(product.id, quantity, variant);
  updateCartCount();
}

function renderGallery(product) {
  const image = document.querySelector("#detail-image");
  image.src = product.image;
  image.alt = product.name;

  const thumbnail = document.createElement("button");
  thumbnail.className = "detail-thumbnail active";
  thumbnail.type = "button";
  thumbnail.setAttribute("aria-label", `Xem ảnh ${product.name}`);
  const thumbnailImage = document.createElement("img");
  thumbnailImage.src = product.image;
  thumbnailImage.alt = "";
  thumbnail.append(thumbnailImage);
  thumbnail.addEventListener("click", () => {
    image.src = product.image;
    document
      .querySelectorAll(".detail-thumbnail")
      .forEach((item) => item.classList.toggle("active", item === thumbnail));
  });
  document.querySelector("#detail-thumbnails").append(thumbnail);
}

function renderColorOptions(product) {
  if (!product.category.includes("notebook")) return;

  selectedColor = productColors[0].name;
  const container = document.querySelector("#detail-color-options");
  const colorList = document.querySelector("#detail-color-list");
  container.hidden = false;
  document.querySelector("#selected-color").textContent = selectedColor;

  productColors.forEach((color) => {
    const button = document.createElement("button");
    button.className = "detail-color-option";
    button.type = "button";
    button.setAttribute("aria-label", color.name);
    button.setAttribute("aria-pressed", String(color.name === selectedColor));
    const swatch = document.createElement("span");
    swatch.style.backgroundColor = color.value;
    button.append(swatch);
    button.addEventListener("click", () => {
      selectedColor = color.name;
      document.querySelector("#selected-color").textContent = color.name;
      colorList.querySelectorAll(".detail-color-option").forEach((option) => {
        option.setAttribute(
          "aria-pressed",
          String(option.getAttribute("aria-label") === selectedColor),
        );
      });
    });
    colorList.append(button);
  });

  document.querySelector("#detail-size-line").hidden = false;
  document.querySelector("#detail-size").textContent = "A5";
}

function renderSpecifications(product) {
  const specifications = [
    ["Mã sản phẩm", product.id.toUpperCase()],
    ["Danh mục", getCategoryName(product)],
    ["Đánh giá", `${product.rating} / 5 (${product.reviewCount} lượt)`],
    [
      "Quy cách",
      product.category.includes("notebook") ? "Khổ A5" : "Tiêu chuẩn",
    ],
    [
      "Tình trạng",
      product.stock > 0 ? `Còn hàng (${product.stock})` : "Hết hàng",
    ],
  ];
  const list = document.querySelector("#specification-list");

  specifications.forEach(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    row.append(term, description);
    list.append(row);
  });
}

function renderProduct(product) {
  currentProduct = product;
  document.title = `${product.name} | Nét nhỏ.`;
  document.querySelector("#breadcrumb-product").textContent = product.name;
  document.querySelector("#detail-category").textContent =
    getCategoryName(product);
  document.querySelector("#detail-name").textContent = product.name;
  document.querySelector("#detail-stars").textContent = formatRating(
    product.rating,
  );
  document.querySelector("#detail-rating").textContent =
    product.rating.toFixed(1);
  document.querySelector("#detail-review-count").textContent =
    `${product.reviewCount} đánh giá`;
  document.querySelector("#detail-price").textContent = formatPrice(
    product.price,
  );
  document.querySelector("#detail-description").textContent =
    getDescription(product);
  document.querySelector("#description-heading").textContent = product.name;
  document.querySelector("#description-copy").textContent =
    `${getDescription(product)} Sản phẩm được đóng gói cẩn thận trước khi giao đến bạn.`;
  document.querySelector("#review-average").textContent = product.rating
    .toFixed(1)
    .replace(".", ",");
  document.querySelector("#review-average-stars").textContent = formatRating(
    product.rating,
  );
  document.querySelector("#review-summary-count").textContent =
    `${product.reviewCount} đánh giá`;
  document.querySelector("#review-list-count").textContent =
    `${product.reviewCount} đánh giá`;
  document.querySelector("#tab-review-count").textContent = String(
    product.reviewCount,
  );
  const reviewForm = document.querySelector("[data-review-form]");
  if (reviewForm) reviewForm.dataset.reviewProductId = product.id;
  const detailFavorite = document.querySelector("#detail-favorite");
  detailFavorite.dataset.favoriteProductId = product.id;
  detailFavorite.dataset.favoriteProductName = product.name;

  const originalPrice = document.querySelector("#detail-original-price");
  const discount = document.querySelector("#detail-discount");
  const saleBadge = document.querySelector("#detail-sale-badge");
  if (product.originalPrice) {
    const discountPercent = Math.round(
      ((product.originalPrice - product.price) / product.originalPrice) * 100,
    );
    originalPrice.textContent = formatPrice(product.originalPrice);
    originalPrice.hidden = false;
    discount.textContent = `-${discountPercent}%`;
    discount.hidden = false;
    saleBadge.textContent = `-${discountPercent}%`;
    saleBadge.hidden = false;
  }

  renderGallery(product);
  renderColorOptions(product);
  renderSpecifications(product);
  const stockLabel = document.querySelector(".detail-stock");
  const stockIcon = stockLabel.querySelector("i");
  stockLabel.replaceChildren(
    stockIcon,
    document.createTextNode(
      product.stock > 0 ? `Còn hàng (${product.stock})` : "Hết hàng",
    ),
  );
  const addButton = document.querySelector("#detail-add-cart");
  const buyButton = document.querySelector("#detail-buy-now");
  const quantityInput = document.querySelector("#quantity");
  quantityInput.max = String(product.stock);
  addButton.disabled = product.stock < 1;
  buyButton.disabled = product.stock < 1;
  renderReviewBars(product.reviewCount);
  renderRelatedProducts(product);
  updateFavoriteButtons();
  updateCartCount();
  productStatus.hidden = true;
  productContent.hidden = false;
}

function renderReviewBars(reviewCount) {
  const bars = document.querySelector("#review-bars");
  bars.replaceChildren();
  [5, 4, 3, 2, 1].forEach((rating, index) => {
    const row = document.createElement("div");
    row.className = "review-bar-row";
    const label = document.createElement("span");
    label.textContent = `${rating}★`;
    const track = document.createElement("div");
    track.className = "review-bar-track";
    const fill = document.createElement("span");
    fill.style.width = `${[78, 16, 4, 1, 1][index]}%`;
    track.append(fill);
    const count = document.createElement("span");
    count.textContent = String(
      Math.round(reviewCount * [0.78, 0.16, 0.04, 0.01, 0.01][index]),
    );
    row.append(label, track, count);
    bars.append(row);
  });
}

function updateReviewSummary(product) {
  document.querySelector("#detail-stars").textContent = formatRating(
    product.rating,
  );
  document.querySelector("#detail-rating").textContent =
    product.rating.toFixed(1);
  document.querySelector("#detail-review-count").textContent =
    `${product.reviewCount} đánh giá`;
  document.querySelector("#review-average").textContent = product.rating
    .toFixed(1)
    .replace(".", ",");
  document.querySelector("#review-average-stars").textContent = formatRating(
    product.rating,
  );
  document.querySelector("#review-summary-count").textContent =
    `${product.reviewCount} đánh giá`;
  document.querySelector("#review-list-count").textContent =
    `${product.reviewCount} đánh giá`;
  document.querySelector("#tab-review-count").textContent = String(
    product.reviewCount,
  );
  renderReviewBars(product.reviewCount);
}

async function addProductToCart(buyNow = false) {
  if (!currentProduct) return;
  const selectedQuantity = Math.max(
    1,
    Math.floor(Number(document.querySelector("#quantity").value) || 1),
  );
  const variant = selectedColor;
  const status = document.querySelector("#detail-cart-status");
  try {
    await addToCart(currentProduct, selectedQuantity, variant);
    status.textContent = `Đã thêm ${selectedQuantity} sản phẩm vào giỏ hàng.`;
    if (buyNow) {
      window.location.href = "../../pages/cart/cart.html";
    }
  } catch (error) {
    showProductActionError(error, "Đăng nhập để thêm sản phẩm vào giỏ hàng.");
  }
}

function createRelatedCard(product) {
  const card = document.createElement("article");
  card.className = "related-card";

  const imageContainer = document.createElement("div");
  imageContainer.className = "related-card-image";
  const imageLink = document.createElement("a");
  imageLink.href = `product.html?id=${encodeURIComponent(product.id)}`;
  imageLink.setAttribute("aria-label", `Xem chi tiết ${product.name}`);
  const image = document.createElement("img");
  image.src = product.image;
  image.alt = product.name;
  image.loading = "lazy";
  imageLink.append(image);

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "related-card-favorite";
  favoriteButton.type = "button";
  favoriteButton.dataset.favoriteProductId = product.id;
  favoriteButton.dataset.favoriteProductName = product.name;
  favoriteButton.addEventListener("click", async () => {
    try {
      await favoriteStore.toggle(product.id);
    } catch (error) {
      showProductActionError(error, "Đăng nhập để lưu sản phẩm yêu thích.");
    }
  });
  imageContainer.append(imageLink, favoriteButton);

  const name = document.createElement("h3");
  const nameLink = document.createElement("a");
  nameLink.href = imageLink.href;
  nameLink.textContent = product.name;
  name.append(nameLink);

  const rating = document.createElement("p");
  rating.className = "related-card-rating";
  rating.append(
    document.createTextNode(formatRating(product.rating)),
    Object.assign(document.createElement("span"), {
      textContent: `(${product.reviewCount})`,
    }),
  );

  const price = document.createElement("div");
  price.className = "related-card-price";
  const currentPrice = document.createElement("strong");
  currentPrice.textContent = formatPrice(product.price);
  price.append(currentPrice);
  if (product.originalPrice) {
    const originalPrice = document.createElement("del");
    originalPrice.textContent = formatPrice(product.originalPrice);
    price.append(originalPrice);
  }

  const addButton = document.createElement("button");
  addButton.className = "related-card-add";
  addButton.type = "button";
  addButton.setAttribute("aria-label", `Thêm ${product.name} vào giỏ hàng`);
  addButton.textContent = "＋";
  addButton.disabled = product.stock < 1;
  addButton.addEventListener("click", async () => {
    try {
      await addToCart(product, 1);
      document.querySelector("#detail-cart-status").textContent =
        `Đã thêm “${product.name}” vào giỏ hàng.`;
    } catch (error) {
      showProductActionError(error, "Đăng nhập để thêm sản phẩm vào giỏ hàng.");
    }
  });
  price.append(addButton);

  card.append(imageContainer, name, rating, price);
  return card;
}

function renderRelatedProducts(product) {
  const relatedProducts = allProducts
    .filter((item) => item.id !== product.id)
    .sort((left, right) => {
      const leftMatch = left.category.some((category) =>
        product.category.includes(category),
      );
      const rightMatch = right.category.some((category) =>
        product.category.includes(category),
      );
      return Number(rightMatch) - Number(leftMatch);
    })
    .slice(0, 4);

  document
    .querySelector("#related-products-grid")
    .replaceChildren(...relatedProducts.map(createRelatedCard));
}

function renderReviews(reviews) {
  const reviewCards = document.querySelector("#product-review-cards");
  reviewCards.replaceChildren();
  if (reviews.length === 0) {
    document.querySelector("#product-reviews-status").textContent =
      "Chưa có nhận xét nào cho sản phẩm này.";
    return;
  }

  reviews.slice(0, 3).forEach((review) => {
    const card = document.createElement("article");
    card.className = "detail-review";
    const heading = document.createElement("div");
    heading.className = "detail-review-head";
    const customer = document.createElement("strong");
    customer.textContent = review.name;
    const date = document.createElement("time");
    date.textContent = "Khách hàng gần đây";
    heading.append(customer, date);
    const rating = document.createElement("div");
    rating.className = "detail-review-stars";
    rating.textContent = formatRating(review.rating);
    const comment = document.createElement("p");
    comment.textContent = review.comment;
    card.append(heading, rating, comment);
    reviewCards.append(card);
  });
  document.querySelector("#product-reviews-status").textContent =
    "Một vài nhận xét về nhóm sản phẩm này.";
}

function setupControls() {
  const quantity = document.querySelector("#quantity");
  document.querySelector("#quantity-decrease").addEventListener("click", () => {
    quantity.value = String(Math.max(1, Number(quantity.value) - 1));
  });
  document.querySelector("#quantity-increase").addEventListener("click", () => {
    quantity.value = String(
      Math.min(
        currentProduct?.stock || 1,
        Math.max(1, Number(quantity.value) || 1) + 1,
      ),
    );
  });
  quantity.addEventListener("change", () => {
    quantity.value = String(
      Math.min(
        currentProduct?.stock || 1,
        Math.max(1, Math.floor(Number(quantity.value) || 1)),
      ),
    );
  });

  document
    .querySelector("#detail-favorite")
    .addEventListener("click", async () => {
      try {
        await favoriteStore.toggle(currentProduct.id);
      } catch (error) {
        showProductActionError(error, "Đăng nhập để lưu sản phẩm yêu thích.");
      }
    });
  document
    .querySelector("#detail-add-cart")
    .addEventListener("click", () => addProductToCart());
  document
    .querySelector("#detail-buy-now")
    .addEventListener("click", () => addProductToCart(true));

  const panels = {
    "description-tab": "description-panel",
    "specifications-tab": "specifications-panel",
  };
  Object.entries(panels).forEach(([tabId, panelId]) => {
    document.querySelector(`#${tabId}`).addEventListener("click", () => {
      Object.entries(panels).forEach(([otherTabId, otherPanelId]) => {
        const active = otherTabId === tabId;
        const tab = document.querySelector(`#${otherTabId}`);
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
        document.querySelector(`#${otherPanelId}`).hidden = !active;
      });
      document.querySelector("#reviews-tab").classList.remove("active");
      document
        .querySelector("#reviews-tab")
        .setAttribute("aria-selected", "false");
    });
  });
  document.querySelector("#reviews-tab").addEventListener("click", (event) => {
    document.querySelectorAll(".detail-tabs button").forEach((tab) => {
      tab.classList.toggle("active", tab === event.currentTarget);
      tab.setAttribute("aria-selected", String(tab === event.currentTarget));
    });
    document.querySelector("#product-reviews").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

async function loadProduct() {
  if (!productId) {
    productStatus.textContent = "Không tìm thấy sản phẩm bạn đang tìm.";
    return;
  }

  try {
    const [productResult, productList] = await Promise.all([
      window.stationeryApi.getProduct(productId),
      window.stationeryApi.getProducts({ limit: 100 }),
    ]);
    const product = productResult.product;
    allProducts = productList.products;
    try {
      await favoriteStore.load();
    } catch (error) {
      console.error("Không thể tải danh sách yêu thích:", error);
    }
    renderProduct(product);
  } catch (error) {
    console.error("Không thể tải chi tiết sản phẩm:", error);
    productStatus.textContent =
      error.status === 404
        ? "Sản phẩm không tồn tại hoặc đã được gỡ."
        : "Tải thông tin sản phẩm không thành công. Vui lòng tải lại trang.";
    return;
  }

  try {
    const result = await window.stationeryApi.getReviews({
      productId: currentProduct.id,
      limit: 100,
    });
    renderReviews(result.reviews);
  } catch (error) {
    console.error("Không thể tải đánh giá sản phẩm:", error);
    document.querySelector("#product-reviews-status").textContent =
      "Tải đánh giá không thành công. Vui lòng tải lại trang.";
  }
}

favoriteStore.subscribe(updateFavoriteButtons);
cartStore.subscribe(updateCartCount);
window.addEventListener("stationery:review-created", async (event) => {
  if (!currentProduct || event.detail.review.productId !== currentProduct.id) {
    return;
  }

  currentProduct.rating = Number(event.detail.product.rating);
  currentProduct.reviewCount = Number(event.detail.product.reviewCount);
  updateReviewSummary(currentProduct);
  try {
    const result = await window.stationeryApi.getReviews({
      productId: currentProduct.id,
      limit: 100,
    });
    renderReviews(result.reviews);
  } catch (error) {
    console.error("Không thể tải lại đánh giá sản phẩm:", error);
    document.querySelector("#product-reviews-status").textContent =
      "Đã gửi nhận xét nhưng không tải lại được danh sách.";
  }
});
cartStore.refresh().catch((error) => {
  console.error("Không thể tải giỏ hàng:", error);
});
setupControls();
loadProduct();
