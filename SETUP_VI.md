# Hướng dẫn kết nối GitHub + Supabase + Vercel + Render

## A. Supabase (làm trước)

1. Tạo một project mới trong Supabase và chờ database khởi tạo xong.
2. Mở **SQL Editor → New query**.
3. Mở file `database/schema.sql` trong source code, copy toàn bộ nội dung, dán vào SQL Editor và bấm **Run**.
4. Mở **Authentication → Providers → Email**, bật Email. Để thử nghiệm nhanh có thể tắt Confirm email; khi vận hành thật, nên cấu hình SMTP và bật xác nhận email.
5. Mở **Project Settings → API** (hoặc API Keys), lấy:
   - Project URL
   - Publishable key hoặc anon/public key
6. Chỉ dùng publishable/anon key ở frontend. **Không đưa service_role key vào GitHub, Vercel frontend hoặc file `.env.local`.**

## B. GitHub

1. Tạo repository mới, nên để **Private**.
2. Upload toàn bộ nội dung bên trong thư mục `maintenance-report-generator` lên thư mục gốc của repository.
3. Sau khi upload, ở cấp gốc phải nhìn thấy `frontend`, `backend`, `database`, `docs`, `README.md`, `render.yaml` và `SETUP_VI.md`.
4. Không upload file `.env.local`, mật khẩu, hoặc service_role key.

## C. Deploy backend lên Render

Tạo Web Service từ GitHub repository:

- Root Directory: `backend`
- Runtime: Python
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment Variable: `ALLOWED_ORIGINS` tạm thời đặt `http://localhost:3000`; sau khi có URL Vercel, đổi thành URL Vercel chính xác.

Sau khi deploy, mở `https://URL-BACKEND/health`. Kết quả cần có `ok: true` và `template_exists: true`.

## D. Deploy frontend lên Vercel

1. Import repository GitHub vào Vercel.
2. Chọn **Root Directory = `frontend`**.
3. Thêm các Environment Variables cho Production (và Preview nếu bạn dùng Preview):

```env
NEXT_PUBLIC_API_URL=https://URL-BACKEND.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

4. Deploy frontend.
5. Quay lại Render, đổi `ALLOWED_ORIGINS` thành URL Vercel thực tế, ví dụ `https://maintenance-report-generator.vercel.app`, rồi redeploy backend.
6. Quay lại Supabase → **Authentication → URL Configuration**:
   - Site URL: URL Vercel thực tế.
   - Redirect URLs: thêm URL Vercel thực tế và `http://localhost:3000` nếu chạy local.

## E. Kiểm tra lần đầu

1. Mở URL Vercel, tạo account bằng email/password rồi đăng nhập.
2. Nhập Contract No., Customer, ngày bảo trì và thông tin thiết bị.
3. Bấm **Save draft**. Kiểm tra bảng `maintenance_reports` trong Supabase có bản ghi mới.
4. Upload một ảnh, bấm Save draft; kiểm tra bucket `report-photos` có file nằm trong thư mục user ID.
5. Bấm **Load latest** để kiểm tra khôi phục dữ liệu.
6. Bấm **Generate Word report**, mở file `.docx` bằng Microsoft Word và đối chiếu từng trang với mẫu gốc.

Nếu `health` không trả `template_exists: true`, kiểm tra `backend/master_template.docx` có trong GitHub và Render đã deploy đúng thư mục `backend`.

## F. Chưa bật dùng chính thức

Bản hiện tại đã có đăng nhập Supabase và RLS cho dữ liệu bản nháp, nhưng API xuất Word chưa xác minh Supabase JWT ở phía server, chưa có giới hạn tốc độ ở hosting, chưa có phân quyền nhóm/duyệt báo cáo. Chỉ dùng thử nội bộ cho đến khi bổ sung các lớp bảo vệ và được bộ phận kỹ thuật duyệt mẫu Word đầu ra.
