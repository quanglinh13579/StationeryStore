const adminStatus = document.querySelector("#admin-status");
const adminApp = document.querySelector("#admin-app");
const adminName = document.querySelector("#admin-name");
const adminNotice = document.querySelector("#admin-notice");
const pageSize = 20;

const sectionTitles = {
  dashboard: "Dashboard",
  products: "Sản phẩm",
  categories: "Danh mục",
  orders: "Đơn hàng",
  customers: "Khách hàng",
};
const orderStatusLabels = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị hàng",
  shipping: "Đang giao",
  completed: "Giao hàng thành công",
  cancelled: "Đã hủy",
};
const paymentStatusLabels = {
  unpaid: "Chưa thanh toán",
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thất bại",
  cancelled: "Đã hủy",
};
const orderTransitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["shipping", "cancelled"],
  shipping: ["completed"],
  completed: [],
  cancelled: [],
};
const state = {
  products: { items: [], page: 1, total: 0, nextPage: null },
  categories: [],
  orders: { items: [], page: 1, total: 0, nextPage: null },
  customers: { items: [], page: 1, total: 0, nextPage: null },
};
function showNotice(message, type = "info") {
  adminNotice.textContent = message;
  adminNotice.className = `admin-notice is-${type}`;
  adminNotice.hidden = false;
}

function clearNotice() {
  adminNotice.textContent = "";
  adminNotice.hidden = true;
}

