# Travel Planner Pro (PlanGo)

Ứng dụng lập kế hoạch du lịch Việt Nam với AI (Gemini) hỗ trợ gợi ý lịch trình.

## Yêu cầu

- **Node.js** >= 18
- **npm** >= 9
- **Expo Go** app trên điện thoại (tải từ App Store / Google Play)

## Cài đặt

```bash
# Clone project
git clone <repo-url>
cd Travel-Planner-Pro

# Cài dependencies
npm install
```

## Cấu hình `.env`

Tạo file `.env` ở thư mục gốc (copy từ `.env.example` nếu có):

```env
# Session secret
SESSION_SECRET=<random_string>

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/dbname

# Gemini AI API Key (lấy tại https://aistudio.google.com/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# Domain cho Expo app kết nối đến server backend
# ⚠️ Xem hướng dẫn bên dưới để cấu hình đúng
EXPO_PUBLIC_DOMAIN=192.168.x.x:5001
```

> **Lưu ý**: Nếu không có `GEMINI_API_KEY`, tính năng gợi ý lịch trình AI sẽ fallback về logic local.

---

## 📱 Chạy trên điện thoại (Expo Go)

### ⭐ Cách 1: Dùng Tunnel (Khuyên dùng — không cần cùng WiFi)

Mở **3 terminal riêng biệt**:

**Terminal 1 — Server backend:**
```bash
npm run dev
```

**Terminal 2 — Tunnel cho backend server:**
```bash
npm run tunnel
```
> Chờ đến khi hiện URL, ví dụ: `https://abc123.ngrok.io`
>
> Copy dòng `EXPO_PUBLIC_DOMAIN=abc123.ngrok.io` mà script in ra, dán vào file `.env`

**Terminal 3 — Expo app:**
```bash
npx expo start --tunnel
```
> Quét QR code trên điện thoại bằng **Expo Go** app

⚠️ **Lưu ý**: URL ngrok thay đổi mỗi lần chạy → cần cập nhật `.env` lại mỗi lần.

---

### Cách 2: Dùng LAN (cần cùng WiFi)

<details>
<summary>Click để xem hướng dẫn LAN</summary>

#### Bước 1: Tìm IP LAN của máy tính

```bash
ipconfig
```
Tìm dòng **IPv4 Address** (thường dạng `192.168.x.x`)

#### Bước 2: Cập nhật `.env`

```env
EXPO_PUBLIC_DOMAIN=192.168.x.x:5001
```

#### Bước 3: Mở tường lửa Windows (chạy CMD Admin, chỉ cần làm 1 lần)

```bash
netsh advfirewall firewall add rule name="Expo Dev Server Port 5001" dir=in action=allow protocol=TCP localport=5001
netsh advfirewall firewall add rule name="Expo Metro Bundler 8081" dir=in action=allow protocol=TCP localport=8081
```

#### Bước 4: Chạy

**Terminal 1:** `npm run dev`
**Terminal 2:** `npx expo start --lan`

> ⚠️ **KHÔNG dùng** `npm run expo:dev` (script đó force localhost)

</details>

---

### ❌ Khắc phục lỗi kết nối

| Vấn đề | Giải pháp |
|--------|-----------|
| `Network request failed` | Kiểm tra IP/URL trong `.env` đã đúng chưa |
| CORS error | Khởi động lại server (`npm run dev`) |
| Tường lửa chặn (LAN) | Chạy lệnh `netsh` với quyền Admin |
| Bundle load chậm/lỗi | Thử `npx expo start --tunnel --clear` |
| Tunnel URL hết hạn | Chạy lại `npm run tunnel` và cập nhật `.env` |

---

## 💻 Chạy trên máy tính (Web/Localhost)

Mở **2 terminal**:

**Terminal 1 — Server:**
```bash
npm run dev
```

**Terminal 2 — Expo web:**
```bash
npm run expo:dev
```

> Expo web chạy tại `http://localhost:8081`

---

## Các lệnh hữu ích

| Lệnh | Mô tả |
|-------|-------|
| `npm run dev` | Chạy server Express (port 5001) |
| `npm run expo:dev` | Chạy Expo web dev (localhost, port 8081) |
| `npx expo start --lan` | Chạy Expo trên LAN (cho điện thoại) |
| `npx expo start --tunnel` | Chạy Expo qua tunnel (không cần cùng WiFi) |
| `npm run db:push` | Push schema database (Drizzle) |
| `npm run lint` | Kiểm tra lint |
| `npm run lint:fix` | Tự động sửa lint |
| `npm run server:build` | Build server production |
| `npm run server:prod` | Chạy server production |

## Cấu trúc dự án

```
Travel-Planner-Pro/
├── app/                    # React Native screens (Expo Router)
│   ├── (tabs)/             # Tab navigation (explore, trips, map, profile)
│   ├── itinerary/[id].tsx  # Chi tiết lịch trình
│   ├── create-trip.tsx     # Tạo chuyến đi (+ AI Preview)
│   └── join/[code].tsx     # Tham gia chuyến đi qua link
├── contexts/               # React Context (Auth, Data, Settings)
├── lib/                    # Utilities (storage, i18n, validation)
├── server/                 # Express backend
│   ├── index.ts            # Server entry point
│   └── routes.ts           # API routes (places, share, AI generate)
├── constants/              # Theme colors
├── components/             # Shared components
├── .env                    # Environment variables
└── package.json
```

## Tính năng chính

- 🗺️ **Khám phá** điểm đến Việt Nam
- ✈️ **Tạo lịch trình** với AI (Gemini) + xem trước
- 👥 **Chia sẻ** chuyến đi với bạn bè
- 💰 **Quản lý chi phí** + chia tiền
- 📊 **Xuất báo cáo** chi tiêu
- 🔔 **Nhắc nhở nợ** tự động
- ⭐ **Đánh giá** địa điểm
- 🗺️ **Bản đồ** tuyến đường
