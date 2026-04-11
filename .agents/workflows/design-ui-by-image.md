---
description: Tự động chuyển đổi thiết kế Figma thành code React (Pixel-perfect). Quy trình: viết code, render, chụp ảnh, đánh giá thị giác (Visual QA) so với bản gốc, và tự động sửa lỗi lặp lại (Feedback Loop - Max 5 lần) cho đến khi giao diện hoàn hảo.
---

### Mục tiêu (Objective)

Chuyển đổi hình ảnh thiết kế (Figma) thành mã nguồn React đảm bảo độ chính xác "pixel-perfect" thông qua vòng lặp phản hồi hình ảnh (Visual Feedback Loop).

### Các bước thực thi (Execution Steps)

**Bước 1: Khởi tạo mã nguồn (Initial Code Generation)**

- Phân tích hình ảnh thiết kế gốc (Target Image).
- **Đọc và áp dụng nghiêm ngặt** các tiêu chuẩn công nghệ từ file `ui-generator-rules.md` (React 18, TypeScript, Tailwind CSS).
- Khởi tạo mã nguồn. Đảm bảo mã nguồn gọn gàng, chia component hợp lý và sử dụng Mock Data nếu cần thiết.

**Bước 2: Kết xuất và Chụp ảnh (Render & Snapshot)**

- Biên dịch và hiển thị đoạn code vừa tạo trong môi trường render. Kích thước viewport phải trùng khớp 100% với kích thước của Target Image.
- Chụp ảnh màn hình kết quả thực tế (Generated Image).

**Bước 3: Đánh giá trực quan (Visual QA & Comparison)**

- Đối chiếu nghiêm ngặt `Generated Image` với `Target Image` gốc.
- Kiểm tra chi tiết 5 yếu tố cốt lõi: (1) Layout & Bố cục, (2) Typography (Kích thước, màu sắc, font-weight), (3) Spacing (Margin/Padding), (4) Colors (Màu nền, màu viền), và (5) Tỷ lệ các khối.
- Đánh giá lại tổng qua code đã code xem đã tối ưu, clean, chuẩn production chưa.

**Bước 4: Xử lý Vòng lặp (Feedback Loop)**

- **Nếu PASS (Không có sai lệch đáng kể):** Trả về toàn bộ mã nguồn React cuối cùng và Kết thúc quy trình.
- **Nếu FAIL (Có sai lệch):** Liệt kê một danh sách lỗi cụ thể và rõ ràng (Ví dụ: "Padding nút Login đang là 8px, cần tăng lên 16px").
- Gửi danh sách lỗi này trở lại Bước 1 để AI tiếp tục sửa code.
- **Giới hạn (Max Iterations):** Vòng lặp tối đa 5 lần. Nếu đạt đến lần thứ 5 mà vẫn FAIL, trả về phiên bản code tốt nhất kèm theo danh sách các lỗi còn tồn đọng.

### Quy tắc bắt buộc (Strict Rules)

1. **Tech Stack & Code Rules:** BẮT BUỘC tuân thủ 100% các quy định về công nghệ và cách viết code được định nghĩa trong file `ui-generator-rules.md`.
2. **Sửa đổi có mục tiêu:** Trong các vòng lặp sửa lỗi, CHỈ tập trung sửa những điểm được báo cáo trong Visual QA. Tuyệt đối không thay đổi những phần đã hiển thị chính xác.
3. **Assets:** Dùng SVG placeholders cho hình ảnh phức tạp; dùng icon thư viện (Lucide/Heroicons) tương đồng nhất cho các biểu tượng nếu không có sẵn asset.
