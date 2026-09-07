# Tài liệu nâng cấp hệ thống thu bài

## 1. Mục tiêu

Tài liệu này xác định lộ trình nâng cấp hệ thống thu bài từ trạng thái hiện tại (MVP / demo / nội bộ) lên mức production-ready, đảm bảo tính bảo mật, độ tin cậy, khả năng mở rộng và dễ vận hành.

## 2. Tình trạng hiện tại

Hệ thống hiện đã có các chức năng cốt lõi:
- đăng nhập vào hệ thống Judge
- lưu session người dùng
- nộp file theo tổ chức và người dùng
- lưu lịch sử nộp bài trong SQLite
- xem lịch sử cá nhân / quản trị
- quản lý thời gian mở/đóng hệ thống
- quản trị cài đặt và xóa dữ liệu

Về mặt kỹ thuật, hệ thống đang ở trạng thái “sử dụng được”, nhưng chưa hoàn toàn phù hợp cho môi trường production do các hạn chế sau:
- auth đang phụ thuộc vào secret mặc định nếu không cấu hình env
- file storage và database đang nằm trong thư mục local / project root
- thiếu kiểm thử tự động
- thiếu retry / timeout / observability cho các API bên ngoài
- chưa chuẩn hóa cấu hình môi trường

## 3. Những điểm cần cải thiện ưu tiên

### 3.1 Bảo mật

- Bắt buộc thiết lập `SESSION_SECRET` trong môi trường.
- Không để giá trị mặc định `thubai-local-secret` trong production.
- Kiểm tra lại `cookies` và `secure`/`sameSite` theo môi trường deployment.
- Kiểm tra quyền truy cập admin và route bảo vệ đúng nhất.
- Tách riêng data storage và log storage khỏi workspace của ứng dụng.

### 3.2 Cấu hình và môi trường

- Tạo file `.env.example` và mô tả rõ từng biến:
  - `JUDGE_API_BASE_URL`
  - `SESSION_SECRET`
  - `DATA_DIR`
  - `DB_PATH`
  - `NODE_ENV`
- Chuyển hard-coded path `/tmp`, `process.cwd()`, `thubai-settings.json` và `thubai-history.sqlite` sang biến môi trường hoặc config tập trung.
- Tách cấu hình dev/staging/prod rõ ràng.

### 3.3 Độ tin cậy và vận hành

- Thêm timeout cho mọi request tới Judge API.
- Bổ sung retry/backoff khi gặp lỗi mạng hoặc 5xx.
- Dùng logger có cấu trúc (structured logging) thay vì `console.log` rải rác.
- Thu thập metric cơ bản: số lượt login, lỗi API, số bài nộp, dung lượng lưu trữ, thời gian xử lý.
- Thêm cảnh báo khi dung lượng lưu trữ gần giới hạn hoặc storage không khả dụng.

### 3.4 Quản lý dữ liệu

- Chuyển dữ liệu lịch sử từ SQLite local sang hệ thống quản trị dữ liệu ổn định hơn nếu số lượng lớn.
- Tạo cấu trúc lưu trữ theo tổ chức / năm / tháng để dễ backup và quản lý.
- Thêm cleanup policy cho file cũ và dữ liệu hết hạn.
- Bảo vệ khỏi việc file upload bị ghi đè / ghi sai cấu trúc thư mục.

### 3.5 Kiểm thử

- Thêm unit test cho:
  - `validateSubmissionFiles`
  - `validateLoginInput`
  - `getWindowStatus`
  - `extractOrganizations`
- Thêm integration test cho:
  - login
  - logout
  - upload file
  - xem lịch sử
  - admin settings
- Thiết lập CI để chạy lint + build + test mỗi khi push.

### 3.6 Trải nghiệm người dùng

- Cải thiện thông điệp lỗi rõ hơn, có thể hiểu và thao tác được.
- Tối ưu khả năng tải / preview file ở lịch sử.
- Thêm phân trang / lọc / tìm kiếm cho lịch sử nộp bài.
- Cập nhật UX cho admin dashboard rõ hơn và dễ theo dõi hơn.

## 4. Lộ trình nâng cấp đề xuất

