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
EXPO_PUBLIC_DOMAIN=192.168.x.x:5000
```

> **Lưu ý**: Nếu không có `GEMINI_API_KEY`, tính năng gợi ý lịch trình AI sẽ fallback về logic local.

---

## 📱 Chạy trên điện thoại qua LAN (Expo Go)

### Bước 1: Tìm IP LAN của máy tính

Mở **CMD** (hoặc PowerShell) và chạy:

```bash
ipconfig
```

Tìm dòng **IPv4 Address** trong adapter WiFi đang dùng (thường dạng `192.168.x.x`):

```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 192.168.1.20   ← IP này
```

> **💡 Mẹo**: Nếu bạn dùng mạng dây (Ethernet), tìm trong phần `Ethernet adapter`.

### Bước 2: Cập nhật `.env`

Thay IP trong `.env` bằng IP vừa tìm được:

```env
EXPO_PUBLIC_DOMAIN=192.168.1.20:5000
```

> ⚠️ **Mỗi lần đổi mạng WiFi, IP có thể thay đổi** → cần kiểm tra lại `ipconfig` và cập nhật `.env`.

### Bước 3: Mở tường lửa Windows (chỉ cần làm 1 lần)

Mở **CMD với quyền Administrator** (chuột phải → "Run as administrator") và chạy **2 lệnh**:

```bash
netsh advfirewall firewall add rule name="Expo Dev Server Port 5000" dir=in action=allow protocol=TCP localport=5000

netsh advfirewall firewall add rule name="Expo Metro Bundler 8081" dir=in action=allow protocol=TCP localport=8081
```

Nếu thành công sẽ hiện `Ok.`

> 🔒 **Xóa rule tường lửa** (khi không cần nữa):
> ```bash
> netsh advfirewall firewall delete rule name="Expo Dev Server Port 5000"
> netsh advfirewall firewall delete rule name="Expo Metro Bundler 8081"
> ```

### Bước 4: Chạy Server + Expo

Mở **2 terminal riêng biệt**:

**Terminal 1 — Server backend:**
```bash
npm run dev
```
> Server chạy tại `http://0.0.0.0:5000` (lắng nghe trên mọi IP)

**Terminal 2 — Expo app:**
```bash
npx expo start --lan
```
> ⚠️ **BẮT BUỘC dùng `npx expo start --lan`**, không dùng `npm run expo:dev` (vì script đó force localhost).

### Bước 5: Kết nối điện thoại

1. **Đảm bảo** điện thoại và máy tính **cùng mạng WiFi**
2. Mở app **Expo Go** trên điện thoại
3. **Quét QR code** hiện trên Terminal 2
4. Chờ app tải xong (lần đầu có thể mất 1-2 phút)

### ❌ Khắc phục lỗi kết nối

| Vấn đề | Giải pháp |
|--------|-----------|
| Điện thoại không quét được QR | Đảm bảo cùng WiFi, thử tắt/bật WiFi trên điện thoại |
| `Network request failed` | Kiểm tra IP trong `.env` đã đúng chưa (`ipconfig`) |
| CORS error | Khởi động lại server (`npm run dev`) |
| Tường lửa chặn | Chạy lại lệnh `netsh` ở Bước 3 với quyền Admin |
| Bundle load chậm/lỗi | Thử `npx expo start --lan --clear` để xóa cache |
| `EXPO_PUBLIC_DOMAIN is not set` | Kiểm tra file `.env` có đúng tên biến không |

### 🔄 Cách thay thế: Dùng Tunnel (không cần cùng WiFi)

Nếu LAN không hoạt động, dùng tunnel:

```bash
npx expo start --tunnel
```

> Cần cài `@expo/ngrok` (đã có trong devDependencies). Tunnel sẽ tạo URL public, nhưng **server backend vẫn cần accessible qua LAN**.

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
| `npm run dev` | Chạy server Express (port 5000) |
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
