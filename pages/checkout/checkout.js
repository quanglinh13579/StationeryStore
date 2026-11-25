const CART_STORAGE_KEY = "stationery-cart";
const CHECKOUT_STORAGE_KEY = "stationery-checkout";
const ORDERS_STORAGE_KEY = "stationery-orders";
const SHIPPING_THRESHOLD = 350000;
const SHIPPING_FEE = 30000;
const checkoutStatus = document.querySelector("#checkout-page-status");
const checkoutLayout = document.querySelector("#checkout-layout");
const checkoutForm = document.querySelector("#checkout-form");
const checkoutSubmitButton = checkoutForm.querySelector(".place-order-button");
const checkoutSubmitStatus = document.querySelector("#checkout-submit-status");
const checkoutSuccess = document.querySelector("#checkout-success");
const cartCount = document.querySelector("#cart-count");

let checkoutDraft = null;
let checkoutItems = [];

function getCartItemKey(item) {
  return JSON.stringify([item.id, item.variant || ""]);
}

function formatPrice(price) {
  return `${price.toLocaleString("vi-VN")}đ`;
}

function readStorageArray(key) {
  try {
    const storedValue = JSON.parse(localStorage.getItem(key));
    return Array.isArray(storedValue) ? storedValue : [];
  } catch {
    return [];
  }
}

function showCheckoutError(message) {
  checkoutStatus.replaceChildren(document.createTextNode(message));
  const cartLink = document.createElement("a");
  cartLink.href = "../cart/cart.html";
  cartLink.textContent = "Quay lại giỏ hàng";
  checkoutStatus.append(cartLink);
  checkoutLayout.hidden = true;
  checkoutStatus.hidden = false;
}

function renderOrderItems() {
  const orderItems = document.querySelector("#checkout-order-items");
  checkoutItems.forEach((item) => {
    const row = document.createElement("article");
    row.className = "checkout-order-item";
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.name;
    const details = document.createElement("div");
    details.className = "checkout-order-item-info";
    const name = document.createElement("strong");
    name.textContent = item.name;
    const variant = document.createElement("span");
    variant.textContent = `${item.variant || "Tiêu chuẩn"} · SL: ${item.quantity}`;
    const price = document.createElement("strong");
    price.className = "checkout-order-item-price";
    price.textContent = formatPrice(item.price * item.quantity);
    details.append(name, variant);
    row.append(image, details, price);
    orderItems.append(row);
  });
}

function renderSummary() {
  const subtotal = checkoutItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const discount = Math.min(
    subtotal,
    Math.max(0, Number(checkoutDraft.discount) || 0),
  );
  const delivery = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal - discount + delivery;
  document.querySelector("#checkout-subtotal").textContent =
    formatPrice(subtotal);
  document.querySelector("#checkout-discount").textContent =
    `-${formatPrice(discount)}`;
  document.querySelector("#checkout-discount-row").hidden = discount === 0;
  document.querySelector("#checkout-delivery").textContent =
    delivery === 0 ? "Miễn phí" : formatPrice(delivery);
  document.querySelector("#checkout-total").textContent = formatPrice(total);
}

function loadCheckout() {
  const cart = readStorageArray(CART_STORAGE_KEY);
  try {
    checkoutDraft = JSON.parse(localStorage.getItem(CHECKOUT_STORAGE_KEY));
  } catch {
    showCheckoutError("Thông tin thanh toán không hợp lệ.");
    return;
  }

  if (!checkoutDraft || !Array.isArray(checkoutDraft.itemKeys)) {
    showCheckoutError("Chưa có sản phẩm nào được chọn để thanh toán.");
    return;
  }

  const selectedKeys = new Set(checkoutDraft.itemKeys);
  checkoutItems = cart.filter((item) => selectedKeys.has(getCartItemKey(item)));
  if (checkoutItems.length === 0) {
    showCheckoutError("Các sản phẩm đã chọn không còn trong giỏ hàng.");
    return;
  }

  renderOrderItems();
  renderSummary();
  const itemCount = checkoutItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  cartCount.textContent = String(
    cart.reduce((total, item) => total + item.quantity, 0),
  );
  document.querySelector("#checkout-page-status").hidden = true;
  checkoutLayout.hidden = false;
  checkoutLayout.setAttribute(
    "aria-label",
    `Đơn hàng gồm ${itemCount} sản phẩm`,
  );
}

function validatePhone() {
  const phoneInput = document.querySelector("#customer-phone");
  const normalizedPhone = phoneInput.value.replace(/[\s-]/g, "");
  const isValid = /^(0\d{9}|\+84\d{9})$/.test(normalizedPhone);
  phoneInput.setCustomValidity(
    !phoneInput.value || isValid
      ? ""
      : "Nhập số điện thoại gồm 10 số hoặc mã quốc gia +84.",
  );
}