### Giai đoạn 1: Cơ bản hóa bảo mật và cấu hình (1–2 tuần)

Mục tiêu: giảm rủi ro ngay lập tức.

Checklist:
- [ ] Cấu hình `SESSION_SECRET` bắt buộc
- [ ] Tạo `.env.example`
- [ ] Đưa các folder storage vào biến môi trường
- [ ] Kiểm tra cookie security settings
- [ ] Xóa hoặc giảm `console.log` nhạy cảm trong production
- [ ] Viết tài liệu vận hành cơ bản cho dev và prod

### Giai đoạn 2: Tăng độ tin cậy và vận hành (2–4 tuần)

Mục tiêu: hệ thống chạy ổn định hơn với lỗi nhỏ và có khả năng quan sát.

Checklist:
- [ ] Thêm timeout cho Judge API calls
- [ ] Implement retry/backoff
- [ ] Tạo middleware/utility xử lý lỗi tập trung
- [ ] Infrastructure logging và alerting cơ bản
- [ ] Thêm dashboard trạng thái hệ thống / storage
- [ ] Bảo vệ endpoint admin bằng kiểm tra session + permission rõ ràng hơn

### Giai đoạn 3: Kiểm thử và chất lượng code (2–4 tuần)

Mục tiêu: giảm regressions và tăng niềm tin khi phát triển.

Checklist:
- [ ] Viết unit test cho validation và helper logic
- [ ] Viết integration test cho flow chính
- [ ] Tạo CI pipeline chạy test + build + lint
- [ ] Setup coverage report
- [ ] Kiểm tra performance cơ bản ở các endpoint quan trọng

### Giai đoạn 4: Tối ưu scalability và quản lý dữ liệu (1–2 tháng)

Mục tiêu: chuẩn bị hệ thống cho quy mô lớn hơn.

Checklist:
- [ ] Chuyển storage sang cấu trúc theo tổ chức / tháng / năm
- [ ] Tối ưu schema SQLite hoặc migrate sang Postgres nếu cần
- [ ] Thêm backup và restore policy
- [ ] Tối ưu việc đọc/thêm lịch sử bài nộp
- [ ] Thêm indexing và query tối ưu phù hợp

### Giai đoạn 5: Nâng cấp trải nghiệm và tính năng mở rộng (theo tiến độ)

Mục tiêu: nâng tầm hệ thống từ tool nội bộ thành nền tảng ổn định.

Checklist:
- [ ] Phân trang lịch sử nộp bài
- [ ] Tìm kiếm theo tên người dùng / tổ chức / mã nộp
- [ ] Export dữ liệu rõ ràng hơn
- [ ] Dashboard phân tích số lượng bài nộp theo thời gian
- [ ] Quản lý cấu hình linh hoạt hơn theo tổ chức

## 5. Đề xuất ưu tiên triển khai

Nếu cần triển khai theo thứ tự tối ưu, nên thực hiện theo nhịp sau:
1. Bảo mật + cấu hình môi trường
2. Timeout/retry/logging
3. Kiểm thử tự động
4. Tối ưu lưu trữ và database
5. Nâng cấp UX và scale-out

Đây là thứ tự mang lại hiệu quả cao nhất vì nó giảm rủi ro ngay trong giai đoạn đầu mà không cần phá vỡ cấu trúc hệ thống hiện tại.

## 6. Kết luận

Dự án hiện đang ở mức “MVP có chức năng” và hoàn toàn có thể sử dụng trong môi trường nội bộ. Tuy nhiên, để tiến xa hơn về độ ổn định, bảo mật và khả năng mở rộng, cần ưu tiên các cải tiến về cấu hình môi trường, session security, độ tin cậy của API và kiểm thử tự động trước khi mở rộng thêm tính năng.

## 7. Theo dõi tiến độ

Các hạng mục nên được quản lý trong backlog theo từng giai đoạn:
- Security hardening
- Config management
- Reliability and observability
- Testing and CI
- Data management and storage
- UX and scale optimization

Mỗi hạng mục nên có owner, deadline và definition of done rõ ràng trước khi triển khai.
