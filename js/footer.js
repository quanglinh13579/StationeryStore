(() => {
  const placeholder = document.querySelector("#site-footer");
  if (!placeholder) return;

  document.body.classList.add("has-site-footer");

  const isNestedPage =
    window.location.pathname.includes("/pages/cart/") ||
    window.location.pathname.includes("/pages/product/") ||
    window.location.pathname.includes("/pages/orders/") ||
    window.location.pathname.includes("/pages/checkout/") ||
    window.location.pathname.includes("/pages/payment-result/");
  const base = isNestedPage ? "../.." : ".";

  placeholder.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-grid" id="store">
        <section class="footer-about" aria-label="Giới thiệu">
          <a class="brand footer-brand" href="${base}/index.html">
            <span class="brand-mark">✎</span><span>nét nhỏ.</span>
          </a>
          <p>Đồ dùng học tập và văn phòng phẩm<br />cho mọi người.</p>
          <nav class="footer-socials" aria-label="Mạng xã hội">
            <a href="#reviews" aria-label="Facebook">f</a>
            <a href="#reviews" aria-label="YouTube">▶</a>
            <a href="#reviews" aria-label="TikTok">♪</a>
          </nav>
        </section>
        <section class="footer-links" aria-labelledby="footer-links-title">
          <h3 id="footer-links-title"><span aria-hidden="true">↗</span> Liên kết nhanh</h3>
          <a href="${base}/index.html">Trang chủ</a>
          <a href="${base}/index.html#products">Sản phẩm</a>
          <a href="#store">Liên hệ</a>
        </section>
        <section class="footer-contact" aria-labelledby="footer-contact-title">
          <h3 id="footer-contact-title"><span aria-hidden="true">☎</span> Liên hệ</h3>
          <a href="mailto:phonglonggg1234@gmail.com"><span aria-hidden="true">✉</span> phonglonggg1234@gmail.com</a>
        </section>
      </div>
      <div class="container copyright">
        <span>© 2026 Nét Nhỏ. Cùng bạn xây dựng tương lai.</span>
        <span><span aria-hidden="true">♥</span> Cùng bạn học tập tốt hơn</span>
      </div>
    </footer>
  `;
})();