function validateTrimmedInput(input, message) {
  input.setCustomValidity(
    !input.value || input.value.trim().length >= Number(input.minLength || 0)
      ? ""
      : message,
  );
}

function getOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NN-${timestamp}-${randomPart}`;
}

function placeOrder(event) {
  event.preventDefault();
  checkoutSubmitStatus.textContent = "";
  validatePhone();
  if (!checkoutForm.reportValidity()) return;

  const cart = readStorageArray(CART_STORAGE_KEY);
  const selectedKeys = new Set(checkoutDraft.itemKeys);
  const currentItems = cart.filter((item) =>
    selectedKeys.has(getCartItemKey(item)),
  );
  const cartChanged =
    currentItems.length !== checkoutItems.length ||
    currentItems.some((item, index) => {
      const originalItem = checkoutItems[index];
      return (
        getCartItemKey(item) !== getCartItemKey(originalItem) ||
        item.name !== originalItem.name ||
        item.image !== originalItem.image ||
        item.price !== originalItem.price ||
        item.quantity !== originalItem.quantity
      );
    });
  if (cartChanged) {
    showCheckoutError(
      "Giỏ hàng đã thay đổi. Vui lòng quay lại để kiểm tra sản phẩm.",
    );
    return;
  }

  const currentSubtotal = currentItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const discount = Math.min(
    currentSubtotal,
    Math.max(0, Number(checkoutDraft.discount) || 0),
  );
  const delivery = currentSubtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const paymentMethod = checkoutForm.querySelector(
    'input[name="payment"]:checked',
  ).value;
  const order = {
    id: getOrderId(),
    customer: {
      name: document.querySelector("#customer-name").value.trim(),
      phone: document
        .querySelector("#customer-phone")
        .value.replace(/[\s-]/g, ""),
      address: document.querySelector("#customer-address").value.trim(),
    },
    items: currentItems,
    subtotal: currentSubtotal,
    discount,
    delivery,
    total: currentSubtotal - discount + delivery,
    paymentMethod,
    createdAt: new Date().toISOString(),
  };
  const orders = readStorageArray(ORDERS_STORAGE_KEY);
  const remainingItems = cart.filter(
    (item) => !selectedKeys.has(getCartItemKey(item)),
  );

  checkoutSubmitButton.disabled = true;
  try {
    localStorage.setItem(
      ORDERS_STORAGE_KEY,
      JSON.stringify([order, ...orders]),
    );
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(remainingItems));
    localStorage.removeItem(CHECKOUT_STORAGE_KEY);
  } catch (error) {
    console.error("Không thể lưu đơn hàng:", error);
    checkoutSubmitStatus.textContent =
      "Chưa thể lưu đơn hàng. Vui lòng thử lại.";
    checkoutSubmitButton.disabled = false;
    return;
  }

  cartCount.textContent = String(
    remainingItems.reduce((total, item) => total + item.quantity, 0),
  );
  checkoutLayout.hidden = true;
  checkoutSuccess.hidden = false;
  const paymentMessage = {
    cod: "Bạn thanh toán khi nhận hàng.",
    bank_transfer:
      "Nhân viên sẽ liên hệ xác nhận đơn và gửi thông tin chuyển khoản.",
    e_wallet:
      "Nhân viên sẽ liên hệ xác nhận đơn và hướng dẫn thanh toán qua ví điện tử.",
  }[paymentMethod];
  document.querySelector("#checkout-success-message").textContent =
    `Cảm ơn ${order.customer.name}! Đơn hàng sẽ được giao đến địa chỉ bạn đã cung cấp. ${paymentMessage}`;
  document.querySelector("#checkout-order-number").textContent =
    `Mã đơn hàng: ${order.id}`;
  document.querySelector(".checkout-intro h1").textContent =
    "Đặt hàng thành công";
  document.querySelector(".checkout-intro p").textContent =
    "Nét nhỏ sẽ sớm liên hệ xác nhận đơn hàng của bạn.";
}

const nameInput = document.querySelector("#customer-name");
const phoneInput = document.querySelector("#customer-phone");
const addressInput = document.querySelector("#customer-address");
nameInput.addEventListener("input", () => {
  validateTrimmedInput(nameInput, "Tên cần có ít nhất 2 ký tự.");
});
phoneInput.addEventListener("input", validatePhone);
addressInput.addEventListener("input", () => {
  validateTrimmedInput(addressInput, "Địa chỉ cần có ít nhất 5 ký tự.");
});
checkoutForm.addEventListener("submit", placeOrder);

loadCheckout();