function formatPrice(value) {
  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("vi-VN");
}

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createButton(text, className, onClick) {
  const button = createElement("button", className, text);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function renderTable(container, headers, rows, emptyMessage) {
  container.replaceChildren();
  if (rows.length === 0) {
    container.append(createElement("p", "table-empty", emptyMessage));
    return;
  }
  const table = createElement("table", "admin-table");
  const head = createElement("thead");
  const headerRow = createElement("tr");
  headers.forEach((header) => headerRow.append(createElement("th", "", header)));
  head.append(headerRow);
  const body = createElement("tbody");
  rows.forEach((cells) => {
    const row = createElement("tr");
    cells.forEach((cell) => {
      const td = createElement("td");
      if (cell instanceof Node) td.append(cell);
      else td.textContent = String(cell ?? "");
      row.append(td);
    });
    body.append(row);
  });
  table.append(head, body);
  container.append(table);
}

function renderPagination(container, page, total, nextPage, onPageChange) {
  container.replaceChildren();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  container.hidden = pageCount <= 1;
  const label = createElement("span", "", `Trang ${page} / ${pageCount}`);
  const previous = createButton("← Trước", "button button-secondary", () =>
    onPageChange(page - 1),
  );
  const next = createButton("Sau →", "button button-secondary", () =>
    onPageChange(nextPage),
  );
  previous.disabled = page <= 1;
  next.disabled = nextPage === null;
  container.append(previous, label, next);
}

function renderStatusBadge(status, labels) {
  return createElement(
    "span",
    `status-badge status-${status}`,
    labels[status] || status,
  );
}

async function loadDashboard() {
  try {
    const { dashboard } = await window.stationeryApi.get("/admin/dashboard");
    document.querySelector("#metric-products").textContent =
      Number(dashboard.totalProducts).toLocaleString("vi-VN");
    document.querySelector("#metric-orders").textContent =
      Number(dashboard.totalOrders).toLocaleString("vi-VN");
    document.querySelector("#metric-revenue").textContent = formatPrice(
      dashboard.totalRevenue,
    );
    clearNotice();
  } catch (error) {
    showNotice(error.message || "Không thể tải số liệu tổng quan.", "error");
  }
}

async function loadProducts() {
  const query = new URLSearchParams({
    page: String(state.products.page),
    limit: String(pageSize),
    status: document.querySelector("#product-status").value,
  });
  const search = document.querySelector("#product-search").value.trim();
  if (search) query.set("search", search);
  try {
    const result = await window.stationeryApi.get(
      `/admin/products?${query.toString()}`,
    );
    state.products = {
      items: result.products,
      page: result.page,
      total: result.total,
      nextPage: result.nextPage,
    };
    renderProducts();
    renderPagination(
      document.querySelector("#products-pagination"),
      state.products.page,
      state.products.total,
      state.products.nextPage,
      (page) => {
        state.products.page = page;
        loadProducts();
      },
    );
    clearNotice();
  } catch (error) {
    showNotice(error.message || "Không thể tải danh sách sản phẩm.", "error");
  }
}

function renderProducts() {
  const rows = state.products.items.map((product) => {
    const name = createElement("div", "table-primary");
    name.append(
      createElement("strong", "", product.name),
      createElement("small", "", product.id),
    );
    const actions = createElement("div", "table-actions");
    actions.append(
      createButton("Sửa", "button button-small button-secondary", () =>
        openProductModal(product),
      ),
    );
    if (product.isActive) {
      actions.append(
        createButton("Ẩn", "button button-small button-danger-outline", () =>
          deleteProduct(product),
        ),
      );
    }
    return [
      name,
      product.category.join(", ") || "Chưa phân loại",
      formatPrice(product.price),
      Number(product.stock).toLocaleString("vi-VN"),
      renderStatusBadge(
        product.isActive ? "active" : "inactive",
        { active: "Đang hiện", inactive: "Đã ẩn" },
      ),
      actions,
    ];
  });
  renderTable(
    document.querySelector("#products-table"),
    ["Sản phẩm", "Danh mục", "Giá bán", "Tồn kho", "Trạng thái", "Thao tác"],
    rows,
    "Chưa có sản phẩm phù hợp.",
  );
}

async function loadCategories() {
  try {
    const result = await window.stationeryApi.get("/admin/categories");
    state.categories = result.categories;
    renderCategories();
    clearNotice();
    return result.categories;
  } catch (error) {
    showNotice(error.message || "Không thể tải danh mục.", "error");
    throw error;
  }
}

function renderCategories() {
  const rows = state.categories.map((category) => {
    const actions = createElement("div", "table-actions");
    actions.append(
      createButton("Sửa", "button button-small button-secondary", () =>
        openCategoryModal(category),
      ),
    );
    if (category.isActive) {
      actions.append(
        createButton("Ẩn", "button button-small button-danger-outline", () =>
          deleteCategory(category),
        ),
      );
    }
    return [
      createElement("code", "", category.slug),
      createElement("strong", "", category.name),
      category.description || "—",
      Number(category.productsCount).toLocaleString("vi-VN"),
      renderStatusBadge(
        category.isActive ? "active" : "inactive",
        { active: "Đang hiện", inactive: "Đã ẩn" },
      ),
      actions,
    ];
  });
  renderTable(
    document.querySelector("#categories-table"),
    ["Mã", "Danh mục", "Mô tả", "Sản phẩm", "Trạng thái", "Thao tác"],
    rows,
    "Chưa có danh mục.",
  );
}

async function loadOrders() {
  const query = new URLSearchParams({
    page: String(state.orders.page),
    limit: String(pageSize),
  });
  try {
    const result = await window.stationeryApi.get(
      `/admin/orders?${query.toString()}`,
    );
    state.orders = {
      items: result.orders,
      page: result.page,
      total: result.total,
      nextPage: result.nextPage,
    };
    renderOrders();
    renderPagination(
      document.querySelector("#orders-pagination"),
      state.orders.page,
      state.orders.total,
      state.orders.nextPage,
      (page) => {
        state.orders.page = page;
        loadOrders();
      },
    );
    clearNotice();
  } catch (error) {
    showNotice(error.message || "Không thể tải đơn hàng.", "error");
  }
}

function renderOrderDetails(order) {
  const details = createElement("details", "order-details");
  const summary = createElement("summary", "", "Chi tiết sản phẩm");
  const list = createElement("ul");
  order.items.forEach((item) => {
    const variant = item.variant ? ` · ${item.variant}` : "";
    list.append(
      createElement(
        "li",
        "",
        `${item.name}${variant} × ${item.quantity} — ${formatPrice(item.lineTotal)}`,
      ),
    );
  });
  details.append(summary, list);
  return details;
}

function renderOrders() {
  const rows = state.orders.items.map((order) => {
    const recipient = createElement("div", "table-primary");
    recipient.append(
      createElement("strong", "", order.orderNumber),
      createElement("small", "", `${order.recipientName} · ${order.phone}`),
      createElement("small", "", order.address),
      renderOrderDetails(order),
    );
    const payment = createElement("div", "table-primary");
    payment.append(
      createElement(
        "strong",
        "",
        { cod: "COD", bank_transfer: "Chuyển khoản", momo: "MoMo" }[
          order.paymentMethod
        ] || order.paymentMethod,
      ),
      createElement(
        "small",
        "",
        paymentStatusLabels[order.paymentStatus] || "—",
      ),
    );

    const statusControl = createElement("div", "order-status-control");
    const select = createElement("select", "status-select");
    select.setAttribute("aria-label", `Trạng thái ${order.orderNumber}`);
    const options = [
      order.status,
      ...(orderTransitions[order.status] || []),
    ];
    [...new Set(options)].forEach((status) => {
      const option = createElement(
        "option",
        "",
        orderStatusLabels[status] || status,
      );
      option.value = status;
      option.selected = status === order.status;
      select.append(option);
    });
    const paymentPending =
      order.paymentMethod === "momo" && order.paymentStatus === "pending";
    const updateButton = createButton(
      "Cập nhật",
      "button button-small button-primary",
      () => updateOrderStatus(order, select.value),
    );
    updateButton.disabled =
      paymentPending || !(orderTransitions[order.status] || []).length;
    select.disabled = updateButton.disabled;
    if (paymentPending) {
      statusControl.append(
        createElement("small", "order-lock-note", "Chờ MoMo xác nhận thanh toán"),
      );
    }
    statusControl.append(select, updateButton);

    return [
      recipient,
      formatDate(order.createdAt),
      formatPrice(order.total),
      payment,
      renderStatusBadge(order.status, orderStatusLabels),
      statusControl,
    ];
  });
  renderTable(
    document.querySelector("#orders-table"),
    ["Đơn hàng / người nhận", "Ngày tạo", "Tổng tiền", "Thanh toán", "Trạng thái", "Cập nhật"],
    rows,
    "Chưa có đơn hàng.",
  );
}

async function updateOrderStatus(order, status) {
  if (status === order.status) return;
  try {
    await window.stationeryApi.patch(
      `/admin/orders/${encodeURIComponent(order.id)}/status`,
      { status },
    );
    await Promise.all([loadOrders(), loadDashboard()]);
    showNotice(`Đã cập nhật đơn ${order.orderNumber}.`, "success");
  } catch (error) {
    showNotice(error.message || "Không thể cập nhật đơn hàng.", "error");
  }
}

async function loadCustomers() {
  const query = new URLSearchParams({
    page: String(state.customers.page),
    limit: String(pageSize),
  });
  const search = document.querySelector("#customer-search").value.trim();
  if (search) query.set("search", search);
  try {
    const result = await window.stationeryApi.get(
      `/admin/customers?${query.toString()}`,
    );
    state.customers = {
      items: result.customers,
      page: result.page,
      total: result.total,
      nextPage: result.nextPage,
    };
    renderCustomers();
    renderPagination(
      document.querySelector("#customers-pagination"),
      state.customers.page,
      state.customers.total,
      state.customers.nextPage,
      (page) => {
        state.customers.page = page;
        loadCustomers();
      },
    );
    clearNotice();
  } catch (error) {
    showNotice(error.message || "Không thể tải khách hàng.", "error");
  }
}

function renderCustomers() {
  const rows = state.customers.items.map((customer) => [
    createElement("strong", "", customer.name),
    customer.email,
    customer.phone || "—",
    formatDate(customer.createdAt),
  ]);
  renderTable(
    document.querySelector("#customers-table"),
    ["Họ tên", "Email", "Số điện thoại", "Ngày đăng ký"],
    rows,
    "Chưa có tài khoản khách hàng.",
  );
}

function activateSection(section) {
  if (!sectionTitles[section]) return;
  document.querySelector("#section-title").textContent =
    sectionTitles[section];
  document.querySelectorAll(".admin-section").forEach((panel) => {
    panel.hidden = panel.id !== `section-${section}`;
  });
  document.querySelectorAll(".admin-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });
  clearNotice();
  if (section === "dashboard") loadDashboard();
  if (section === "products") loadProducts();
  if (section === "categories") loadCategories();
  if (section === "orders") loadOrders();
  if (section === "customers") loadCustomers();
}

function showModal(modal) {
  modal.hidden = false;
  const firstInput = modal.querySelector("input:not([disabled]), textarea");
  if (firstInput) firstInput.focus();
}

function closeModal(modal) {
  modal.hidden = true;
}

function setFormMessage(element, message, isError = true) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
  element.classList.toggle("is-success", !isError);
}

async function openProductModal(product = null) {
  try {
    const form = document.querySelector("#product-form");
    form.reset();
    form.dataset.editSlug = product ? product.id : "";
    document.querySelector("#product-form-message").textContent = "";
    const categories = await window.stationeryApi.get("/admin/categories");
    state.categories = categories.categories;
    const categorySelect = document.querySelector("#product-categories");
    categorySelect.replaceChildren();
    state.categories
      .filter((category) => category.isActive)
      .forEach((category) => {
        const option = createElement("option", "", category.name);
        option.value = category.slug;
        option.selected = Boolean(
          product && product.category.includes(category.slug),
        );
        categorySelect.append(option);
      });

    const slugInput = form.elements.slug;
    slugInput.disabled = Boolean(product);
    if (product) {
      document.querySelector("#product-modal-title").textContent =
        "Chỉnh sửa sản phẩm";
      slugInput.value = product.id;
      form.elements.name.value = product.name;
      form.elements.description.value = product.description;
      form.elements.image.value = product.image;
      form.elements.price.value = product.price;
      form.elements.originalPrice.value = product.originalPrice ?? "";
      form.elements.stock.value = product.stock;
      form.elements.popular.checked = product.popular;
      form.elements.latest.checked = product.latest;
    } else {
      document.querySelector("#product-modal-title").textContent =
        "Thêm sản phẩm";
    }
    showModal(document.querySelector("#product-modal"));
  } catch (error) {
    showNotice(error.message || "Không thể tải danh mục cho sản phẩm.", "error");
  }
}

async function deleteProduct(product) {
  if (!window.confirm(`Ẩn sản phẩm "${product.name}" khỏi cửa hàng?`)) return;
  try {
    await window.stationeryApi.delete(
      `/admin/products/${encodeURIComponent(product.id)}`,
    );
    await Promise.all([loadProducts(), loadDashboard()]);
    showNotice("Đã ẩn sản phẩm khỏi cửa hàng.", "success");
  } catch (error) {
    showNotice(error.message || "Không thể ẩn sản phẩm.", "error");
  }
}

async function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#product-form-message");
  const submitButton = form.querySelector('button[type="submit"]');
  if (!form.reportValidity()) return;
  const categories = Array.from(
    form.elements.categories.selectedOptions,
    (option) => option.value,
  );
  const data = {
    slug: form.elements.slug.value.trim(),
    name: form.elements.name.value.trim(),
    description: form.elements.description.value.trim(),
    image: form.elements.image.value.trim(),
    price: Number(form.elements.price.value),
    originalPrice: form.elements.originalPrice.value
      ? Number(form.elements.originalPrice.value)
      : null,
    stock: Number(form.elements.stock.value),
    categories,
    popular: form.elements.popular.checked,
    latest: form.elements.latest.checked,
  };
  const editSlug = form.dataset.editSlug;
  submitButton.disabled = true;
  try {
    const result = editSlug
      ? await window.stationeryApi.put(
          `/admin/products/${encodeURIComponent(editSlug)}`,
          data,
        )
      : await window.stationeryApi.post("/admin/products", data);
    closeModal(document.querySelector("#product-modal"));
    form.dataset.editSlug = "";
    state.products.page = 1;
    await Promise.all([loadProducts(), loadDashboard()]);
    showNotice(result.message || "Đã lưu sản phẩm.", "success");
  } catch (error) {
    setFormMessage(message, error.message || "Không thể lưu sản phẩm.");
  } finally {
    submitButton.disabled = false;
  }
}

