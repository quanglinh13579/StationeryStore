(() => {
  const placeholder = document.querySelector("#site-footer");
  if (!placeholder) return;

  const isCartPage = window.location.pathname.includes("/pages/cart/");
  const base = isCartPage ? "../.." : ".";

  placeholder.innerHTML = `
    <footer>
      <div class="container footer-grid" id="store">
        <div>
          <a class="brand footer-brand" href="${base}/index.html">
            <span class="brand-mark">✎</span><span>nét nhỏ.</span>
          </a>
          <p>Đồ dùng học tập và văn phòng phẩm giúp bạn sáng tạo mỗi ngày.</p>
          <p><a href="#reviews">Instagram　 Facebook　 TikTok</a></p>
        </div>
        <div>
          <h3>Hỗ trợ khách hàng</h3>
          <p><a href="tel:19002525">Hotline 1900 2525</a></p>
          <p><a href="mailto:hello@netnho.vn">hello@netnho.vn</a></p>
          <h3>Chăm sóc khách hàng</h3>
          <p><a href="#reviews">Câu hỏi thường gặp</a></p>
        </div>
        <div>
          <h3>Hệ thống cửa hàng</h3>
          <p>39 Nguyễn Huệ</p>
          <p>TP. Hồ Chí Minh</p>
          <h3>Thông tin</h3>
          <p><a href="#store">Về Nét Nhỏ</a></p>
        </div>
        <div>
          <h3>Mua sắm</h3>
          <p><a href="${base}/index.html#products">Sản phẩm nổi bật</a></p>
          <p><a href="${base}/index.html#categories">Danh mục sản phẩm</a></p>
          <h3>Chính sách</h3>
          <p><a href="#store">Đổi trả &amp; vận chuyển</a></p>
        </div>
      </div>
      <div class="container copyright">
        <span>© 2025 Nét Nhỏ. Bảo lưu mọi quyền.</span>
        <span>Chính sách bảo mật　|　Điều khoản sử dụng</span>
      </div>
    </footer>
  `;
})();
