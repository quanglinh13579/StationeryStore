# StationeryStore

Website bán đồ dùng học tập. Frontend dùng HTML, CSS và JavaScript thuần; Backend
dùng Express, MySQL và JWT cho xác thực, sản phẩm, danh mục, giỏ hàng, yêu thích,
đơn hàng và các API quản trị.

## Yêu cầu

- Node.js 18 trở lên.
- MySQL 8 trở lên đang chạy.
- VS Code Live Server để mở frontend (mặc định `http://127.0.0.1:5500`).

## Cài đặt Backend

1. Mở `database/schema.sql` trong MySQL Workbench, chọn kết nối MySQL và chạy
   script để tạo database cùng toàn bộ bảng cần thiết.
2. Chạy `database/seed.sql` để thêm danh mục, sản phẩm và đánh giá ban đầu vào
   MySQL. Đây là dữ liệu khởi tạo trong database, không phải Mock API.

   Nếu database đã được tạo từ trước, chạy đúng một lần migration
   `database/migrations/001_checkout_orders.sql` để thêm ghi chú, khóa chống gửi
   đơn lặp và cập nhật trạng thái `completed`. Ví dụ dùng MySQL CLI:

   ```powershell
   mysql -u root -p stationery_store < database/migrations/001_checkout_orders.sql
   ```

   Migration giữ lại giá trị thanh toán `e_wallet` trong enum của database cũ
   để không làm hỏng đơn hàng lịch sử.

   Nếu database chưa có các cột MoMo, chạy migration một lần:

   ```powershell
   mysql -u root -p stationery_store < database/migrations/002_momo_payments.sql
   ```

   Nếu database đã được cập nhật các cột `payment_status` và `momo_*` từ lần
   thử trước, bỏ qua migration này để tránh thêm cột trùng.

   Máy phát triển Windows đã được cài MySQL portable để kiểm thử. Nếu dùng bản
   này, mở một PowerShell riêng và chạy lệnh sau; giữ cửa sổ này mở trong lúc
   chạy API:

   ```powershell
   $root = Join-Path $env:LOCALAPPDATA 'StationeryStore\mysql'
   $shortRoot = (& $env:ComSpec /d /c ('for %I in ("' + $root + '") do @echo %~sI') | Select-Object -Last 1).Trim()
   $mysqlHome = Join-Path $shortRoot 'mysql-8.4.9-winx64'
   $dataDir = Join-Path $shortRoot 'data-clean'
   & (Join-Path $mysqlHome 'bin\mysqld.exe') "--basedir=$mysqlHome" "--datadir=$dataDir" --port=3306 --bind-address=127.0.0.1 --mysqlx=0 --console
   ```

   Nếu đã cài MySQL bằng installer, chỉ cần khởi động dịch vụ MySQL thay vì
   chạy lệnh portable trên.

3. Tạo file cấu hình cục bộ:

   ```powershell
   Copy-Item .env.example .env
   ```

   Sửa thông tin MySQL trong `.env`. Tạo JWT secret riêng bằng lệnh:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Chép chuỗi được in ra vào `JWT_SECRET`. Không đưa `.env` lên Git.

4. Cài package và chạy API:

   ```powershell
   npm install
   npm start
   ```

   Mở `http://localhost:3000/api/health`; kết quả cần có
   `"database": "connected"`. Nếu cổng 3000 đang được một tiến trình khác sử
   dụng, dừng API cũ trước khi chạy lại để tiến trình mới nạp các route hiện
   tại.

5. Mở `index.html` bằng Live Server. Frontend gọi API tại
   `http://localhost:3000/api`; màn hình đăng nhập/đăng ký nằm chung tại
   `pages/auth/login.html`.

## API

