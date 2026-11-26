(() => {
  const orderId = new URLSearchParams(window.location.search).get("orderId");
  const statusElement = document.querySelector("#order-detail-status");
  const detailCard = document.querySelector("#order-detail-card");
  const ORDER_STEPS = [
    { status: "pending", label: "Đặt hàng thành công" },
    { status: "confirmed", label: "Đã xác nhận đơn hàng" },
    { status: "preparing", label: "Đang chuẩn bị hàng" },
    { status: "shipping", label: "Đang giao hàng" },
    { status: "completed", label: "Giao hàng thành công" },
  ];
  const STATUS_LABELS = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    preparing: "Đang chuẩn bị hàng",
    shipping: "Đang giao hàng",
    completed: "Giao hàng thành công",
    cancelled: "Đã hủy",
  };
  const PAYMENT_METHOD_LABELS = {
    cod: "Thanh toán khi nhận hàng (COD)",
    bank_transfer: "Chuyển khoản ngân hàng",
    momo: "MoMo",
    vnpay: "VNPay",
  };
  const PAYMENT_STATUS_LABELS = {
    unpaid: "Chưa thanh toán",
    pending: "Đang chờ xác nhận",
    paid: "Đã thanh toán",
    failed: "Thất bại",
    cancelled: "Đã hủy",
  };
  let loading = false;
  let hasLoadedOrder = false;

  function formatPrice(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")}đ` : "—";
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleString("vi-VN", {
          dateStyle: "medium",
          timeStyle: "short",
        });
  }

  function showStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.classList.toggle("is-error", isError);
    statusElement.hidden = false;
  }

  function createTimelineStep(step, index, history, order, currentIndex) {
    const entry = document.createElement("li");
    entry.className = "tracking-step";
    const event = history.find((item) => item.status === step.status);
    const isCancelled = order.status === "cancelled";
    const reached = event
      ? true
      : history.length === 0
        ? index === 0 || (!isCancelled && index <= currentIndex)
        : !isCancelled && index <= currentIndex;
    const isCurrent = !isCancelled && order.status === step.status;
    if (reached) entry.classList.add("is-complete");
    if (isCurrent) entry.classList.add("is-current");

    const marker = document.createElement("span");
    marker.className = "tracking-step-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = reached ? "✓" : String(index + 1);
    const content = document.createElement("div");
    content.className = "tracking-step-content";
    const label = document.createElement("strong");
    label.textContent = step.label;
    content.append(label);
    const timestamp = formatDateTime(
      event?.changedAt || (step.status === "pending" ? order.createdAt : null),
    );
    if (timestamp) {
      const time = document.createElement("time");
      time.textContent = timestamp;
      if (event?.changedAt) time.dateTime = new Date(event.changedAt).toISOString();
      content.append(time);
    } else if (reached) {
      const unavailable = document.createElement("span");
      unavailable.className = "tracking-time-unavailable";
      unavailable.textContent = "Chưa ghi nhận thời gian";
      content.append(unavailable);
    }
    entry.append(marker, content);
    return entry;
  }

  function renderTimeline(order) {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const stepsElement = document.querySelector("#tracking-steps");
    const currentIndex = ORDER_STEPS.findIndex(
      (step) => step.status === order.status,
    );
    stepsElement.replaceChildren(
      ...ORDER_STEPS.map((step, index) =>
        createTimelineStep(step, index, history, order, currentIndex),
      ),
    );

    const cancelEvent = history.find((event) => event.status === "cancelled");
    const cancelNotice = document.querySelector("#tracking-cancel-notice");
    if (order.status === "cancelled") {
      const time = formatDateTime(cancelEvent?.changedAt);
      cancelNotice.textContent = time
        ? `Đơn hàng đã bị hủy · ${time}`
        : "Đơn hàng đã bị hủy.";
      cancelNotice.hidden = false;
    } else {
      cancelNotice.hidden = true;
    }
    document.querySelector("#tracking-history-note").hidden =
      history.length > 0;
  }

  function renderItems(order) {
    const container = document.querySelector("#detail-order-items");
    container.replaceChildren(
      ...(Array.isArray(order.items) ? order.items : []).map((item) => {
        const row = document.createElement("article");
        row.className = "detail-order-item";
        const image = document.createElement("img");
        image.src = item.image || "";
        image.alt = item.name || "Sản phẩm";
        image.loading = "lazy";
        const copy = document.createElement("div");
        copy.className = "detail-order-item-copy";
        const name = document.createElement("strong");
        name.textContent = item.name || "Sản phẩm";
        const quantity = document.createElement("span");
        quantity.textContent = `${item.variant || "Tiêu chuẩn"} · Số lượng: ${Number(item.quantity) || 0}`;
        const price = document.createElement("small");
        price.textContent = formatPrice(item.price);
        copy.append(name, quantity, price);
        const lineTotal = document.createElement("strong");
        lineTotal.textContent = formatPrice(
          item.lineTotal ?? Number(item.price) * Number(item.quantity),
        );
        row.append(image, copy, lineTotal);
        return row;
      }),
    );
  }

  function renderOrder(order) {
    document.querySelector("#detail-order-number").textContent =
      order.orderNumber || `#${order.id}`;
    const orderStatus = document.querySelector("#detail-order-status");
    orderStatus.className = `order-status-badge status-${STATUS_LABELS[order.status] ? order.status : "unknown"}`;
    orderStatus.textContent = STATUS_LABELS[order.status] || "Đang cập nhật";
    document.querySelector("#detail-recipient").textContent =
      order.recipientName || "—";
    document.querySelector("#detail-phone").textContent = order.phone || "—";
    document.querySelector("#detail-address").textContent = order.address || "—";
    document.querySelector("#detail-total").textContent = formatPrice(order.total);
    document.querySelector("#detail-payment-method").textContent =
      PAYMENT_METHOD_LABELS[order.paymentMethod] || "Khác";
    document.querySelector("#detail-payment-status").textContent =
      PAYMENT_STATUS_LABELS[order.paymentStatus] || "Đang cập nhật";
    document.querySelector("#detail-created-at").textContent =
      formatDateTime(order.createdAt) || "—";
    document.querySelector("#detail-estimated-delivery").textContent =
      formatDateTime(order.estimatedDeliveryAt) || "Chưa xác định";
    renderItems(order);
    renderTimeline(order);
    detailCard.hidden = false;
    document.querySelector("#tracking-refresh-note").textContent =
      "Tự cập nhật mỗi 15 giây.";
    statusElement.hidden = true;
    hasLoadedOrder = true;
  }

  function showLoginRequired() {
    statusElement.replaceChildren(
      document.createTextNode("Đăng nhập để xem tiến trình đơn hàng. "),
    );
    const link = document.createElement("a");
    link.href = "../auth/login.html";
    link.textContent = "Đăng nhập";
    statusElement.append(link);
    statusElement.hidden = false;
  }

  async function loadOrder() {
    if (loading || document.hidden) return;
    if (!window.stationeryApi.isAuthenticated()) {
      showLoginRequired();
      return;
    }
    if (
      typeof orderId !== "string" ||
      !/^\d+$/.test(orderId) ||
      !Number.isSafeInteger(Number(orderId)) ||
      Number(orderId) < 1
    ) {
      showStatus("Mã đơn hàng không hợp lệ.", true);
      return;
    }

    loading = true;
    try {
      const response = await window.stationeryApi.get(
        `/orders/${encodeURIComponent(orderId)}`,
      );
      if (!response?.order) {
        throw new Error("Backend chưa trả về thông tin đơn hàng.");
      }
      renderOrder(response.order);
    } catch (error) {
      if (error.status === 401) {
        showLoginRequired();
      } else if (error.status === 404) {
        showStatus(
          "Không tìm thấy đơn hàng hoặc tài khoản hiện tại không có quyền xem.",
          true,
        );
      } else if (!hasLoadedOrder) {
        showStatus(error.message || "Không thể tải chi tiết đơn hàng.", true);
      } else {
        showStatus(
          "Chưa thể cập nhật tiến trình. Hệ thống sẽ tự thử lại.",
          true,
        );
      }
    } finally {
      loading = false;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadOrder();
  });
  window.setInterval(loadOrder, 15000);
  loadOrder();
})();
