const CHECKOUT_STORAGE_KEY = "stationery-checkout";
const cartItemsElement = document.querySelector("#cart-items");
const emptyCartElement = document.querySelector("#empty-cart");
const cartStatusElement = document.querySelector("#cart-status");
const cartCountElement = document.querySelector("#cart-count");
const headingCountElement = document.querySelector("#cart-heading-count");
const subtotalElement = document.querySelector("#subtotal");
const discountElement = document.querySelector("#discount");
const deliveryElement = document.querySelector("#delivery");
const totalElement = document.querySelector("#total");
const selectAllElement = document.querySelector("#select-all");
const clearCartElement = document.querySelector("#clear-cart");
const couponInput = document.querySelector("#coupon-code");
const couponStatus = document.querySelector("#coupon-status");
const checkoutButton = document.querySelector("#checkout");
const cartStore = window.stationeryCart;
let cart = [];
let discountCode = "";
let discount = 0;
const selectedIds = new Set();

function getCartItemKey(item) {
  return JSON.stringify([item.id, item.variant || ""]);
}

function formatPrice(price) {
  return `${Number(price).toLocaleString("vi-VN")}đ`;
}

function resetDiscount() {
  discountCode = "";
  discount = 0;
  couponStatus.textContent = "";
}

function getSubtotal() {
  return cart.reduce((total, item) => {
    return selectedIds.has(getCartItemKey(item))
      ? total + item.price * item.quantity
      : total;
  }, 0);
}

function setStatus(message, requiresLogin = false) {
  cartStatusElement.replaceChildren(document.createTextNode(message));
  if (requiresLogin) {
    const loginLink = document.createElement("a");
    loginLink.href = "../auth/login.html";
    loginLink.textContent = " Đăng nhập";
    cartStatusElement.append(loginLink);
  }
}

function renderCart() {
  cartItemsElement.replaceChildren();
  const cartKeys = new Set(cart.map(getCartItemKey));
  selectedIds.forEach((key) => {
    if (!cartKeys.has(key)) selectedIds.delete(key);
  });

  cart.forEach((item) => {
    const row = document.createElement("article");
    row.className = "cart-item";
    row.innerHTML = `
      <input class="cart-item-check" type="checkbox" />
      <img class="cart-item-image" src="" alt="" />
      <div class="cart-item-info">
        <h3></h3>
        <p class="cart-item-variant"></p>
        <div class="cart-item-price"></div>
      </div>
      <div class="quantity">
        <button type="button" data-action="decrease" aria-label="Giảm số lượng">−</button>
        <input type="number" min="1" value="1" aria-label="Số lượng" />
        <button type="button" data-action="increase" aria-label="Tăng số lượng">+</button>
      </div>
      <button class="remove-item" type="button">×</button>
    `;

    const itemKey = getCartItemKey(item);
    const itemCheck = row.querySelector(".cart-item-check");
    itemCheck.setAttribute("aria-label", `Chọn ${item.name}`);
    itemCheck.checked = selectedIds.has(itemKey);
    itemCheck.addEventListener("change", () => {
      if (itemCheck.checked) selectedIds.add(itemKey);
      else selectedIds.delete(itemKey);
      resetDiscount();
      renderCart();
    });

    const image = row.querySelector(".cart-item-image");
    image.src = item.image;
    image.alt = item.name;
    row
      .querySelector(".quantity")
      .setAttribute("aria-label", `Số lượng ${item.name}`);
    row
      .querySelector(".remove-item")
      .setAttribute("aria-label", `Xóa ${item.name}`);
    row.querySelector("h3").textContent = item.name;
    row.querySelector(".cart-item-variant").textContent =
      `Phân loại: ${item.variant || "Tiêu chuẩn"}`;

    const priceElement = row.querySelector(".cart-item-price");
    const currentPrice = document.createElement("strong");
    currentPrice.textContent = formatPrice(item.price);
    priceElement.append(currentPrice);
    if (item.originalPrice) {
      const originalPrice = document.createElement("del");
      originalPrice.textContent = formatPrice(item.originalPrice);
      priceElement.append(originalPrice);
    }

    const quantityInput = row.querySelector(".quantity input");
    quantityInput.value = String(item.quantity);
    quantityInput.max = String(item.stock);
    row
      .querySelector('[data-action="decrease"]')
      .addEventListener("click", () => {
        updateQuantity(item, Math.max(1, item.quantity - 1));
      });
    row
      .querySelector('[data-action="increase"]')
      .addEventListener("click", () => {
        updateQuantity(item, Math.min(item.stock, item.quantity + 1));
      });
    quantityInput.addEventListener("change", () => {
      const nextQuantity = Math.max(
        1,
        Math.min(item.stock, Math.floor(Number(quantityInput.value) || 1)),
      );
      updateQuantity(item, nextQuantity);
    });
    row.querySelector(".remove-item").addEventListener("click", () => {
      removeItem(item);
    });
    cartItemsElement.append(row);
  });

  const quantity = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = getSubtotal();
  const selectedQuantity = cart.reduce((total, item) => {
    return selectedIds.has(getCartItemKey(item))
      ? total + item.quantity
      : total;
  }, 0);
  const finalSubtotal = Math.max(0, subtotal - discount);
  const delivery =
    selectedQuantity === 0 || finalSubtotal >= 350000 ? 0 : 30000;

  cartCountElement.textContent = String(quantity);
  headingCountElement.textContent = `(${quantity})`;
  subtotalElement.textContent = formatPrice(subtotal);
  discountElement.textContent = discount ? `-${formatPrice(discount)}` : "0đ";
  deliveryElement.textContent =
    delivery === 0 ? "Miễn phí" : formatPrice(delivery);
  totalElement.textContent = formatPrice(finalSubtotal + delivery);
  emptyCartElement.hidden = cart.length !== 0;
  clearCartElement.hidden = cart.length === 0;
  selectAllElement.disabled = cart.length === 0;
  checkoutButton.disabled =
    selectedQuantity === 0 || !window.stationeryApi.isAuthenticated();
  selectAllElement.checked =
    cart.length > 0 &&
    cart.every((item) => selectedIds.has(getCartItemKey(item)));
}

