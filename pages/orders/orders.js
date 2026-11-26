(() => {
  const statusElement = document.querySelector("#orders-page-status");
  const listElement = document.querySelector("#my-orders-list");
  const refreshButton = document.querySelector("#refresh-orders");
  const ORDER_STATUS_LABELS = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    preparing: "Đang chuẩn bị hàng",
    shipping: "Đang giao",
    completed: "Đã giao",
    cancelled: "Đã hủy",
  };
  const PROGRESS_STEPS = [
    { status: "confirmed", label: "Đã xác nhận" },
    { status: "shipping", label: "Đang giao" },
    { status: "completed", label: "Đã giao" },
  ];
  let loading = false;
  let loaded = false;

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString("vi-VN");
  }

  function formatHistoryDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  function makeSvgIcon(className, paths) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    paths.forEach((definition) => {
      const path = document.createElementNS(namespace, "path");
      path.setAttribute("d", definition);
      svg.append(path);
    });
    return svg;
  }

  function makePackageIcon() {
    return makeSvgIcon("order-package-icon", [
      "m12 2 9 5-9 5-9-5 9-5Z",
      "M3 7v10l9 5 9-5V7",
      "M12 12v10",
      "m7.5 4.5 9 5",
      "m16.5 4.5-9 5",
    ]);
  }

  function makeTruckIcon() {
    return makeSvgIcon("order-step-icon", [
      "M3 6h11v10H3z",
      "M14 10h4l3 3v3h-7z",
      "M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
      "M18 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
    ]);
  }

  function makeCalendarIcon() {
    return makeSvgIcon("order-calendar-icon", [
      "M5 4v3",
      "M19 4v3",
      "M4 8h16",
      "M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z",
      "M8 12h2",
      "M14 12h2",
    ]);
  }

  function makeStatusBadge(status) {
    const badge = document.createElement("span");
    const knownStatus = Object.prototype.hasOwnProperty.call(
      ORDER_STATUS_LABELS,
      status,
    );
    badge.className = `order-status-badge status-${knownStatus ? status : "unknown"}`;
    badge.textContent = ORDER_STATUS_LABELS[status] || "Đang cập nhật";

    const symbol = document.createElement("span");
    symbol.className = "order-status-symbol";
    symbol.setAttribute("aria-hidden", "true");
    if (status === "shipping") {
      symbol.append(makeTruckIcon());
    } else {
      symbol.textContent =
        status === "cancelled"
          ? "×"
          : status === "completed" || status === "confirmed"
            ? "✓"
            : "◷";
    }
    badge.prepend(symbol);
    return badge;
  }

  function getProgressIndex(status) {
    if (status === "confirmed" || status === "preparing") return 0;
    if (status === "shipping") return 1;
    if (status === "completed") return 2;
    return -1;
  }

  function renderProgress(order) {
    const currentIndex = getProgressIndex(order.status);
    if (currentIndex < 0) return null;

    const history = new Map(
      (Array.isArray(order.statusHistory) ? order.statusHistory : []).map(
        (event) => [event.status, event.changedAt],
      ),
    );
    const progress = document.createElement("ol");
    progress.className = "order-mini-progress";
    progress.setAttribute("aria-label", "Tiến trình đơn hàng");

    PROGRESS_STEPS.forEach((step, index) => {
      const item = document.createElement("li");
      item.className = "order-progress-step";
      const isComplete =
        order.status === "completed" || index < currentIndex;
      const isCurrent = index === currentIndex;
      if (isComplete) item.classList.add("is-complete");
      if (isCurrent) item.classList.add("is-current");

      const marker = document.createElement("span");
      marker.className = "order-progress-marker";
      if (step.status === "shipping" && isCurrent) {
        marker.append(makeTruckIcon());
      } else {
        marker.textContent = isComplete || isCurrent ? "✓" : "";
      }

      const label = document.createElement("strong");
      label.textContent = step.label;
      const timestamp = formatHistoryDate(history.get(step.status));

      item.append(marker, label);
      if (timestamp) {
        const time = document.createElement("time");
        time.textContent = timestamp;
        item.append(time);
      }
      progress.append(item);
    });
    return progress;
  }

  function getOrderDescription(order) {
    switch (order.status) {
      case "pending":
        return "Đơn hàng đang chờ xác nhận từ shop.";
      case "confirmed":
        return "Đơn hàng đã được cửa hàng xác nhận.";
      case "preparing":
        return "Cửa hàng đang chuẩn bị đơn hàng.";
      case "shipping":
        return Array.isArray(order.items) && order.items.length
          ? `Đơn hàng gồm ${order.items.length} sản phẩm đang được giao.`
          : "Đơn hàng chưa có thông tin sản phẩm.";
      case "completed":
        return "Đơn hàng đã được giao thành công.";
      case "cancelled":
        return "Đơn hàng đã bị hủy.";
      default:
        return "Trạng thái đơn hàng đang được cập nhật.";
    }
  }

  function createOrderCard(order) {
    const card = document.createElement("article");
    const hasProgress = getProgressIndex(order.status) >= 0;
    card.className = `my-order-card${hasProgress ? " order-card--has-progress" : ""}`;

    const identity = document.createElement("div");
    identity.className = "order-card-identity";
    const identityPanel = document.createElement("div");
    identityPanel.className = "order-card-identity-panel";
    identityPanel.append(makePackageIcon());

    const number = document.createElement("strong");
    number.className = "order-card-number";
    number.textContent = order.orderNumber || `#${order.id}`;

    const date = document.createElement("span");
    date.className = "order-card-date";
    date.append(makeCalendarIcon());
    date.append(document.createTextNode(`Ngày đặt: ${formatDate(order.createdAt)}`));
    identityPanel.append(number, date);
    identity.append(identityPanel);

    const content = document.createElement("div");
    content.className = "order-card-content";
    const statusLine = document.createElement("div");
    statusLine.className = "order-card-status-line";
    statusLine.append(makeStatusBadge(order.status));

    const description = document.createElement("p");
    description.className = "order-card-description";
    description.textContent = getOrderDescription(order);
    content.append(statusLine, description);

    const progress = renderProgress(order);
    if (progress) content.append(progress);

    const detailsLink = document.createElement("a");
    detailsLink.className = "order-tracking-button";
    if (order.status === "completed") {
      detailsLink.classList.add("order-tracking-button--primary");
    }
    detailsLink.href = `detail.html?orderId=${encodeURIComponent(order.id)}`;
    detailsLink.setAttribute("aria-label", `Xem chi tiết đơn ${order.orderNumber || order.id}`);
    detailsLink.append(document.createTextNode("Xem chi tiết "));
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    detailsLink.append(arrow);

    card.append(identity, content, detailsLink);
    return card;
  }

  function showMessage(message, isError = false) {
    statusElement.textContent = message;
    statusElement.hidden = false;
    statusElement.classList.toggle("is-error", isError);
  }

  function showLoginRequired() {
    statusElement.replaceChildren(
      document.createTextNode("Đăng nhập để xem đơn hàng của bạn. "),
    );
    const link = document.createElement("a");
    link.href = "../auth/login.html";
    link.textContent = "Đăng nhập";
    statusElement.append(link);
    statusElement.hidden = false;
  }

  async function loadOrders() {
    if (loading || document.hidden) return;
    if (!window.stationeryApi.isAuthenticated()) {
      showLoginRequired();
      return;
    }

    loading = true;
    refreshButton.disabled = true;
    if (!loaded) showMessage("Đang tải danh sách đơn hàng...");
    try {
      const result = await window.stationeryApi.get("/orders");
      if (!Array.isArray(result.orders)) {
        throw new Error("Backend trả về danh sách đơn hàng không hợp lệ.");
      }
      listElement.replaceChildren(
        ...result.orders.map((order) => createOrderCard(order)),
      );
      loaded = true;
      if (result.orders.length) {
        statusElement.hidden = true;
      } else {
        showMessage("Bạn chưa có đơn hàng nào.");
      }
    } catch (error) {
      if (error.status === 401) {
        showLoginRequired();
      } else {
        showMessage(
          error.message || "Không thể tải danh sách đơn hàng.",
          true,
        );
      }
    } finally {
      loading = false;
      refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener("click", loadOrders);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadOrders();
  });
  window.setInterval(loadOrders, 30000);
  loadOrders();
})();
