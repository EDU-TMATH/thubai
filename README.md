# Thubai

Hệ thống thu bài thi trực tuyến xây dựng bằng Next.js (App Router), hỗ trợ đăng nhập Judge API, nộp file bài làm theo tổ chức, lịch sử nộp bài và trang quản trị.

## Yêu cầu môi trường

- Node.js 20+
- pnpm 11+

## Cấu hình

1. Tạo file `.env.local` từ `.env.example`.
2. Thiết lập tối thiểu:
   - `SESSION_SECRET` (bắt buộc khi chạy production)
   - `JUDGE_API_BASE_URL` (khuyến nghị)
   - `DATA_DIR` hoặc các biến đường dẫn riêng cho DB / settings / submissions

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

## Tài liệu vận hành

- Lộ trình nâng cấp: `docs/upgrade-roadmap.md`
- Runbook dev/prod cơ bản: `docs/operations.md`