async function updateQuantity(item, quantity) {
  resetDiscount();
  try {
    await cartStore.update(item.id, quantity, item.variant || "");
  } catch (error) {
    setStatus(error.message, error.status === 401);
  }
}

async function removeItem(item) {
  resetDiscount();
  try {
    await cartStore.remove(item.id, item.variant || "");
  } catch (error) {
    setStatus(error.message, error.status === 401);
  }
}

selectAllElement.addEventListener("change", () => {
  if (selectAllElement.checked) {
    cart.forEach((item) => selectedIds.add(getCartItemKey(item)));
  } else {
    selectedIds.clear();
  }
  resetDiscount();
  renderCart();
});

clearCartElement.addEventListener("click", async () => {
  try {
    await cartStore.clear();
    selectedIds.clear();
    resetDiscount();
    setStatus("");
  } catch (error) {
    setStatus(error.message, error.status === 401);
  }
});

document.querySelector("#apply-coupon").addEventListener("click", () => {
  const subtotal = getSubtotal();
  if (subtotal === 0) {
    resetDiscount();
    couponStatus.textContent = "Hãy chọn ít nhất một sản phẩm.";
    renderCart();
    return;
  }
  if (couponInput.value.trim().toUpperCase() === "NETNHO10") {
    discountCode = "NETNHO10";
    discount = Math.round(subtotal * 0.1);
    couponStatus.textContent = "Đã áp dụng mã NETNHO10.";
  } else {
    resetDiscount();
    couponStatus.textContent = "Mã giảm giá không hợp lệ.";
  }
  renderCart();
});

checkoutButton.addEventListener("click", () => {
  const selectedItems = cart.filter((item) =>
    selectedIds.has(getCartItemKey(item)),
  );
  if (selectedItems.length === 0) {
    couponStatus.textContent = "Hãy chọn sản phẩm cần thanh toán.";
    return;
  }
  if (!window.stationeryApi.isAuthenticated()) {
    setStatus("Đăng nhập để thanh toán.", true);
    return;
  }

  localStorage.setItem(
    CHECKOUT_STORAGE_KEY,
    JSON.stringify({
      itemKeys: selectedItems.map(getCartItemKey),
      couponCode: discountCode,
    }),
  );
  window.location.href = "../checkout/checkout.html";
});

cartStore.subscribe((items) => {
  cart = items;
  renderCart();
});

async function loadCart() {
  if (!window.stationeryApi.isAuthenticated()) {
    cart = [];
    renderCart();
    setStatus("Đăng nhập để xem giỏ hàng của bạn.", true);
    return;
  }
  setStatus("Đang tải giỏ hàng...");
  try {
    await cartStore.refresh();
    setStatus("");
  } catch (error) {
    setStatus(error.message, error.status === 401);
  }
}

loadCart();
