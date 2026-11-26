(() => {
  const orderId = new URLSearchParams(window.location.search).get("orderId");
  const card = document.querySelector("#payment-result-card");
  const icon = document.querySelector("#payment-result-icon");
  const heading = document.querySelector("#payment-result-heading");
  const message = document.querySelector("#payment-result-message");
  const summary = document.querySelector("#payment-result-summary");
  const orderNumber = document.querySelector("#payment-result-order-number");
  const total = document.querySelector("#payment-result-total");
  const paymentMethod = document.querySelector("#payment-result-method");
  const reason = document.querySelector("#payment-result-reason");
  const viewOrderButton = document.querySelector("#payment-result-view-order");
  const checkAgainButton = document.querySelector(
    "#payment-result-check-again",
  );
  const retryPaymentLink = document.querySelector(
    "#payment-result-retry-payment",
  );
  const loginLink = document.querySelector("#payment-result-login");
  const homeLink = document.querySelector("#payment-result-home");
  const orderDetails = document.querySelector("#payment-result-order-details");
  const recipient = document.querySelector("#payment-result-recipient");
  const items = document.querySelector("#payment-result-items");
  const PAYMENT_METHOD_LABELS = {
    cod: "Thanh toán khi nhận hàng (COD)",
    bank_transfer: "Chuyển khoản ngân hàng",
    momo: "MoMo",
    vnpay: "VNPay",
  };
  const STATE_ICONS = {
    success: "✓",
    failure: "×",
    cancelled: "↶",
    processing: "…",
  };
  const validOrderId =
    typeof orderId === "string" &&
    /^\d+$/.test(orderId) &&
    Number.isSafeInteger(Number(orderId)) &&
    Number(orderId) > 0;
  let verifying = false;

  function formatPrice(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")}đ` : "—";
  }

  function setState(state, title, description) {
    card.dataset.state = state;
    icon.textContent = STATE_ICONS[state] || "…";
    heading.textContent = title;
    message.textContent = description;
  }

  function renderOrder(order) {
    summary.hidden = false;
    orderNumber.textContent = order.orderNumber || `#${order.id}`;
    total.textContent = formatPrice(order.total);
    paymentMethod.textContent =
      PAYMENT_METHOD_LABELS[order.paymentMethod] || "Khác";

    const backendReason =
      order.paymentReason ||
      order.paymentMessage ||
      (order.paymentMethod === "momo" &&
      Number(order.momoResultCode) !== 0 &&
      order.momoResultCode !== null &&
      order.momoResultCode !== undefined
        ? `Mã phản hồi MoMo: ${order.momoResultCode}`
        : "");
    reason.textContent = typeof backendReason === "string" ? backendReason : "";
    reason.hidden = !reason.textContent;

    recipient.textContent = [order.recipientName, order.phone, order.address]
      .filter(Boolean)
      .join(" · ");

    items.replaceChildren(
      ...(Array.isArray(order.items) ? order.items : []).map((item) => {
        const row = document.createElement("article");
        row.className = "payment-result-item";
        const details = document.createElement("div");
        details.className = "payment-result-item-copy";
        const name = document.createElement("strong");
        name.textContent = item.name || "Sản phẩm";
        const variant = document.createElement("span");
        variant.textContent = `${item.variant || "Tiêu chuẩn"} · SL: ${Number(item.quantity) || 0}`;
        const price = document.createElement("strong");
        price.textContent = formatPrice(
          item.lineTotal ?? Number(item.price) * Number(item.quantity),
        );
        details.append(name, variant);
        row.append(details, price);
        return row;
      }),
    );
  }

  function configureActions(
    state,
    { canViewOrder = false, canRetryCheck = false, needsLogin = false } = {},
  ) {
    viewOrderButton.hidden = !canViewOrder;
    checkAgainButton.hidden = !canRetryCheck;
    retryPaymentLink.hidden = !["failure", "cancelled"].includes(state);
    loginLink.hidden = !needsLogin;
    homeLink.textContent = ["failure", "cancelled"].includes(state)
      ? "Quay về trang chủ"
      : "Tiếp tục mua sắm";
    if (!canViewOrder) {
      orderDetails.hidden = true;
      viewOrderButton.setAttribute("aria-expanded", "false");
    }
  }

  function getOutcome(order) {
    const status = String(order.paymentStatus || "").toLowerCase();
    const method = String(order.paymentMethod || "").toLowerCase();

    if (status === "paid") {
      return {
        state: "success",
        title: "Thanh toán thành công",
        message: "Backend đã xác nhận giao dịch và thông tin đơn hàng.",
        terminal: true,
      };
    }
    if (status === "cancelled") {
      const customerCancelledMomo =
        method === "momo" && Number(order.momoResultCode) === 1006;
      return {
        state: "cancelled",
        title: "Giao dịch đã bị hủy",
        message: customerCancelledMomo
          ? "Bạn đã hủy giao dịch trên MoMo. Đơn hàng chưa được thanh toán."
          : "Đơn hàng này đã bị hủy và chưa được xác nhận thanh toán.",
        terminal: true,
      };
    }
    if (status === "failed") {
      return {
        state: "failure",
        title: "Thanh toán thất bại",
        message: "Giao dịch chưa được Backend xác nhận thành công.",
        terminal: true,
      };
    }
    if (order.status === "cancelled") {
      return {
        state: "cancelled",
        title: "Đơn hàng đã bị hủy",
        message: "Đơn hàng đã bị hủy và chưa được xác nhận thanh toán.",
        terminal: true,
      };
    }
    if (method === "cod" && status === "unpaid") {
      return {
        state: "success",
        title: "Đặt hàng thành công",
        message: "Đơn hàng đã được ghi nhận. Bạn thanh toán khi nhận hàng.",
        terminal: true,
      };
    }
    if (method === "bank_transfer" && status === "unpaid") {
      return {
        state: "processing",
        title: "Đơn hàng đang chờ chuyển khoản",
        message:
          "Backend đã ghi nhận đơn hàng. Thanh toán sẽ được xác nhận sau khi nhận và đối soát chuyển khoản.",
        terminal: true,
      };
    }
    return {
      state: "processing",
      title: "Đang xử lý thanh toán",
      message:
        "Backend chưa xác nhận kết quả. Vui lòng chờ trong giây lát; giao dịch chưa được xem là thành công.",
      terminal: false,
    };
  }

  function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function verifyOrder() {
    if (verifying) return;
    if (!validOrderId) {
      setState(
        "processing",
        "Không tìm thấy mã đơn hàng",
        "Không thể kiểm tra kết quả nếu thiếu mã đơn hàng hợp lệ.",
      );
      configureActions("processing");
      return;
    }
    if (!window.stationeryApi.isAuthenticated()) {
      setState(
        "processing",
        "Đăng nhập để xem kết quả",
        "Đăng nhập đúng tài khoản đã đặt hàng để Backend kiểm tra giao dịch.",
      );
      configureActions("processing", { needsLogin: true });
      return;
    }

    verifying = true;
    checkAgainButton.disabled = true;
    const attempts = 10;
    let lastOrder = null;
    let lastRequestFailed = false;

    try {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await window.stationeryApi.get(
            `/orders/${encodeURIComponent(orderId)}`,
          );
          const order = response?.order;
          if (!order) {
            setState(
              "processing",
              "Chưa thể xác minh đơn hàng",
              "Backend chưa trả về thông tin đơn hàng hợp lệ.",
            );
            configureActions("processing", { canRetryCheck: true });
            return;
          }
          lastOrder = order;
          lastRequestFailed = false;
          renderOrder(order);
          const outcome = getOutcome(order);
          setState(outcome.state, outcome.title, outcome.message);
          configureActions(outcome.state, {
            canViewOrder: outcome.state === "success",
            canRetryCheck: !outcome.terminal,
          });
          if (outcome.terminal) return;
        } catch (error) {
          if (error.status === 401) {
            setState(
              "processing",
              "Đăng nhập để xem kết quả",
              "Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại để Backend xác minh đơn hàng.",
            );
            configureActions("processing", { needsLogin: true });
            return;
          }
          if (error.status === 404) {
            setState(
              "processing",
              "Không thể xác minh đơn hàng",
              error.message ||
                "Không tìm thấy đơn hàng hoặc tài khoản hiện tại không có quyền xem.",
            );
            configureActions("processing");
            return;
          }
          lastRequestFailed = true;
        }

        if (attempt < attempts - 1) await delay(1200);
      }
    } finally {
      verifying = false;
      checkAgainButton.disabled = false;
    }

    if (lastOrder) renderOrder(lastOrder);
    setState(
      "processing",
      "Đang chờ xác nhận thanh toán",
      lastRequestFailed
        ? "Chưa thể kết nối để kiểm tra trạng thái. Giao dịch chưa được xem là thành công; hãy thử kiểm tra lại."
        : "Backend chưa nhận được xác nhận cuối cùng. Nếu bạn vừa thanh toán, hãy đợi rồi kiểm tra lại.",
    );
    configureActions("processing", { canRetryCheck: true });
  }

  viewOrderButton.addEventListener("click", () => {
    const expanded = viewOrderButton.getAttribute("aria-expanded") === "true";
    viewOrderButton.setAttribute("aria-expanded", String(!expanded));
    viewOrderButton.textContent = expanded ? "Xem đơn hàng" : "Ẩn chi tiết đơn";
    orderDetails.hidden = expanded;
  });
  checkAgainButton.addEventListener("click", verifyOrder);

  verifyOrder();
})();
