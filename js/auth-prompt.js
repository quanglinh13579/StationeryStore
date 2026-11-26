(() => {
  const dialog = document.createElement("dialog");
  dialog.className = "auth-required-dialog";
  dialog.setAttribute("aria-labelledby", "auth-required-title");
  dialog.setAttribute("aria-describedby", "auth-required-message");

  const content = document.createElement("div");
  content.className = "auth-required-content";

  const icon = document.createElement("span");
  icon.className = "auth-required-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "♡";

  const title = document.createElement("h2");
  title.id = "auth-required-title";
  title.textContent = "Đăng nhập để tiếp tục";

  const message = document.createElement("p");
  message.id = "auth-required-message";

  const login = document.createElement("a");
  login.className = "auth-required-login";
  login.href = window.location.pathname.includes("/pages/")
    ? "../auth/login.html"
    : "./pages/auth/login.html";
  login.textContent = "Đăng nhập hoặc đăng ký";

  const close = document.createElement("button");
  close.className = "auth-required-close";
  close.type = "button";
  close.textContent = "Để sau";
  close.addEventListener("click", () => dialog.close());

  content.append(icon, title, message, login, close);
  dialog.append(content);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);

  window.stationeryAuthPrompt = Object.freeze({
    show(text) {
      message.textContent = text;
      if (!dialog.open) dialog.showModal();
      login.focus();
    },
  });
})();
