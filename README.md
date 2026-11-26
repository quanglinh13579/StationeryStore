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
| POST/PUT/DELETE | `/api/admin/products[/:slug]` | Quản lý sản phẩm; cần Admin |
| POST/PUT/DELETE | `/api/admin/categories[/:slug]` | Quản lý danh mục; cần Admin |
| GET    | `/api/admin/orders`  | Danh sách đơn hàng; cần Admin            |
| GET    | `/api/admin/orders/:orderId` | Chi tiết đơn hàng; cần Admin      |
| PATCH  | `/api/admin/orders/:orderId/status` | Cập nhật trạng thái; cần Admin |
| GET    | `/api/admin/check`   | Kiểm tra quyền Admin                     |
| GET    | `/api/health`        | Kiểm tra API và kết nối MySQL            |

Đăng ký nhận `name`, `email`, `phone`, `password`. Backend kiểm tra dữ liệu,
chuẩn hóa email, băm mật khẩu bằng bcryptjs và luôn gán role `user`; trường
`role` gửi từ trình duyệt không được sử dụng. Đăng nhập nhận `email` và
`password`. API sản phẩm và danh mục công khai; giỏ hàng, yêu thích và đơn hàng
gắn với người dùng trong JWT. Backend tính lại tiền đơn hàng và kiểm tra tồn kho
trước khi ghi nhận đặt hàng.

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

## Phát triển và kiểm thử

```powershell
npm run dev
npm test
```

`npm test` chạy các kiểm thử xác thực với database giả lập. Để kiểm tra đầy đủ
luồng thương mại, cần chạy MySQL và API thật; các kiểm thử tích hợp cũng bao gồm
sản phẩm/danh mục, giỏ hàng, yêu thích, đặt hàng, tồn kho và quyền Admin.