| Method | Endpoint             | Mô tả                                    |
| ------ | -------------------- | ---------------------------------------- |
| POST   | `/api/auth/register` | Tạo tài khoản User                       |
| POST   | `/api/auth/login`    | Đăng nhập và nhận JWT                    |
| GET    | `/api/auth/me`       | Lấy tài khoản hiện tại; cần Bearer token |
| GET    | `/api/products`      | Danh sách, tìm kiếm, lọc và phân trang sản phẩm |
| GET    | `/api/products/:slug` | Chi tiết sản phẩm                       |
| GET    | `/api/categories`    | Danh sách danh mục                       |
| GET    | `/api/categories/:slug` | Chi tiết danh mục                     |
| GET    | `/api/categories/:slug/products` | Sản phẩm theo danh mục       |
| GET/POST | `/api/reviews`     | Xem đánh giá hoặc gửi nhận xét; POST cần đăng nhập |
| GET    | `/api/cart`          | Xem giỏ hàng; cần đăng nhập              |
| POST   | `/api/cart/items`    | Thêm/cộng sản phẩm vào giỏ; cần đăng nhập |
| PATCH/DELETE | `/api/cart/items/:productId` | Sửa hoặc xóa món hàng; cần đăng nhập |
| DELETE | `/api/cart`          | Xóa giỏ hàng; cần đăng nhập              |
| GET/POST | `/api/favorites`   | Xem hoặc thêm yêu thích; cần đăng nhập   |
| DELETE | `/api/favorites/:productId` | Xóa yêu thích; cần đăng nhập       |
| GET/POST | `/api/orders`     | Xem đơn hàng hoặc đặt hàng; cần đăng nhập |
| GET    | `/api/orders/:orderId` | Chi tiết đơn hàng của người dùng       |
| POST   | `/api/orders/:orderId/cancel` | Hủy đơn đang chờ xác nhận; cần đăng nhập |
| POST   | `/api/payments/momo/ipn` | MoMo gửi kết quả; Backend xác thực chữ ký |
| GET/POST/PUT/DELETE | `/api/admin/products[/:slug]` | Xem và quản lý sản phẩm; cần Admin |
| GET/POST/PUT/DELETE | `/api/admin/categories[/:slug]` | Xem và quản lý danh mục; cần Admin |
| GET | `/api/admin/dashboard` | Tổng sản phẩm, đơn hàng, doanh thu; cần Admin |
| GET | `/api/admin/customers` | Danh sách tài khoản User; cần Admin |
| GET    | `/api/admin/orders`  | Danh sách đơn hàng; cần Admin            |
| GET    | `/api/admin/orders/:orderId` | Chi tiết đơn hàng; cần Admin      |
| PATCH  | `/api/admin/orders/:orderId/status` | Chuyển trạng thái hợp lệ; cần Admin |
| GET    | `/api/admin/check`   | Kiểm tra quyền Admin                     |
| GET    | `/api/health`        | Kiểm tra API và kết nối MySQL            |

Đăng ký nhận `name`, `email`, `phone`, `password`. Backend kiểm tra dữ liệu,
chuẩn hóa email, băm mật khẩu bằng bcryptjs và luôn gán role `user`; trường
`role` gửi từ trình duyệt không được sử dụng. Đăng nhập nhận `email` và
`password`. API sản phẩm và danh mục công khai; giỏ hàng, yêu thích và đơn hàng
gắn với người dùng trong JWT. Backend tính lại tiền đơn hàng và kiểm tra tồn kho
trước khi ghi nhận đặt hàng. Thanh toán hỗ trợ `cod`, `bank_transfer` và `momo`.
Trạng thái đơn gồm `pending`, `confirmed`,
`shipping`, `completed` và `cancelled`.

### Checkout và đơn hàng

1. `GET /api/auth/me` lấy thông tin tài khoản từ JWT; `GET /api/cart` trả về
   giỏ hàng, đơn giá, số lượng, thành tiền từng dòng và tạm tính.
2. `POST /api/orders` cần Bearer token và header `Idempotency-Key` (8-100 ký
   tự). Backend xác minh các sản phẩm/số lượng khớp giỏ hàng, kiểm tra tồn kho,
   tự tính giá/giảm giá/phí giao hàng/tổng tiền, tạo đơn và chi tiết trong một
   transaction, trừ kho và xóa các món đã đặt khỏi giỏ.

Request mẫu:

```http
POST /api/orders
Authorization: Bearer <JWT>
Idempotency-Key: 78106be2-0957-41e9-9ab1-54c901d97483
Content-Type: application/json
```

```json
{
  "customer": {
    "name": "Nguyen Van A",
    "phone": "0912345678",
    "address": "123 Duong ABC, Quan 1"
  },
  "note": "Gọi trước khi giao",
  "items": [
    { "productId": "but-bi-muc-xanh", "quantity": 2, "variant": "" }
  ],
  "couponCode": "",
  "paymentMethod": "cod"
}
```

API trả `201` khi tạo đơn mới và `200` khi phát lại kết quả của khóa idempotency
đã xử lý; gửi lại cùng khóa sẽ không trừ kho hoặc tạo đơn thêm lần nữa. Khóa
được lưu theo từng người dùng. Không gửi giá sản phẩm hoặc tổng tiền từ client.

