# Thubai

Hệ thống thu bài thi trực tuyến xây dựng bằng Next.js (App Router), hỗ trợ đăng nhập Judge API, nộp file bài làm theo tổ chức, lịch sử nộp bài và trang quản trị.
Trang lịch sử và trang quản trị hiện có phân trang, tìm kiếm và export CSV; dashboard quản trị cũng hiển thị phân tích theo thời gian.

## Yêu cầu môi trường

- Node.js 20+
- pnpm 11+

## Cấu hình

1. Tạo file `.env.local` từ `.env.example`.
2. Thiết lập tối thiểu:
   - `SESSION_SECRET` (bắt buộc khi chạy production)
   - `JUDGE_API_BASE_URL` (khuyến nghị)
   - `JUDGE_API_TIMEOUT_MS`, `JUDGE_API_RETRY_COUNT`, `JUDGE_API_RETRY_DELAY_MS`
   - `DATA_DIR` hoặc các biến đường dẫn riêng cho DB / settings / submissions
   - Cấu hình theo tổ chức có thể chỉnh trong `/admin` để đặt khung thời gian nộp và tiền tố lưu trữ riêng

Xem chi tiết biến môi trường trong `.env.example`.

## Chạy local

```bash
pnpm install
pnpm dev
```

Mở `http://localhost:3000`.

## Build production

```bash
pnpm build
pnpm start
```

## Kiểm thử

```bash
pnpm lint
pnpm test
pnpm test:coverage
```

CI chạy cùng bộ lệnh trên trước khi build, nên nếu một trong các bước này fail thì branch chưa sẵn sàng để merge.

## Tài liệu vận hành

- Lộ trình nâng cấp: `docs/upgrade-roadmap.md`
- Runbook dev/prod cơ bản: `docs/operations.md`
