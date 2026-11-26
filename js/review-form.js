(() => {
  const api = window.stationeryApi;

  document.querySelectorAll("[data-review-form]").forEach((form) => {
    const loginPrompt = form.parentElement.querySelector(
      "[data-review-login-prompt]",
    );
    const productSelect = form.querySelector("[data-review-product-select]");
    const status = form.querySelector("[data-review-status]");
    const submitButton = form.querySelector('button[type="submit"]');

    function updateAccess() {
      const authenticated = api.isAuthenticated();
      form.hidden = !authenticated;
      if (loginPrompt) loginPrompt.hidden = authenticated;
    }

    updateAccess();
    window.addEventListener("storage", updateAccess);

    if (productSelect) {
      api
        .getProducts({ limit: 100 })
        .then(({ products }) => {
          productSelect.replaceChildren(
            new Option("Chọn sản phẩm bạn muốn nhận xét", ""),
            ...products.map((product) => new Option(product.name, product.id)),
          );
        })
        .catch((error) => {
          console.error("Không thể tải sản phẩm cho biểu mẫu nhận xét:", error);
          status.textContent = "Không tải được danh sách sản phẩm.";
        });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const productId = productSelect
        ? productSelect.value
        : form.dataset.reviewProductId;
      if (!productId) {
        status.textContent = "Vui lòng chọn sản phẩm.";
        return;
      }

      status.textContent = "Đang gửi nhận xét...";
      submitButton.disabled = true;
      try {
        const result = await api.createReview({
          productId,
          rating: Number(form.elements.rating.value),
          comment: form.elements.comment.value.trim(),
        });
        form.reset();
        if (productSelect) productSelect.value = productId;
        status.textContent = "Đã gửi nhận xét của bạn.";
        window.dispatchEvent(
          new CustomEvent("stationery:review-created", {
            detail: result,
          }),
        );
      } catch (error) {
        if (error.status === 401) {
          form.hidden = true;
          if (loginPrompt) {
            loginPrompt.hidden = false;
            const loginStatus = loginPrompt.querySelector(
              "[data-review-login-status]",
            );
            if (loginStatus) {
              loginStatus.textContent =
                "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
            }
          }
        } else {
          status.textContent = error.message;
        }
      } finally {
        submitButton.disabled = false;
      }
    });
  });
})();
