const CART_STORAGE_KEY = "stationery-cart";
const cartItemsElement = document.querySelector("#cart-items");
const emptyCartElement = document.querySelector("#empty-cart");
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

let cart = readCart();
let discount = 0;
const selectedIds = new Set();

function readCart() {
  try {
    const storedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
    return Array.isArray(storedCart) ? storedCart : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function formatPrice(price) {
  return `${price.toLocaleString("vi-VN")}đ`;
}

function resetDiscount() {
  discount = 0;
  couponStatus.textContent = "";
}

function getSubtotal() {
  return cart.reduce((total, item) => {
    return selectedIds.has(item.id)
      ? total + item.price * item.quantity
      : total;
  }, 0);
}

function renderCart() {
  cartItemsElement.replaceChildren();

  cart.forEach((item) => {
    const row = document.createElement("article");
    row.className = "cart-item";
    row.innerHTML = `
      <input class="cart-item-check" type="checkbox" />
      <img class="cart-item-image" src="" alt="" />
      <div class="cart-item-info">
        <h3></h3>
        <p>Phân loại: Tiêu chuẩn</p>
        <div class="cart-item-price"></div>
      </div>
      <div class="quantity">
        <button type="button" data-action="decrease" aria-label="Giảm số lượng">−</button>
        <input type="number" min="1" value="1" aria-label="Số lượng" />
        <button type="button" data-action="increase" aria-label="Tăng số lượng">+</button>
      </div>
      <button class="remove-item" type="button">×</button>
    `;

    const itemCheck = row.querySelector(".cart-item-check");
    itemCheck.setAttribute("aria-label", `Chọn ${item.name}`);
    itemCheck.checked = selectedIds.has(item.id);
    itemCheck.addEventListener("change", () => {
      if (itemCheck.checked) {
        selectedIds.add(item.id);
      } else {
        selectedIds.delete(item.id);
      }
      discount = 0;
      couponStatus.textContent = "";
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
    row
      .querySelector('[data-action="decrease"]')
      .addEventListener("click", () => {
        item.quantity = Math.max(1, item.quantity - 1);
        resetDiscount();
        saveCart();
        renderCart();
      });
    row
      .querySelector('[data-action="increase"]')
      .addEventListener("click", () => {
        item.quantity += 1;
        resetDiscount();
        saveCart();
        renderCart();
      });
    quantityInput.addEventListener("change", () => {
      item.quantity = Math.max(1, Number(quantityInput.value) || 1);
      resetDiscount();
      saveCart();
      renderCart();
    });
    row.querySelector(".remove-item").addEventListener("click", () => {
      cart = cart.filter((cartItem) => cartItem.id !== item.id);
      selectedIds.delete(item.id);
      resetDiscount();
      saveCart();
      renderCart();
    });
    cartItemsElement.append(row);
  });

  const quantity = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = getSubtotal();
  const selectedQuantity = cart.reduce((total, item) => {
    return selectedIds.has(item.id) ? total + item.quantity : total;
  }, 0);
  const delivery = selectedQuantity === 0 || subtotal >= 350000 ? 0 : 30000;

  cartCountElement.textContent = String(quantity);
  headingCountElement.textContent = `(${quantity})`;
  subtotalElement.textContent = formatPrice(subtotal);
  discountElement.textContent = discount ? `-${formatPrice(discount)}` : "0đ";
  deliveryElement.textContent =
    delivery === 0 ? "Miễn phí" : formatPrice(delivery);
  totalElement.textContent = formatPrice(
    Math.max(0, subtotal - discount + delivery),
  );
  emptyCartElement.hidden = cart.length !== 0;
  clearCartElement.hidden = cart.length === 0;
  selectAllElement.disabled = cart.length === 0;
  checkoutButton.disabled = selectedQuantity === 0;
  selectAllElement.checked =
    cart.length > 0 && cart.every((item) => selectedIds.has(item.id));
}

selectAllElement.addEventListener("change", () => {
  if (selectAllElement.checked) {
    cart.forEach((item) => selectedIds.add(item.id));
  } else {
    selectedIds.clear();
  }
  discount = 0;
  couponStatus.textContent = "";
  document.querySelectorAll(".cart-item-check").forEach((checkbox) => {
    checkbox.checked = selectAllElement.checked;
  });
  renderCart();
});

clearCartElement.addEventListener("click", () => {
  cart = [];
  selectedIds.clear();
  discount = 0;
  saveCart();
  couponStatus.textContent = "";
  renderCart();
});

document.querySelector("#apply-coupon").addEventListener("click", () => {
  if (getSubtotal() === 0) {
    discount = 0;
    couponStatus.textContent = "Hãy chọn ít nhất một sản phẩm.";
    renderCart();
    return;
  }
  if (couponInput.value.trim().toUpperCase() === "NETNHO10") {
    discount = Math.round(getSubtotal() * 0.1);
    couponStatus.textContent = "Đã áp dụng mã NETNHO10.";
  } else {
    discount = 0;
    couponStatus.textContent = "Mã giảm giá không hợp lệ.";
  }
  renderCart();
});

checkoutButton.addEventListener("click", () => {
  couponStatus.textContent = "Tính năng thanh toán đang được cập nhật.";
});

renderCart();
