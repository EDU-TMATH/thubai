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

Fallback tương thích:
- Nếu chưa có file settings/DB mới, hệ thống vẫn đọc từ vị trí cũ ở project root (`thubai-settings.json`, `thubai-history.sqlite`).

## 4. Build và khởi động

```bash
pnpm build
pnpm start
```

## 5. Kiểm tra nhanh sau deploy

1. Truy cập `/login` và đăng nhập.
2. Nộp một bài thử nghiệm.
3. Kiểm tra `/history` có bản ghi mới.
4. Vào `/admin` xác nhận đọc/ghi cấu hình được.
5. Ở tab **Thống kê**, kiểm tra trạng thái:
   - Judge API đang hoạt động
   - Storage có thể đọc/ghi
   - File settings và history DB hiển thị đúng đường dẫn
