# ✅ Travel Planner Pro — Checklist Toàn Bộ Chức Năng & Dữ Liệu Test

> Cập nhật: 14/03/2026 | Phiên bản đầy đủ tất cả module

---

## 📋 Mục lục

1. [Đăng ký & Đăng nhập](#1-đăng-ký--đăng-nhập)
2. [Trang chủ — Khám phá điểm đến](#2-trang-chủ--khám-phá-điểm-đến)
3. [Chi tiết điểm đến](#3-chi-tiết-điểm-đến)
4. [Tạo chuyến đi](#4-tạo-chuyến-đi)
5. [Lịch trình chi tiết](#5-lịch-trình-chi-tiết)
6. [Quản lý hoạt động trong lịch trình](#6-quản-lý-hoạt-động-trong-lịch-trình)
7. [Chi phí & Ngân sách](#7-chi-phí--ngân-sách)
8. [Chia tiền nhóm](#8-chia-tiền-nhóm)
9. [Đánh giá địa điểm](#9-đánh-giá-địa-điểm)
10. [Trạng thái chuyến đi](#10-trạng-thái-chuyến-đi)
11. [Chia sẻ & Quản lý thành viên](#11-chia-sẻ--quản-lý-thành-viên)
12. [Bản đồ](#12-bản-đồ)
13. [Danh sách chuyến đi](#13-danh-sách-chuyến-đi)
14. [Hồ sơ cá nhân & Cài đặt](#14-hồ-sơ-cá-nhân--cài-đặt)
15. [Thông báo](#15-thông-báo)
16. [Admin Dashboard](#16-admin-dashboard)
17. [Admin — Quản lý người dùng](#17-admin--quản-lý-người-dùng)
18. [Admin — Quản lý điểm đến](#18-admin--quản-lý-điểm-đến)
19. [Admin — Quản lý đánh giá](#19-admin--quản-lý-đánh-giá)
20. [Admin — Quản lý POI](#20-admin--quản-lý-poi)
21. [Dữ liệu & API](#21-dữ-liệu--api)

---

## 1. Đăng ký & Đăng nhập

### Đăng ký tài khoản

- [ ] Nhập username, email, họ tên, số điện thoại, mật khẩu
- [ ] Validate: username/email trùng → báo lỗi
- [ ] Validate: mật khẩu tối thiểu 6 ký tự
- [ ] Đăng ký thành công → chuyển sang trang đăng nhập

### Đăng nhập

- [ ] Đăng nhập bằng username + password
- [ ] Sai thông tin → hiển thị thông báo lỗi
- [ ] Tài khoản bị khóa → không cho đăng nhập
- [ ] Đăng nhập thành công → chuyển đến trang chủ
- [ ] Lưu phiên đăng nhập (AsyncStorage)

### 🧪 Dữ liệu test

| Vai trò | Username     | Password   | Email            | Họ tên       |
| ------- | ------------ | ---------- | ---------------- | ------------ |
| Admin   | `admin`      | `admin123` | admin@plango.vn  | PlanGo Admin |
| User 1  | `nguyenvana` | `123456`   | vana@gmail.com   | Nguyễn Văn A |
| User 2  | `tranthib`   | `123456`   | thib@gmail.com   | Trần Thị B   |
| User 3  | `levanc`     | `123456`   | levanc@gmail.com | Lê Văn C     |

---

## 2. Trang chủ — Khám phá điểm đến

- [ ] Hiển thị lời chào: "Xin chào, [Tên]"
- [ ] Nút thông báo với badge số chưa đọc
- [ ] Nút tạo chuyến đi mới (+)
- [ ] Thanh tìm kiếm: tìm theo tên, địa chỉ, tag
- [ ] Bộ lọc danh mục: Tất cả, Biển, Núi, Thành phố, Văn hóa, Thiên nhiên, Phiêu lưu, Lịch sử
- [ ] Danh sách điểm đến dạng card: ảnh, tên, rating, địa chỉ, tags, giá
- [ ] Kéo xuống refresh dữ liệu
- [ ] Bấm card → mở chi tiết điểm đến
- [ ] Không có kết quả → hiển thị trạng thái rỗng

### 🧪 Test

| Hành động     | Kết quả mong đợi                    |
| ------------- | ----------------------------------- |
| Tìm "Hạ Long" | Hiện card Vịnh Hạ Long              |
| Lọc "Biển"    | Hiện Phú Quốc, Nha Trang            |
| Lọc "Núi"     | Hiện Sa Pa, Đà Lạt                  |
| Tìm "bún bò"  | Không kết quả (chỉ search địa điểm) |
| Lọc "Lịch sử" | Hiện Kinh thành Huế                 |

---

## 3. Chi tiết điểm đến

- [ ] Hiển thị ảnh (carousel nếu nhiều ảnh)
- [ ] Tên, địa chỉ, rating, số review, danh mục
- [ ] Mô tả chi tiết
- [ ] Tags (UNESCO, Du thuyền, Chèo kayak...)
- [ ] Điểm nổi bật (highlights)
- [ ] Mẹo du lịch (tips)
- [ ] Thời điểm lý tưởng, chi phí ước tính
- [ ] Giờ mở cửa
- [ ] Quán ăn gần đó: tên, địa chỉ, giá, loại món
- [ ] Đánh giá mẫu (sampleReviews): tên, số sao, nội dung, nguồn
- [ ] Nút Review: rating + bình luận
- [ ] Nút lên kế hoạch (chuyển create-trip)

### 🧪 Test — Vịnh Hạ Long

| Trường             | Giá trị                                                      |
| ------------------ | ------------------------------------------------------------ |
| Rating             | ⭐ 4.8                                                       |
| Số review          | 2.456                                                        |
| Danh mục           | Thiên nhiên                                                  |
| Tags               | UNESCO, Du thuyền, Chèo kayak, Hang động                     |
| Chi phí            | 2.500.000 VNĐ / người                                        |
| Thời gian lý tưởng | Tháng 10 - Tháng 4                                           |
| Quán ăn            | Nhà hàng Hải sản Hạ Long (300.000đ), Quán Chả mực (150.000đ) |

---

## 4. Tạo chuyến đi

- [ ] Tên chuyến đi (auto-fill hoặc nhập)
- [ ] Điểm đến: search có gợi ý (Nominatim)
- [ ] Điểm xuất phát: nhập + tự tra tọa độ
- [ ] Ngày bắt đầu — Ngày kết thúc: chọn bằng calendar range
- [ ] Số người
- [ ] Ngân sách cụ thể (VNĐ)
- [ ] Chọn sở thích: Biển, Núi, Thành phố, Văn hóa, Ẩm thực, Phiêu lưu, Nghỉ dưỡng, Thiên nhiên, Lịch sử, Mua sắm, Giải trí đêm, Nhiếp ảnh
- [ ] Validate: ít nhất điểm đến + ngày
- [ ] Tự động tạo lịch trình theo số ngày (activities lấy từ POI/seed data)
- [ ] Hỗ trợ chế độ sửa (editId → mở lại trip để sửa)

### 🧪 Dữ liệu test tạo chuyến đi

| Trường     | Giá trị                          |
| ---------- | -------------------------------- |
| Tên chuyến | Du lịch Đà Nẵng - Hội An 2026    |
| Điểm đến   | Đà Nẵng                          |
| Xuất phát  | Hà Nội                           |
| Ngày       | 20/04/2026 – 23/04/2026 (4 ngày) |
| Số người   | 4                                |
| Ngân sách  | 12.000.000 VNĐ                   |
| Sở thích   | Biển, Ẩm thực, Văn hóa           |

---

## 5. Lịch trình chi tiết

### Tổng quan

- [ ] Tên chuyến đi, điểm đến, ngày, số người
- [ ] Điểm xuất phát
- [ ] Thanh tiến trình ngân sách (đã chi / tổng)
- [ ] Trạng thái chuyến: Nháp / Đang diễn ra / Hoàn thành
- [ ] Nút đổi trạng thái, sửa, chia sẻ, xóa

### Lịch trình theo ngày

- [ ] Mỗi ngày có header (accordion) mở / đóng
- [ ] Nút **"Sắp xếp tự động"**: sắp xếp theo khoảng cách địa lý (nearest-neighbor)
- [ ] Nút **"Xem bản đồ"**: mở modal bản đồ tuyến đường (Leaflet + polylines)
- [ ] Danh sách hoạt động theo khung giờ
- [ ] Hiển thị khoảng cách + thời gian di chuyển giữa 2 hoạt động
- [ ] Phương tiện: Ô tô, Xe máy, Đi bộ (tự chọn theo khoảng cách)
- [ ] Nút thêm địa điểm vào ngày

### Chi tiết hoạt động (bấm vào activity)

- [ ] Tên, thời gian, thời lượng, loại, địa chỉ
- [ ] Mô tả + rating + review mẫu (từ destination hoặc POI)
- [ ] Thông tin POI: giờ mở cửa, thời lượng, chi phí tham khảo, rating
- [ ] Nút mở Google Maps + Grab
- [ ] Đánh giá của người dùng (nếu completed)

### 🧪 Test — Ngày 1 Đà Nẵng

| Giờ   | Hoạt động           | Loại      | Chi phí  |
| ----- | ------------------- | --------- | -------- |
| 07:00 | Bãi biển Mỹ Khê     | Tham quan | 0đ       |
| 09:00 | Ngũ Hành Sơn        | Tham quan | 40.000đ  |
| 11:30 | Quán Bún chả cá 109 | Ẩm thực   | 40.000đ  |
| 14:00 | Cầu Rồng            | Tham quan | 0đ       |
| 16:00 | Chợ Hàn             | Mua sắm   | 200.000đ |
| 18:30 | Mì Quảng Bà Vị      | Ẩm thực   | 35.000đ  |

---

## 6. Quản lý hoạt động trong lịch trình

### Thêm địa điểm

- [ ] **Tab "Từ hệ thống"**: tìm + lọc theo điểm đến, bấm chọn POI
- [ ] **Tab "Thủ công"**: nhập tên, loại, chi phí
- [ ] Tự tính thời gian tiếp theo dựa trên hoạt động trước

### Ghi chú

- [ ] Thêm nhiều ghi chú cho mỗi hoạt động
- [ ] Sửa ghi chú (bấm vào)
- [ ] Xóa ghi chú (confirm)

### Quản lý

- [ ] Đánh dấu hoàn thành ✅ (chỉ khi `active`)
- [ ] Sắp xếp thứ tự (lên / xuống)
- [ ] Xóa hoạt động (confirm)
- [ ] Sửa khung giờ (tự cascade cập nhật các hoạt động sau)
- [ ] Sửa chi phí (ước tính + thực tế) + người trả

### 🧪 Test thêm từ POI

| POI               | Điểm đến | Chi phí  | Loại      |
| ----------------- | -------- | -------- | --------- |
| Bà Nà Hills       | Đà Nẵng  | 900.000đ | Tham quan |
| Bánh Mì Phượng    | Hội An   | 30.000đ  | Nhà hàng  |
| Chùa Cầu Nhật Bản | Hội An   | 120.000đ | Tham quan |

---

## 7. Chi phí & Ngân sách

### Tab Lịch trình

- [ ] Mỗi hoạt động có chi phí ước tính + thực tế
- [ ] Sửa chi phí ước tính (chỉ draft / chưa hoàn thành)
- [ ] Sửa chi phí thực tế (chỉ active trở lên)
- [ ] Tổng ước tính hiện thanh tiến trình

### Tab Chi phí

- [ ] Thêm chi phí phát sinh: tên, loại, số tiền, người trả
- [ ] Loại: Di chuyển, Mua sắm, Ẩm thực, Tham quan, Khác
- [ ] Ghi chú chi phí (thêm, sửa, xóa)
- [ ] Sửa / Xóa khoản chi phí
- [ ] Thanh ngân sách: đã chi / tổng ngân sách / còn lại
- [ ] Cảnh báo vượt ngân sách

### Hiển thị tổng quan

- [ ] Tổng chi phí thực tế (hoạt động + phát sinh)
- [ ] Ngân sách còn lại
- [ ] Tỷ lệ % đã chi trên thanh tiến trình
- [ ] Nút sửa ngân sách + số người

### 🧪 Test ngân sách

| Mục                         | Giá trị                   |
| --------------------------- | ------------------------- |
| Ngân sách tổng              | 12.000.000 VNĐ            |
| Chi hoạt động               | 3.150.000 VNĐ             |
| Chi phát sinh: Vé máy bay   | 4.800.000 VNĐ (Di chuyển) |
| Chi phát sinh: Taxi sân bay | 350.000 VNĐ (Di chuyển)   |
| Tổng đã chi                 | 8.300.000 VNĐ             |
| Còn lại                     | 3.700.000 VNĐ             |
| % đã chi                    | 69%                       |

---

## 8. Chia tiền nhóm

### Khi thêm chi phí

- [ ] Chọn người trả
- [ ] Kiểu chia: Không chia / Chia đều / Chia cá nhân
- [ ] **Chia đều**: checkbox chọn thành viên tham gia → tự chia đều
- [ ] **Chia cá nhân**: nhập số tiền cụ thể cho từng người

### Tab chi phí — Quyết toán

- [ ] Tính toán **ai nợ ai bao nhiêu**
- [ ] Hiển thị danh sách khoản nợ dạng: "A nợ B: 500.000đ"

### 🧪 Test chia tiền

| Chi phí      | Số tiền    | Người trả    | Kiểu chia    | Thành viên                         |
| ------------ | ---------- | ------------ | ------------ | ---------------------------------- |
| Vé máy bay   | 4.800.000đ | Nguyễn Văn A | Chia đều     | A, B, C (= 1.600.000đ/người)       |
| Taxi sân bay | 350.000đ   | Trần Thị B   | Chia đều     | A, B, C, D (= 87.500đ/người)       |
| Quà lưu niệm | 500.000đ   | Lê Văn C     | Chia cá nhân | A: 200.000, B: 150.000, C: 150.000 |

**Kết quả quyết toán:**

- B nợ A: 1.512.500đ (1.600.000 - 87.500)
- C nợ A: 1.450.000đ (1.600.000 - 150.000)

---

## 9. Đánh giá địa điểm

- [ ] Chỉ đánh giá được sau khi đánh dấu hoàn thành hoạt động
- [ ] Rating 1-5 sao + bình luận
- [ ] Sau khi đánh giá: không thể bỏ tick hoàn thành
- [ ] Sửa đánh giá: cập nhật nội dung + rating
- [ ] Xóa đánh giá (confirm)
- [ ] Hỗ trợ nhiều lượt đi (resetCount) — review cũ ẩn đi

### 🧪 Test đánh giá

| Hoạt động       | Rating     | Bình luận                                                    |
| --------------- | ---------- | ------------------------------------------------------------ |
| Bãi biển Mỹ Khê | ⭐⭐⭐⭐⭐ | Biển sạch, cát trắng mịn, nước trong. Sáng sớm rất đẹp!      |
| Ngũ Hành Sơn    | ⭐⭐⭐⭐   | Leo hơi mệt nhưng tầm nhìn rất đẹp. Nên mang giày thoải mái. |
| Bún chả cá 109  | ⭐⭐⭐⭐⭐ | Ngon xuất sắc, giá rẻ chỉ 40k. Phải xếp hàng 15 phút.        |

---

## 10. Trạng thái chuyến đi

### Nháp (Draft)

- [ ] Không có checkbox hoàn thành
- [ ] Cho sửa toàn bộ lịch trình
- [ ] Cho sửa chi phí ước tính
- [ ] Nút "Bắt đầu" → chuyển sang Active (chỉ khi ngày >= ngày bắt đầu)

### Đang diễn ra (Active)

- [ ] Checkbox hoàn thành từng hoạt động
- [ ] Cho sửa: thời gian, chi phí, ghi chú, xóa hoạt động, sắp xếp
- [ ] Thêm địa điểm mới
- [ ] Nút "Hoàn thành" → chuyển sang Completed

### Hoàn thành (Completed)

- [ ] Không cho tick/bỏ tick, thêm/sửa/xóa hoạt động
- [ ] Cho: thêm/sửa/xóa ghi chú, sửa chi phí thực tế, đánh giá

### Reset chuyến đi

- [ ] Đặt lại → Draft
- [ ] Bỏ toàn bộ checkbox, reset chi phí thực tế, xóa chi phí phát sinh
- [ ] Giữ: danh sách địa điểm, ghi chú, thiết lập
- [ ] Ẩn review cũ (gắn tag resetBefore)

### 🧪 Test trạng thái

| Hành động   | Từ → Sang          | Điều kiện                     |
| ----------- | ------------------ | ----------------------------- |
| Bắt đầu     | Nháp → Active      | Ngày hôm nay >= ngày bắt đầu  |
| Bắt đầu sớm | Nháp → ❌          | Ngày chưa đến → thông báo lỗi |
| Hoàn thành  | Active → Completed | Confirm dialog                |
| Reset       | Completed → Draft  | Confirm dialog, giữ danh sách |

---

## 11. Chia sẻ & Quản lý thành viên

### Tạo link chia sẻ

- [ ] Chọn quyền: Chỉ xem (Viewer) / Chỉnh sửa (Editor)
- [ ] Tạo link chia sẻ → copy vào clipboard
- [ ] Link dạng: `http://domain/join/{shareCode}`
- [ ] Đồng bộ lên server để thiết bị/browser khác tìm được

### Tham gia chuyến đi

- [ ] Mở link → đăng nhập (nếu chưa) → auto join
- [ ] Không join trùng
- [ ] Hiển thị quyền (viewer/editor) của mỗi thành viên

### Quản lý thành viên

- [ ] Hiển thị danh sách thành viên + avatar + quyền
- [ ] **Chủ trip** có thể: đổi quyền, xóa thành viên
- [ ] **Thành viên** có thể: rời chuyến đi
- [ ] Thành viên không thể xóa trip

### 🧪 Test chia sẻ

| Bước | Hành động                                 | Kết quả                            |
| ---- | ----------------------------------------- | ---------------------------------- |
| 1    | User A tạo trip, bấm chia sẻ quyền Editor | Tạo link, copy clipboard           |
| 2    | User B mở link trên browser khác          | Tự động join trip với quyền Editor |
| 3    | User B sửa hoạt động                      | Thành công (editor)                |
| 4    | User A đổi quyền B → Viewer               | B không sửa được nữa               |
| 5    | User B bấm rời nhóm                       | Rời thành công                     |

---

## 12. Bản đồ

### Map tab

- [ ] Bản đồ thật (Leaflet + OpenStreetMap)
- [ ] Markers cho tất cả điểm đến đang active
- [ ] Toggle Map / List view
- [ ] Nút refresh + yêu cầu quyền vị trí
- [ ] Hiện vị trí user (blue dot)
- [ ] Badge hiện tổng số điểm đến

### Route map (trong lịch trình)

- [ ] Modal bản đồ tuyến đường mỗi ngày
- [ ] Markers đánh số theo thứ tự
- [ ] Polylines dạng nét đứt nối các điểm
- [ ] Danh sách hoạt động bên dưới bản đồ

### Liên kết ngoài

- [ ] Mở Google Maps từ hoạt động
- [ ] Mở Grab từ hoạt động

### 🧪 Test bản đồ

| Kiểm tra                | Kết quả mong đợi                                   |
| ----------------------- | -------------------------------------------------- |
| Mở Map tab              | Hiện bản đồ OpenStreetMap, markers cho 10 điểm đến |
| Toggle List             | Chuyển sang hiển thị danh sách có tọa độ, rating   |
| Bấm "Xem bản đồ" ngày 1 | Modal: bản đồ 6 markers + nét đứt nối              |
| Bấm Google Maps         | Mở Google Maps tại tọa độ                          |

---

## 13. Danh sách chuyến đi

- [ ] Tab "Chuyến đi" hiện danh sách tất cả trips của user
- [ ] Mỗi trip: tên, điểm đến, ngày, trạng thái badge
- [ ] Tìm kiếm theo tên trip / điểm đến
- [ ] Lọc: Tất cả, Nháp, Đang diễn ra, Hoàn thành
- [ ] Bấm → mở chi tiết lịch trình
- [ ] Nút tạo chuyến đi mới

### 🧪 Test danh sách

| Trip                          | Trạng thái      | Điểm đến |
| ----------------------------- | --------------- | -------- |
| Du lịch Đà Nẵng - Hội An 2026 | 🟢 Đang diễn ra | Đà Nẵng  |
| Phú Quốc cuối tuần            | 📝 Nháp         | Phú Quốc |
| Sa Pa mùa lúa chín            | ✅ Hoàn thành   | Sa Pa    |

---

## 14. Hồ sơ cá nhân & Cài đặt

### Thông tin

- [ ] Avatar (chữ cái đầu tên)
- [ ] Họ tên, email, username, số điện thoại
- [ ] Ngày tham gia
- [ ] Vai trò: User / Admin
- [ ] Sở thích du lịch (preferences)

### Thống kê cá nhân

- [ ] Tổng chuyến đi đã tạo
- [ ] Đánh giá đã viết
- [ ] Số tiền đã chi

### Cài đặt

- [ ] Đổi mật khẩu (nhập pass cũ + mới + xác nhận)
- [ ] Đăng xuất
- [ ] Admin: nút "Quản trị hệ thống"

### 🧪 Test hồ sơ

| Trường         | Giá trị Nguyễn Văn A   |
| -------------- | ---------------------- |
| Avatar         | "N" (chữ đầu)          |
| Tên            | Nguyễn Văn A           |
| Email          | vana@gmail.com         |
| SĐT            | 0901234567             |
| Sở thích       | Biển, Ẩm thực, Văn hóa |
| Tổng chuyến đi | 3                      |
| Tổng review    | 5                      |

---

## 15. Thông báo

- [ ] Danh sách thông báo theo thời gian
- [ ] Loại: info (xanh), success (xanh lá), warning (cam)
- [ ] Badge số chưa đọc ở icon chuông
- [ ] Bấm → đánh dấu đã đọc
- [ ] Nút "Đánh dấu tất cả đã đọc"
- [ ] Nút "Xóa tất cả"

### 🧪 Test thông báo

| Thời điểm            | Thông báo                         | Loại    |
| -------------------- | --------------------------------- | ------- |
| Bắt đầu trip         | "Du lịch Đà Nẵng đã bắt đầu!"     | info    |
| Hoàn thành hoạt động | ""Bãi biển Mỹ Khê" đã hoàn thành" | info    |
| Chi vượt ngân sách   | "Chi phí đã vượt ngân sách!"      | warning |
| Hoàn thành trip      | "Du lịch Đà Nẵng đã hoàn thành!"  | success |

---

## 16. Admin Dashboard

- [ ] Thống kê tổng: Người dùng, Chuyến đi, Đánh giá, Điểm đến
- [ ] Top điểm đến phổ biến (dựa trên itinerary)
- [ ] Hoạt động gần đây (timeline)

### 🧪 Test dashboard

| Thống kê        | Giá trị           |
| --------------- | ----------------- |
| Tổng người dùng | 4                 |
| Tổng chuyến đi  | 5                 |
| Tổng đánh giá   | 12                |
| Tổng điểm đến   | 10                |
| Top 1 phổ biến  | Đà Nẵng (3 trips) |

---

## 17. Admin — Quản lý người dùng

- [ ] Danh sách: tên, email, avatar, ngày tạo, số trip, trạng thái
- [ ] Tìm kiếm theo tên / email
- [ ] Lọc theo trạng thái (active/locked)
- [ ] Sắp xếp theo ngày tạo
- [ ] Xem chi tiết: danh sách chuyến đi + review
- [ ] Sửa thông tin
- [ ] Khóa / Mở khóa tài khoản
- [ ] Xóa tài khoản (confirm)

### 🧪 Test quản lý user

| Hành động    | Test                                             |
| ------------ | ------------------------------------------------ |
| Tìm "Nguyễn" | Hiện Nguyễn Văn A + PlanGo Admin                 |
| Khóa User B  | Trạng thái → Đã khóa, User B đăng nhập → báo lỗi |
| Xóa User C   | Confirm → xóa toàn bộ dữ liệu User C             |

---

## 18. Admin — Quản lý điểm đến

- [ ] Danh sách điểm đến: ảnh, tên, danh mục, rating, trạng thái
- [ ] Tìm kiếm theo tên / loại
- [ ] Lọc theo danh mục
- [ ] Sắp xếp theo rating
- [ ] Thêm điểm đến:
  - [ ] Tìm từ Nominatim (auto-fill tên, địa chỉ, tọa độ)
  - [ ] Upload ảnh (Unsplash)
  - [ ] Nhập: mô tả, tips, highlights, tags, chi phí, giờ mở cửa
- [ ] Sửa điểm đến
- [ ] Bật / Tắt hiển thị (isActive)

### 🧪 Test thêm điểm đến

| Trường          | Giá trị                                      |
| --------------- | -------------------------------------------- |
| Tên             | Mũi Né                                       |
| Danh mục        | Biển                                         |
| Địa chỉ         | Mũi Né, Bình Thuận, Việt Nam                 |
| Tọa độ          | 10.9333, 108.2872                            |
| Rating          | 4.3                                          |
| Chi phí / người | 1.200.000 VNĐ                                |
| Tags            | Biển, Đồi cát, Kite surf, Hải sản            |
| Highlights      | Đồi cát bay, Bãi biển hoang sơ, Kite surfing |
| Tips            | Mùa gió tốt nhất cho kite surf: tháng 11-4   |

---

## 19. Admin — Quản lý đánh giá

- [ ] Danh sách: người dùng, điểm đến, rating, nội dung, ngày
- [ ] **2 sub-tab**: Đánh giá điểm đến / Đánh giá POI
- [ ] Tìm theo tên điểm đến / người dùng
- [ ] Lọc theo số sao (1-5)
- [ ] Sắp xếp theo ngày
- [ ] Xóa đánh giá (confirm)

### 🧪 Test

| Lọc           | Kết quả                      |
| ------------- | ---------------------------- |
| 5 sao         | Hiện các review 5 sao        |
| Tìm "Hạ Long" | Hiện review của Vịnh Hạ Long |
| Xóa review    | Confirm → xóa thành công     |

---

## 20. Admin — Quản lý POI

- [ ] Danh sách POI: tên, loại, điểm đến, rating, trạng thái
- [ ] Tìm kiếm theo tên POI
- [ ] Lọc theo điểm đến / loại POI
- [ ] Loại: Tham quan, Nhà hàng, Cafe, Khách sạn, Mua sắm, Khác
- [ ] Thêm POI:
  - [ ] Tìm từ Nominatim (auto-fill)
  - [ ] Chọn loại, nhập mô tả, chi phí, thời lượng, giờ mở cửa
- [ ] Sửa POI
- [ ] Bật / Tắt hiển thị

### 🧪 Dữ liệu test POI

| Tên POI             | Loại      | Điểm đến  | Chi phí          | Thời lượng | Giờ mở cửa  |
| ------------------- | --------- | --------- | ---------------- | ---------- | ----------- |
| Bà Nà Hills         | Tham quan | Đà Nẵng   | 900.000đ         | 1 ngày     | 07:00-22:00 |
| Cầu Vàng            | Tham quan | Đà Nẵng   | 0đ (trong Bà Nà) | 30 phút    | 07:00-22:00 |
| Bãi biển Mỹ Khê     | Tham quan | Đà Nẵng   | 0đ               | 2 giờ      | 24 giờ      |
| Bánh Mì Phượng      | Nhà hàng  | Hội An    | 30.000đ          | 30 phút    | 06:00-21:00 |
| Chùa Cầu Nhật Bản   | Tham quan | Hội An    | 120.000đ         | 1 giờ      | 08:00-17:00 |
| Quán Cơm gà Bà Buội | Nhà hàng  | Hội An    | 60.000đ          | 45 phút    | 10:00-21:00 |
| Tháp Bà Ponagar     | Tham quan | Nha Trang | 22.000đ          | 1.5 giờ    | 06:00-18:00 |
| I-Resort tắm bùn    | Tham quan | Nha Trang | 400.000đ         | 3 giờ      | 07:00-19:00 |
| Động Thiên Đường    | Tham quan | Phong Nha | 250.000đ         | 2 giờ      | 07:00-16:30 |
| Dark Cave zipline   | Phiêu lưu | Phong Nha | 450.000đ         | 3 giờ      | 07:00-15:00 |
| Hồ Xuân Hương       | Tham quan | Đà Lạt    | 0đ               | 1 giờ      | 24 giờ      |
| Thác Datanla        | Tham quan | Đà Lạt    | 70.000đ          | 2 giờ      | 07:00-17:00 |
| Hang Múa            | Tham quan | Ninh Bình | 100.000đ         | 2 giờ      | 05:30-19:00 |
| Tràng An            | Tham quan | Ninh Bình | 200.000đ         | 3 giờ      | 06:00-16:00 |
| Fansipan (cáp treo) | Tham quan | Sa Pa     | 800.000đ         | 3 giờ      | 07:30-17:00 |
| Bản Cát Cát         | Văn hóa   | Sa Pa     | 70.000đ          | 2 giờ      | 07:00-17:00 |
| Đại Nội Huế         | Tham quan | Huế       | 200.000đ         | 3 giờ      | 07:00-17:30 |
| Lăng Khải Định      | Tham quan | Huế       | 100.000đ         | 1.5 giờ    | 07:00-17:30 |
| VinWonders Phú Quốc | Tham quan | Phú Quốc  | 880.000đ         | 1 ngày     | 09:00-21:00 |
| Bãi Sao             | Tham quan | Phú Quốc  | 0đ               | 3 giờ      | 24 giờ      |

---

## 21. Dữ liệu & API

### API sử dụng (100% miễn phí)

- [ ] **Nominatim** (OpenStreetMap): tìm kiếm, geocoding, gợi ý địa điểm
- [ ] **Unsplash Source**: ảnh miễn phí theo từ khóa
- [ ] **Leaflet.js + OpenStreetMap tiles**: hiển thị bản đồ

### Dữ liệu seed (10 điểm đến có sẵn)

- [ ] Vịnh Hạ Long (Thiên nhiên, ⭐4.8)
- [ ] Phố cổ Hội An (Văn hóa, ⭐4.7)
- [ ] Sa Pa (Núi, ⭐4.6)
- [ ] Đảo Phú Quốc (Biển, ⭐4.5)
- [ ] Đà Nẵng (Thành phố, ⭐4.5)
- [ ] Ninh Bình (Thiên nhiên, ⭐4.6)
- [ ] Đà Lạt (Núi, ⭐4.4)
- [ ] Kinh thành Huế (Lịch sử, ⭐4.5)
- [ ] Nha Trang (Biển, ⭐4.3)
- [ ] Phong Nha - Kẻ Bàng (Phiêu lưu, ⭐4.7)

### Mỗi điểm đến có đầy đủ:

- [ ] Mô tả, tọa độ, ảnh Unsplash, ratings, tags
- [ ] Highlights + Tips + Thời gian lý tưởng
- [ ] Quán ăn gần đó (tên, địa chỉ, giá, loại món)
- [ ] Review mẫu (3-4 review, nguồn Google/TripAdvisor)
- [ ] Chi phí ước tính / người

---

## 📊 Tổng hợp dữ liệu test Ready-to-Use

### Kịch bản test đầy đủ (End-to-end)

```
Bước 1: Đăng ký tài khoản "nguyenvana" / "123456"
Bước 2: Đăng nhập
Bước 3: Khám phá → tìm "Đà Nẵng" → xem chi tiết
Bước 4: Tạo chuyến đi 4 ngày Đà Nẵng (20-23/04/2026, 4 người, 12 triệu)
Bước 5: Xem lịch trình → mở ngày 1 → xem chi tiết hoạt động
Bước 6: Thêm địa điểm từ POI → chọn "Bà Nà Hills"
Bước 7: Sắp xếp tự động → kiểm tra thứ tự thay đổi
Bước 8: Xem bản đồ tuyến đường → kiểm tra markers + polylines
Bước 9: Chia sẻ trip cho User B → User B join bằng link
Bước 10: Bắt đầu chuyến đi (chuyển Active)
Bước 11: Tick hoàn thành "Bãi biển Mỹ Khê" → review 5 sao
Bước 12: Thêm chi phí "Vé máy bay" 4.800.000đ → chia đều 4 người
Bước 13: Kiểm tra tab chi phí → ai nợ ai
Bước 14: Hoàn thành chuyến đi
Bước 15: Vào Map tab → xem bản đồ tất cả điểm đến
Bước 16: Đăng nhập admin → kiểm tra dashboard + quản lý
```

---
