# StationeryStore

Website bán đồ dùng học tập. Frontend dùng HTML, CSS và JavaScript thuần; Backend
hiện triển khai đăng ký, đăng nhập và xác thực bằng Express, MySQL và JWT.

## Yêu cầu

- Node.js 18 trở lên.
- MySQL 8 trở lên đang chạy.
- VS Code Live Server để mở frontend (mặc định `http://127.0.0.1:5500`).

## Cài đặt Backend

1. Mở `database/schema.sql` trong MySQL Workbench, chọn kết nối MySQL và chạy
   script để tạo database cùng bảng `users`.

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

2. Tạo file cấu hình cục bộ:

   ```powershell
   Copy-Item .env.example .env
   ```

   Sửa thông tin MySQL trong `.env`. Tạo JWT secret riêng bằng lệnh:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Chép chuỗi được in ra vào `JWT_SECRET`. Không đưa `.env` lên Git.

3. Cài package và chạy API:

   ```powershell
   npm install
   npm start
   ```

   Mở `http://localhost:3000/api/health`; kết quả cần có
   `"database": "connected"`.

4. Mở `index.html` bằng Live Server. Màn hình đăng nhập/đăng ký nằm chung tại
   `pages/auth/login.html` và gửi yêu cầu đến API ở `http://localhost:3000`.

## API xác thực

| Method | Endpoint             | Mô tả                                    |
| ------ | -------------------- | ---------------------------------------- |
| POST   | `/api/auth/register` | Tạo tài khoản User                       |
| POST   | `/api/auth/login`    | Đăng nhập và nhận JWT                    |
| GET    | `/api/auth/me`       | Lấy tài khoản hiện tại; cần Bearer token |
| GET    | `/api/admin/check`   | Kiểm tra quyền Admin; cần Bearer token   |
| GET    | `/api/health`        | Kiểm tra API và kết nối MySQL            |

Đăng ký nhận `name`, `email`, `phone`, `password`. Backend kiểm tra dữ liệu,
chuẩn hóa email, băm mật khẩu bằng bcryptjs và luôn gán role `user`; trường
`role` gửi từ trình duyệt không được sử dụng. Đăng nhập nhận `email` và
`password`.

Sau khi đăng ký/đăng nhập, frontend lưu JWT trong `localStorage` dưới khóa
`stationery-auth-token`. Gửi token qua header
`Authorization: Bearer <token>` khi gọi API cần đăng nhập.

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

`npm test` kiểm tra luồng xác thực bằng database giả lập trong test, không thay
thế việc chạy MySQL thật. Các chức năng sản phẩm, giỏ hàng, yêu thích và đơn
hàng chưa được chuyển sang Backend trong phạm vi hiện tại.
