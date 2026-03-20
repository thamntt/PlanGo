# 🗺️ Hướng Dẫn Setup Google Maps Platform API

Dự án **Travel Planner Pro (PlanGo)** sử dụng các API sau từ Google Maps Platform:

| API | Chức năng |
|-----|-----------|
| **Places API (New)** | Tìm kiếm địa điểm, xem chi tiết, ảnh |
| **Geocoding API** | Chuyển địa chỉ → tọa độ (lat/lng) |
| **Directions API** | Tính tuyến đường giữa 2 điểm |

---

## 📋 Mục Lục

1. [Tạo Google Cloud Project](#1-tạo-google-cloud-project)
2. [Bật các API cần thiết](#2-bật-các-api-cần-thiết)
3. [Tạo API Key](#3-tạo-api-key)
4. [Giới hạn API Key (Bảo mật)](#4-giới-hạn-api-key-bảo-mật)
5. [Thiết lập Billing](#5-thiết-lập-billing)
6. [Cấu hình trong dự án](#6-cấu-hình-trong-dự-án)
7. [Kiểm tra API Key](#7-kiểm-tra-api-key)
8. [Bảng giá & Free Tier](#8-bảng-giá--free-tier)
9. [Xử lý lỗi thường gặp](#9-xử-lý-lỗi-thường-gặp)

---

## 1. Tạo Google Cloud Project

1. Truy cập **[Google Cloud Console](https://console.cloud.google.com/)**
2. Đăng nhập bằng tài khoản Google
3. Click **"Select a project"** (góc trên bên trái) → **"New Project"**
4. Đặt tên project, ví dụ: `Travel-Planner-Pro`
5. Click **"Create"**
6. Chờ project được tạo xong, đảm bảo đã **chọn đúng project** vừa tạo

> [!TIP]
> Nếu đã có project sẵn, bạn có thể dùng lại — không cần tạo mới.

---

## 2. Bật Các API Cần Thiết

Cần bật **3 API** sau trong Google Cloud Console:

### Cách 1: Bật qua link trực tiếp

Click từng link dưới đây (đảm bảo đã chọn đúng project):

- 🔗 [Places API (New)](https://console.cloud.google.com/apis/library/places-backend.googleapis.com)
- 🔗 [Geocoding API](https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com)
- 🔗 [Directions API](https://console.cloud.google.com/apis/library/directions-backend.googleapis.com)

Với mỗi link → Click nút **"Enable"**.

### Cách 2: Bật qua API Library

1. Vào **[APIs & Services → Library](https://console.cloud.google.com/apis/library)**
2. Tìm kiếm từng API theo tên:
   - `Places API (New)` — ⚠️ chọn bản **New**, không chọn bản cũ
   - `Geocoding API`
   - `Directions API`
3. Click vào từng API → nhấn **"Enable"**

### Xác nhận API đã bật

Vào **[APIs & Services → Enabled APIs](https://console.cloud.google.com/apis/dashboard)** và kiểm tra 3 API trên đều xuất hiện trong danh sách.

> [!IMPORTANT]
> Phải bật bản **Places API (New)**, KHÔNG phải "Places API" (legacy). Dự án sử dụng endpoint `places.googleapis.com/v1` (bản New).

---

## 3. Tạo API Key

1. Vào **[APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)**
2. Click **"+ Create Credentials"** → chọn **"API key"**
3. API Key sẽ được tạo và hiển thị — **copy lại ngay**
4. Click **"Close"**

> [!CAUTION]
> **KHÔNG chia sẻ API Key công khai** (không commit lên GitHub, không đưa vào code). Luôn lưu trong file `.env` và thêm `.env` vào `.gitignore`.

---

## 4. Giới Hạn API Key (Bảo Mật)

Để tránh bị lạm dụng API Key, nên thiết lập giới hạn:

1. Trong trang **Credentials**, click vào API Key vừa tạo
2. Trong phần **"API restrictions"**:
   - Chọn **"Restrict key"**
   - Tick chọn 3 API:
     - ✅ Places API (New)
     - ✅ Geocoding API
     - ✅ Directions API
3. *(Tùy chọn)* Trong phần **"Application restrictions"**:
   - Nếu chỉ dùng cho server backend → chọn **"IP addresses"** và thêm IP server
   - Nếu đang phát triển local → để **"None"** tạm thời
4. Click **"Save"**

> [!TIP]
> Bạn cũng có thể đặt **quota limit** cho mỗi API để kiểm soát chi phí:
> Vào **[APIs & Services → Quotas](https://console.cloud.google.com/apis/dashboard)** → chọn API → đặt giới hạn requests/ngày.

---

## 5. Thiết Lập Billing

Google Maps Platform **yêu cầu bật Billing** để API hoạt động, nhưng có **$200 credit miễn phí/tháng**.

1. Vào **[Billing](https://console.cloud.google.com/billing)**
2. Click **"Link a billing account"** hoặc **"Create account"**
3. Nhập thông tin thẻ tín dụng/ghi nợ (Visa/Mastercard)
4. Liên kết billing account với project

> [!NOTE]
> Google cung cấp **$200 miễn phí mỗi tháng** cho Google Maps Platform. Với mức sử dụng thông thường của ứng dụng du lịch cá nhân, bạn **sẽ không bị tính phí**.

---

## 6. Cấu Hình Trong Dự Án

Mở file `.env` ở thư mục gốc của dự án và thêm/sửa dòng sau:

```env
# Google Maps Platform API Key (get from https://console.cloud.google.com/apis/credentials)
# Enable: Places API (New), Geocoding API, Directions API
GOOGLE_PLACES_API_KEY=YOUR_API_KEY_HERE
```

Thay `YOUR_API_KEY_HERE` bằng API Key bạn đã copy ở Bước 3.

**Ví dụ:**
```env
GOOGLE_PLACES_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> [!WARNING]
> Sau khi sửa `.env`, cần **khởi động lại server** (`npm run dev`) để áp dụng.

---

## 7. Kiểm Tra API Key

### Cách 1: Chạy server và kiểm tra log

```bash
npm run dev
```

Nếu API Key hợp lệ, khi tìm kiếm địa điểm hoặc tạo lịch trình AI, terminal sẽ hiện:
```
[Google] Geocoding X activities...
[Google] Geocoding complete
```

### Cách 2: Test trực tiếp bằng cURL

**Test Geocoding API:**
```bash
curl "https://maps.googleapis.com/maps/api/geocode/json?address=Ha+Noi&key=YOUR_API_KEY_HERE"
```

**Test Places API (New):**
```bash
curl -X POST "https://places.googleapis.com/v1/places:searchText" ^
  -H "Content-Type: application/json" ^
  -H "X-Goog-Api-Key: YOUR_API_KEY_HERE" ^
  -H "X-Goog-FieldMask: places.displayName,places.formattedAddress" ^
  -d "{\"textQuery\": \"Hoan Kiem Lake\"}"
```

Nếu trả về kết quả JSON chứa thông tin địa điểm → **API Key hoạt động tốt** ✅

---

## 8. Bảng Giá & Free Tier

Google Maps Platform tặng **$200 credit miễn phí mỗi tháng**. Bảng giá chính:

| API | Giá (sau $200 free) | Số request miễn phí/tháng* |
|-----|---------------------|---------------------------|
| Places Text Search | $32 / 1,000 requests | ~6,250 requests |
| Place Details | $17 / 1,000 requests | ~11,764 requests |
| Geocoding | $5 / 1,000 requests | ~40,000 requests |
| Directions | $5 / 1,000 requests | ~40,000 requests |
| Place Photos | $7 / 1,000 requests | ~28,571 requests |

*\*Tính toán ước tính dựa trên $200 free credit/tháng*

> [!TIP]
> Để kiểm soát chi phí, có thể đặt **Budget Alert** tại [Billing → Budgets & Alerts](https://console.cloud.google.com/billing/budgets).

---

## 9. Xử Lý Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Cách sửa |
|------|-------------|----------|
| `GOOGLE_PLACES_API_KEY not configured` | Chưa thêm API Key vào `.env` | Thêm `GOOGLE_PLACES_API_KEY=...` vào `.env` |
| `REQUEST_DENIED` | API chưa bật hoặc Key bị giới hạn | Kiểm tra lại [Bước 2](#2-bật-các-api-cần-thiết) |
| `OVER_QUERY_LIMIT` | Vượt quá quota | Chờ ngày mai hoặc nâng quota |
| `INVALID_REQUEST` | Tham số sai | Kiểm tra lại input (address, place ID...) |
| `The provided API key is invalid` | API Key sai hoặc đã bị xóa | Tạo Key mới ở [Bước 3](#3-tạo-api-key) |
| API trả về data rỗng | Key hợp lệ nhưng chưa bật Billing | Bật Billing ở [Bước 5](#5-thiết-lập-billing) |

---

## 📌 Tóm Tắt Nhanh

```
1️⃣  Tạo project trên Google Cloud Console
2️⃣  Bật 3 API: Places (New) + Geocoding + Directions
3️⃣  Tạo API Key trong Credentials
4️⃣  Giới hạn API Key (bảo mật)
5️⃣  Bật Billing (có $200 free/tháng)
6️⃣  Dán Key vào file .env → GOOGLE_PLACES_API_KEY=...
7️⃣  Khởi động lại server: npm run dev
```

---

> **Cần hỗ trợ thêm?** Xem tài liệu chính thức:
> - [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
> - [Places API (New) Guide](https://developers.google.com/maps/documentation/places/web-service/op-overview)
> - [Geocoding API Guide](https://developers.google.com/maps/documentation/geocoding/overview)
> - [Directions API Guide](https://developers.google.com/maps/documentation/directions/overview)
