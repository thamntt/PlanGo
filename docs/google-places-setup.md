# Hướng dẫn tìm kiếm địa điểm (Nominatim / OpenStreetMap)

## Không cần API Key!

Hệ thống sử dụng **Nominatim** (OpenStreetMap) để tìm kiếm địa điểm, hoàn toàn **miễn phí**, **không cần API key**, **không cần đăng ký**, **không cần thẻ tín dụng**.

## Cách sử dụng

Chỉ cần chạy server:

```bash
npm run dev
```

Vào trang **Admin** → tab **Destinations** hoặc **POI** → nhập tên địa điểm vào ô tìm kiếm → kết quả sẽ hiển thị tự động.

## Tính năng

| Tính năng         | Mô tả                                               |
| ----------------- | --------------------------------------------------- |
| Tìm kiếm địa điểm | Tìm theo tên thành phố, điểm tham quan, nhà hàng... |
| Tọa độ (lat/lng)  | Tự động điền khi chọn kết quả                       |
| Địa chỉ           | Địa chỉ đầy đủ từ OpenStreetMap                     |
| Loại địa điểm     | Tự động phân loại (attraction, restaurant, cafe...) |
| Ảnh               | Ảnh minh họa từ Unsplash (stock ảnh miễn phí)       |

> [!TIP]
> Nominatim là dịch vụ công cộng của OpenStreetMap. Không có giới hạn chi phí, chỉ cần tuân thủ rate limit (1 request/giây).

## So sánh với Google Places API

|             | Google Places            | Nominatim (hiện tại)   |
| ----------- | ------------------------ | ---------------------- |
| **Chi phí** | $200 free/tháng, cần thẻ | **Hoàn toàn miễn phí** |
| **API Key** | Bắt buộc                 | **Không cần**          |
| **Đăng ký** | Google Cloud Console     | **Không cần**          |
| **Dữ liệu** | Google Maps              | OpenStreetMap          |
