const CHECKOUT_STORAGE_KEY = "stationery-checkout";
const SHIPPING_THRESHOLD = 350000;
const SHIPPING_FEE = 30000;
const checkoutStatus = document.querySelector("#checkout-page-status");
const checkoutLayout = document.querySelector("#checkout-layout");
const checkoutForm = document.querySelector("#checkout-form");
const checkoutSubmitButton = checkoutForm.querySelector(".place-order-button");
const checkoutSubmitStatus = document.querySelector("#checkout-submit-status");
const checkoutSuccess = document.querySelector("#checkout-success");
const cartCount = document.querySelector("#cart-count");
const cartStore = window.stationeryCart;

let checkoutDraft = null;
let checkoutItems = [];

function getCartItemKey(item) {
  return JSON.stringify([item.id, item.variant || ""]);
}

function formatPrice(price) {
  return `${Number(price).toLocaleString("vi-VN")}đ`;
}

function readCheckoutDraft() {
  try {
    return JSON.parse(localStorage.getItem(CHECKOUT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function createIdempotencyKey() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function showCheckoutError(message, loginRequired = false) {
  checkoutStatus.replaceChildren(document.createTextNode(message));
  const link = document.createElement("a");
  link.href = loginRequired ? "../auth/login.html" : "../cart/cart.html";
  link.textContent = loginRequired
    ? " Đăng nhập"
    : " Quay lại giỏ hàng";
  checkoutStatus.append(link);
  checkoutLayout.hidden = true;
  checkoutStatus.hidden = false;
}

function renderOrderItems() {
  const orderItems = document.querySelector("#checkout-order-items");
  orderItems.replaceChildren();
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

function getTotals() {
  const subtotal = checkoutItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const discount =
    checkoutDraft.couponCode === "NETNHO10"
      ? Math.round(subtotal * 0.1)
      : 0;
  const delivery =
    subtotal - discount >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return { subtotal, discount, delivery, total: subtotal - discount + delivery };
}

function renderSummary() {
  const totals = getTotals();
  document.querySelector("#checkout-subtotal").textContent =
    formatPrice(totals.subtotal);
  document.querySelector("#checkout-discount").textContent =
    `-${formatPrice(totals.discount)}`;
  document.querySelector("#checkout-discount-row").hidden =
    totals.discount === 0;
  document.querySelector("#checkout-delivery").textContent =
    totals.delivery === 0 ? "Miễn phí" : formatPrice(totals.delivery);
  document.querySelector("#checkout-total").textContent =
    formatPrice(totals.total);
}

function showOrderSuccess(order, paymentMessage) {
    checkoutStatus.hidden = true;
    checkoutLayout.hidden = true;
    checkoutSuccess.hidden = false;
    document.querySelector("#checkout-success-message").textContent =
      `Cảm ơn ${order.customer?.name || order.recipientName}! Đơn hàng sẽ được giao đến địa chỉ bạn đã cung cấp. ${paymentMessage}`;
    document.querySelector("#checkout-order-number").textContent =
      `Mã đơn hàng: ${order.orderNumber}`;
    document.querySelector(".checkout-intro h1").textContent =
      "Đặt hàng thành công";
    document.querySelector(".checkout-intro p").textContent =
      "Nét nhỏ sẽ sớm liên hệ xác nhận đơn hàng của bạn.";
}

async function showMomoPaymentResult(orderId) {
    checkoutLayout.hidden = true;
    checkoutStatus.textContent = "Đang kiểm tra kết quả thanh toán MoMo...";
    checkoutStatus.hidden = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const { order } = await window.stationeryApi.get(
          `/orders/${encodeURIComponent(orderId)}`,
        );
        if (order.paymentStatus === "paid") {
          await cartStore.refresh().catch((error) => {
            console.error("Không thể tải lại giỏ hàng:", error);
          });
          showOrderSuccess(order, "Thanh toán MoMo đã được xác nhận.");
          return;
        }
        if (["failed", "cancelled"].includes(order.paymentStatus)) {
          await cartStore.refresh().catch((error) => {
            console.error("Không thể tải lại giỏ hàng:", error);
          });
          checkoutStatus.textContent =
            "Thanh toán MoMo chưa thành công. Sản phẩm đã được đưa lại vào giỏ hàng.";
          return;
        }
      } catch (error) {
        showCheckoutError(
          error.status === 401
            ? "Phiên đăng nhập đã hết hạn. Đăng nhập lại để xem trạng thái đơn."
            : error.message || "Không thể kiểm tra trạng thái thanh toán.",
          error.status === 401,
        );
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    }
    checkoutStatus.textContent =
      "MoMo chưa xác nhận giao dịch. Trạng thái đơn sẽ được cập nhật khi nhận được xác nhận từ MoMo.";
}

async function loadCheckout() {
  if (!window.stationeryApi.isAuthenticated()) {
    showCheckoutError("Đăng nhập để tiếp tục thanh toán.", true);
    return;
  }

    const query = new URLSearchParams(window.location.search);
    const momoOrderId = query.get("localOrderId");
    if (query.get("paymentReturn") === "momo" && momoOrderId) {
      await showMomoPaymentResult(momoOrderId);
      return;
    }

  checkoutDraft = readCheckoutDraft();
  if (!checkoutDraft || !Array.isArray(checkoutDraft.itemKeys)) {
    showCheckoutError("Chưa có sản phẩm nào được chọn để thanh toán.");
    return;
  }

  if (!checkoutDraft.idempotencyKey) {
    checkoutDraft.idempotencyKey = createIdempotencyKey();
    localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(checkoutDraft));
  }

  checkoutStatus.textContent = "Đang tải đơn hàng...";
  try {
    await cartStore.refresh();
    const cart = cartStore.getItems();
    const selectedKeys = new Set(checkoutDraft.itemKeys);
    checkoutItems = cart.filter((item) =>
      selectedKeys.has(getCartItemKey(item)),
    );
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
    cartCount.textContent = String(cartStore.getCount());
    checkoutStatus.hidden = true;
    checkoutLayout.hidden = false;
    checkoutLayout.setAttribute(
      "aria-label",
      `Đơn hàng gồm ${itemCount} sản phẩm`,
    );
  } catch (error) {
    showCheckoutError(
      error.status === 401
        ? "Phiên đăng nhập đã hết hạn."
        : "Không thể tải giỏ hàng để thanh toán.",
      error.status === 401,
    );
  }
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

function setSubmitError(message, loginRequired = false) {
  checkoutSubmitStatus.replaceChildren(document.createTextNode(message));
  if (loginRequired) {
    const link = document.createElement("a");
    link.href = "../auth/login.html";
    link.textContent = " Đăng nhập lại";
    checkoutSubmitStatus.append(link);
  }
}

async function placeOrder(event) {
  event.preventDefault();
  checkoutSubmitStatus.textContent = "";
  validatePhone();
  if (!checkoutForm.reportValidity()) return;

  checkoutSubmitButton.disabled = true;
  try {
    await cartStore.refresh();
    const selectedKeys = new Set(checkoutDraft.itemKeys);
    const currentItems = cartStore
      .getItems()
      .filter((item) => selectedKeys.has(getCartItemKey(item)));
    const cartChanged =
      currentItems.length !== checkoutItems.length ||
      currentItems.some((item, index) => {
        const originalItem = checkoutItems[index];
        return (
          getCartItemKey(item) !== getCartItemKey(originalItem) ||
          item.name !== originalItem.name ||
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

    const paymentMethod = checkoutForm.querySelector(
      'input[name="payment"]:checked',
    ).value;
    const result = await window.stationeryApi.createOrder({
      customer: {
        name: document.querySelector("#customer-name").value.trim(),
        phone: document
          .querySelector("#customer-phone")
          .value.replace(/[\s-]/g, ""),
        address: document.querySelector("#customer-address").value.trim(),
      },
      note: document.querySelector("#customer-note").value.trim(),
      items: currentItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        variant: item.variant || "",
      })),
      couponCode: checkoutDraft.couponCode || "",
      paymentMethod,
    }, checkoutDraft.idempotencyKey);

    if (paymentMethod === "momo") {
      if (result.order.paymentStatus === "paid") {
        localStorage.removeItem(CHECKOUT_STORAGE_KEY);
        showOrderSuccess(result.order, "Thanh toán MoMo đã được xác nhận.");
        return;
      }
      if (result.order.paymentStatus !== "pending" || !result.order.paymentUrl) {
        throw new Error("MoMo chưa thể tạo giao dịch. Vui lòng thử lại.");
      }
      localStorage.removeItem(CHECKOUT_STORAGE_KEY);
      window.location.assign(result.order.paymentUrl);
      return;
    }

    localStorage.removeItem(CHECKOUT_STORAGE_KEY);
    try {
      await cartStore.refresh();
    } catch (error) {
      console.error("Không thể tải lại giỏ hàng sau khi đặt đơn:", error);
    }
    const paymentMessage = {
      cod: "Bạn thanh toán khi nhận hàng.",
      bank_transfer:
        "Nhân viên sẽ liên hệ xác nhận đơn và gửi thông tin chuyển khoản.",
    }[result.order.paymentMethod];
    showOrderSuccess(result.order, paymentMessage);
  } catch (error) {
    setSubmitError(
      error.message || "Chưa thể đặt hàng. Vui lòng thử lại.",
      error.status === 401,
    );
  } finally {
    checkoutSubmitButton.disabled = false;
  }
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