`GET /api/orders` liệt kê đơn của tài khoản; `GET /api/orders/:orderId` xem chi
tiết và chỉ cho chủ đơn truy cập. `POST /api/orders/:orderId/cancel` chỉ hủy
đơn chưa được thanh toán, hoàn kho trong transaction. Admin chỉ được chuyển
trạng thái theo luồng `pending -> confirmed -> shipping -> completed`; đơn
`pending` hoặc `confirmed` có thể được Admin hủy nếu chưa thanh toán. Đơn đã
hủy/hoàn thành không thể mở lại.

Checkout hiện giữ giao diện có sẵn, bổ sung ghi chú tùy chọn và gửi khóa
idempotency ổn định trong suốt một lần checkout. Chuyển khoản chỉ là lựa chọn
phương thức; nhân viên xác nhận và cung cấp thông tin chuyển khoản. Với MoMo,
`POST /api/orders` nhận `paymentMethod: "momo"` và trả `order.paymentUrl`.
Frontend chuyển khách đến URL đó. IPN công khai tại
`POST /api/payments/momo/ipn` xác thực chữ ký HMAC-SHA256 và đối chiếu mã đơn,
mã yêu cầu, số tiền trước khi cập nhật trạng thái thanh toán. Trang quay về chỉ
hiển thị đã thanh toán khi `GET /api/orders/:orderId` trả `paymentStatus: "paid"`;
tham số trên URL chuyển hướng không được dùng để xác nhận thanh toán.

### Cấu hình MoMo Sandbox

1. Tạo ứng dụng Sandbox trong cổng dành cho nhà phát triển MoMo và lấy Partner
   Code, Access Key, Secret Key.
2. Điền các giá trị vào `.env` (không đưa file này lên Git). Giữ
   `MOMO_CREATE_URL` trỏ đến Sandbox. `MOMO_REDIRECT_URL` là trang checkout
   đang chạy trên Live Server.
3. Cấu hình `MOMO_IPN_URL` thành địa chỉ HTTPS công khai có thể truy cập được
   từ MoMo, ví dụ URL API đã triển khai cùng `/api/payments/momo/ipn`. Không
   dùng `localhost` cho IPN; Sandbox không thể gọi địa chỉ trên máy cá nhân.
4. Khởi động lại API, chọn **Ví MoMo** ngay dưới **Chuyển khoản ngân hàng**.
   Khi chưa có cấu hình, API từ chối tạo đơn MoMo và không trừ hàng trong kho.

Tài liệu và mẫu tích hợp chính thức: [MoMo Payment API](https://developers.momo.vn/)
và [repository mẫu của MoMo](https://github.com/momo-wallet/payment). Không
thể xác nhận một giao dịch Sandbox thực tế nếu chưa cấu hình thông tin Sandbox
và IPN HTTPS công khai.

Sau khi đăng ký/đăng nhập, frontend lưu JWT trong `sessionStorage` dưới khóa
`stationery-auth-token`. Gửi token qua header
`Authorization: Bearer <token>` khi gọi API cần đăng nhập. Nút `Đăng xuất` trên
header xóa phiên đăng nhập hiện tại; đóng tab sẽ kết thúc phiên theo cơ chế
`sessionStorage` của trình duyệt.

Tài khoản Admin phải được cấp thủ công bởi người quản lý database sau khi tài
khoản đã đăng ký:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

Đăng nhập lại để nhận JWT có role mới. Middleware kiểm tra role nằm ở Backend;
không dùng thông tin role trong giao diện để bảo vệ API.

Sau khi đăng nhập, tài khoản có role `admin` được chuyển tới
`pages/admin/index.html`; trang này gọi `/api/admin/check` trước khi hiển thị.
Trang Admin có Dashboard, quản lý sản phẩm/danh mục/đơn hàng và danh sách khách
hàng. Doanh thu trên Dashboard chỉ cộng các đơn có trạng thái `completed`.
Nút **Quay về trang chủ** và mục **Quản lý Admin** giữ nguyên phiên đăng nhập;
API quản trị vẫn được bảo vệ riêng bằng middleware `requireAdmin`.

## Phát triển và kiểm thử

```powershell
npm run dev
npm test
```

`npm test` chạy các kiểm thử xác thực với database giả lập. Để kiểm tra đầy đủ
luồng thương mại, cần chạy MySQL và API thật; các kiểm thử tích hợp cũng bao gồm
sản phẩm/danh mục, giỏ hàng, yêu thích, đặt hàng, tồn kho và quyền Admin.