function openCategoryModal(category = null) {
  const form = document.querySelector("#category-form");
  form.reset();
  form.dataset.editSlug = category ? category.slug : "";
  document.querySelector("#category-form-message").textContent = "";
  document.querySelector("#category-modal-title").textContent = category
    ? "Chỉnh sửa danh mục"
    : "Thêm danh mục";
  form.elements.slug.disabled = Boolean(category);
  if (category) {
    form.elements.slug.value = category.slug;
    form.elements.name.value = category.name;
    form.elements.description.value = category.description;
  }
  showModal(document.querySelector("#category-modal"));
}

async function deleteCategory(category) {
  if (!window.confirm(`Ẩn danh mục "${category.name}" khỏi cửa hàng?`)) return;
  try {
    await window.stationeryApi.delete(
      `/admin/categories/${encodeURIComponent(category.slug)}`,
    );
    state.categories = [];
    await loadCategories();
    showNotice("Đã ẩn danh mục khỏi cửa hàng.", "success");
  } catch (error) {
    showNotice(error.message || "Không thể ẩn danh mục.", "error");
  }
}

async function saveCategory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#category-form-message");
  const submitButton = form.querySelector('button[type="submit"]');
  if (!form.reportValidity()) return;
  const data = {
    slug: form.elements.slug.value.trim(),
    name: form.elements.name.value.trim(),
    description: form.elements.description.value.trim(),
  };
  const editSlug = form.dataset.editSlug;
  submitButton.disabled = true;
  try {
    const result = editSlug
      ? await window.stationeryApi.put(
          `/admin/categories/${encodeURIComponent(editSlug)}`,
          data,
        )
      : await window.stationeryApi.post("/admin/categories", data);
    closeModal(document.querySelector("#category-modal"));
    state.categories = [];
    await loadCategories();
    showNotice(result.message || "Đã lưu danh mục.", "success");
  } catch (error) {
    setFormMessage(message, error.message || "Không thể lưu danh mục.");
  } finally {
    submitButton.disabled = false;
  }
}

