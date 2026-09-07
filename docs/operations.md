# Runbook vận hành cơ bản

## 1. Môi trường phát triển (dev)

1. Cài dependencies:
   ```bash
   pnpm install
   ```
2. Tạo `.env.local` từ `.env.example`.
3. Chạy ứng dụng:
   ```bash
   pnpm dev
   ```

Gợi ý cho dev:
- Có thể dùng `SESSION_SECRET` tạm thời, nhưng vẫn nên đặt giá trị riêng.
- `DATA_DIR` mặc định là `var/thubai` trong repo worktree hiện tại.

## 2. Môi trường production (prod)

Biến bắt buộc:
- `SESSION_SECRET` phải được cấu hình. Ứng dụng sẽ báo lỗi khi `NODE_ENV=production` mà thiếu biến này.

Biến khuyến nghị:
- `JUDGE_API_BASE_URL`
- `JUDGE_API_TIMEOUT_MS`
- `JUDGE_API_RETRY_COUNT`
- `JUDGE_API_RETRY_DELAY_MS`
- `DATA_DIR` hoặc các biến override (`DB_PATH`, `SETTINGS_FILE`, `SUBMISSION_STORAGE_DIR`)

Khuyến nghị vận hành:
- Trỏ `DATA_DIR` ra volume/persistent disk riêng.
- Không lưu dữ liệu vận hành trong thư mục source code.
- Dùng HTTPS để cookie `secure` hoạt động đúng.

## 3. Dữ liệu và đường dẫn

Mặc định theo `DATA_DIR`:
- SQLite history: `thubai-history.sqlite`
- App settings: `thubai-settings.json`
- Bài nộp: thư mục `submissions/`

Mẫu cấu trúc lưu bài mới:
- `DATA_DIR/<org>/<YYYY>/<MM>/<user>/<submissionId>/`

Fallback tương thích:
- Nếu chưa có file settings/DB mới, hệ thống vẫn đọc từ vị trí cũ ở project root (`thubai-settings.json`, `thubai-history.sqlite`).

## 4. Backup và khôi phục

Khuyến nghị chụp snapshot toàn bộ `DATA_DIR` theo lịch định kỳ.

Ví dụ backup:
```bash
tar -czf thubai-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /srv thubai-data
```

Ví dụ restore:
```bash
systemctl stop thubai
rm -rf /srv/thubai-data
tar -xzf thubai-backup.tar.gz -C /srv
systemctl start thubai
```

Luôn dừng service trước khi restore để tránh ghi chồng dữ liệu.

## 5. Build và khởi động

```bash
pnpm build
pnpm start
```

## 6. Kiểm tra nhanh sau deploy

1. Truy cập `/login` và đăng nhập.
2. Nộp một bài thử nghiệm.
3. Kiểm tra `/history` có bản ghi mới.
4. Vào `/admin` xác nhận đọc/ghi cấu hình được.
5. Ở tab **Thống kê**, kiểm tra trạng thái:
   - Judge API đang hoạt động
   - Storage có thể đọc/ghi
   - File settings và history DB hiển thị đúng đường dẫn

## 7. Xuất dữ liệu và theo dõi lịch sử

- Trang `/history` và `/admin/history` đều hỗ trợ phân trang, tìm kiếm và export CSV.
- Nếu cần tra cứu nhanh, ưu tiên lọc theo tên người dùng, tổ chức hoặc mã nộp thay vì tải toàn bộ dữ liệu.

## 8. Cấu hình theo tổ chức

- Trong `/admin`, phần cấu hình theo tổ chức cho phép đặt:
  - `submissionStart`
  - `submissionEnd`
  - `storagePrefix`
- Nếu một tổ chức chưa có cấu hình riêng, hệ thống sẽ dùng cấu hình chung.
