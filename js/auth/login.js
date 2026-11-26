const API_BASE_URL = "http://localhost:3000/api";

function showMessage(element, message, state = "error") {
  element.textContent = message;
  element.dataset.state = state;
}

async function submitAuthForm(form, endpoint, messageElement, payload) {
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Đang xử lý...";
  messageElement.textContent = "";

  try {
    const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (!result) {
      throw new Error("Phản hồi từ máy chủ không hợp lệ.");
    }
    if (!response.ok) {
      throw new Error(result.message || "Không thể xác thực tài khoản.");
    }

    localStorage.setItem("stationery-auth-token", result.token);
    localStorage.setItem("authUser", JSON.stringify(result.user));
    showMessage(messageElement, result.message, "success");
    window.setTimeout(() => {
      window.location.href = "../../index.html";
    }, 800);
  } catch (error) {
    console.error("Xác thực tài khoản thất bại:", error);
    showMessage(
      messageElement,
      error instanceof TypeError
        ? "Không kết nối được API. Hãy kiểm tra backend và cấu hình mạng."
        : error.message,
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
}

const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const registerForm = document.querySelector("#register-form");
const registerMessage = document.querySelector("#register-message");

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuthForm(loginForm, "login", loginMessage, {
    email: loginForm.elements.email.value.trim(),
    password: loginForm.elements.password.value,
  });
});

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const password = registerForm.elements.password.value;
  const confirmPassword = registerForm.elements.confirmPassword.value;
  if (password !== confirmPassword) {
    showMessage(registerMessage, "Mật khẩu xác nhận không khớp.");
    return;
  }

  submitAuthForm(registerForm, "register", registerMessage, {
    name: registerForm.elements.name.value.trim(),
    email: registerForm.elements.email.value.trim(),
    phone: registerForm.elements.phone.value.trim(),
    password,
  });
});