document.querySelectorAll(".admin-nav button").forEach((button) => {
  button.addEventListener("click", () => activateSection(button.dataset.section));
});
document.querySelector("#admin-logout").addEventListener("click", () => {
  window.stationeryApi.logout();
  window.location.replace("../auth/login.html");
});
document.querySelectorAll("[data-refresh]").forEach((button) => {
  button.addEventListener("click", () => {
    const section = button.dataset.refresh;
    if (section === "dashboard") loadDashboard();
    if (section === "orders") loadOrders();
    if (section === "customers") loadCustomers();
  });
});
document.querySelector("#add-product").addEventListener("click", () => {
  openProductModal();
});
document.querySelector("#search-products").addEventListener("click", () => {
  state.products.page = 1;
  loadProducts();
});
document.querySelector("#product-status").addEventListener("change", () => {
  state.products.page = 1;
  loadProducts();
});
document.querySelector("#product-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    state.products.page = 1;
    loadProducts();
  }
});
document.querySelector("#product-form").addEventListener("submit", saveProduct);
document.querySelector("#add-category").addEventListener("click", () => {
  openCategoryModal();
});
document
  .querySelector("#category-form")
  .addEventListener("submit", saveCategory);
document.querySelector("#search-customers").addEventListener("click", () => {
  state.customers.page = 1;
  loadCustomers();
});
document.querySelector("#customer-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    state.customers.page = 1;
    loadCustomers();
  }
});
document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    closeModal(button.closest(".modal-backdrop"));
  });
});
document.querySelectorAll(".modal-backdrop").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal);
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-backdrop:not([hidden])").forEach(closeModal);
  }
});

async function verifyAdminAccess() {
  if (!window.stationeryApi.isAuthenticated()) {
    window.location.replace("../auth/login.html");
    return;
  }
  try {
    const result = await window.stationeryApi.get("/admin/check");
    if (!result.user || result.user.role !== "admin") {
      adminStatus.textContent = "Tài khoản này không có quyền Admin.";
      return;
    }
    adminName.textContent = result.user.name;
    adminStatus.hidden = true;
    adminApp.hidden = false;
    await loadDashboard();
  } catch (error) {
    if (error.status === 401) {
      window.location.replace("../auth/login.html");
      return;
    }
    adminStatus.textContent =
      error.status === 403
        ? "Tài khoản này không có quyền truy cập trang Admin."
        : error.message || "Không thể xác minh quyền Admin.";
  }
}

verifyAdminAccess();
