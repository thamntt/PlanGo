# Auth Setup Guide

Hệ thống PlanGo hỗ trợ 4 phương thức đăng nhập:

| Phương thức         | Trạng thái code | Cần config                |
| ------------------- | --------------- | ------------------------- |
| Email + password    | ✅ Sẵn dùng     | Không                     |
| Google OAuth        | ✅ Code xong    | Google Cloud Console      |
| Facebook OAuth      | ✅ Code xong    | Facebook for Developers   |
| Apple Sign In (iOS) | ✅ Code xong    | Apple Developer ($99/năm) |

Mọi flow đều dùng JWT token từ `/api/auth/login` hoặc `/api/auth/social` để duy trì session.

---

## 1. Google OAuth

### 1.1. Tạo OAuth Client IDs

1. Vào https://console.cloud.google.com/
2. Tạo project mới hoặc chọn project có sẵn → tên `PlanGo`
3. Menu trái → **APIs & Services** → **OAuth consent screen**
   - User Type: **External**
   - App name: `PlanGo`
   - User support email: email của bạn
   - Authorized domains: `plango.vn` (nếu chưa có domain → để trống, dùng `localhost` lúc dev)
   - Scopes: `email`, `profile`, `openid`
   - Test users: thêm email Gmail của bạn để test (lúc còn ở mode "Testing")

4. **Credentials** → **Create Credentials** → **OAuth client ID**, tạo 3 client:

   **Client 1 — Web (cho Expo Web + redirect khi dev):**
   - Application type: **Web application**
   - Authorized JavaScript origins:
     ```
     http://localhost:8081
     http://localhost:19006
     https://auth.expo.io
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:8081
     https://auth.expo.io/@your-expo-username/plango
     ```
   - Copy **Client ID** → bỏ vào `.env`: `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=...`

   **Client 2 — iOS:**
   - Application type: **iOS**
   - Bundle ID: `com.plango` (khớp với `app.json` → `expo.ios.bundleIdentifier`)
   - Copy **Client ID** → `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=...`

   **Client 3 — Android:**
   - Application type: **Android**
   - Package name: `com.plango` (khớp `app.json` → `expo.android.package`)
   - SHA-1 certificate fingerprint:
     - Lúc dev local: chạy `eas credentials -p android` → Expo cho SHA-1 của debug keystore
     - Lúc release: dùng SHA-1 của keystore production
   - Copy **Client ID** → `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=...`

### 1.2. Server config

Đồng thời thêm vào `.env` của server (cùng những client IDs trên — BE cần để verify token):

```env
GOOGLE_OAUTH_CLIENT_ID_WEB=<paste Client ID Web>
GOOGLE_OAUTH_CLIENT_ID_IOS=<paste Client ID iOS>
GOOGLE_OAUTH_CLIENT_ID_ANDROID=<paste Client ID Android>
```

> BE check audience trong ID token khớp với 1 trong 3 client IDs này.

### 1.3. Test

1. Restart server: `npm run dev`
2. Mở app → tap "Continue with Google" → flow Google bật → chọn tài khoản → quay lại app đã login

---

## 2. Facebook OAuth

### 2.1. Tạo Facebook App

1. Vào https://developers.facebook.com/apps/
2. Click **Create App**
   - Use case: **Authenticate and request data from users with Facebook Login**
3. App name: `PlanGo` → email contact
4. Vào app vừa tạo → **Add product** → **Facebook Login** → **Set up**
5. Menu trái → **Facebook Login** → **Settings**:
   - Valid OAuth Redirect URIs:
     ```
     https://auth.expo.io/@your-expo-username/plango
     http://localhost:8081
     ```
   - Save changes
6. **Settings → Basic**:
   - App Domains: `auth.expo.io`, `plango.vn`, `localhost`
   - Privacy Policy URL: link Privacy Policy (cần có khi launch — tạm thời để URL Google Sites cũng được)
   - Copy **App ID** (16 chữ số)
   - Click "Show" cạnh **App Secret** → copy

### 2.2. Bật quyền email

- **App Review → Permissions and Features** → tìm "email" → click "Request" (mặc định Facebook cho phép permission `email` cho app mới mà không cần review nếu chỉ dùng Test mode)
- Khi app live → submit cho Facebook review để release public

### 2.3. Config

**Mobile FE** `.env`:

```env
EXPO_PUBLIC_FACEBOOK_APP_ID=<App ID 16 chữ số>
```

**Server** `.env`:

```env
FACEBOOK_APP_ID=<App ID>
FACEBOOK_APP_SECRET=<App Secret>
```

### 2.4. Test

App → "Continue with Facebook" → Facebook dialog → cấp quyền `email` → quay lại app login.

---

## 3. Apple Sign In (iOS only)

### 3.1. Yêu cầu

- **Apple Developer Account** ($99/năm — bắt buộc)
- iOS device (simulator iOS 13+ cũng được, không cần thiết bị thật)

### 3.2. Setup trong Xcode/EAS

1. Vào https://developer.apple.com/account/resources/identifiers/
2. **Identifiers** → click **+** → **App IDs** → **App**
   - Bundle ID: `com.plango` (khớp `app.json`)
   - Capabilities: tick **Sign in with Apple**
3. Tạo Service ID (cho web — optional, chỉ cần nếu launch web có Apple login):
   - **Services IDs** → **+** → tên `com.plango.web` → tick **Sign in with Apple**
   - Configure → Primary App ID = `com.plango` → return URL = `https://auth.expo.io/@your-expo-username/plango`

### 3.3. Update `app.json`

Mở `app.json` thêm:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.plango",
      "usesAppleSignIn": true
    }
  }
}
```

### 3.4. Server `.env`

```env
APPLE_BUNDLE_ID=com.plango
# Optional, chỉ cần nếu support web:
APPLE_SERVICE_ID=com.plango.web
```

### 3.5. Test

- Build native với EAS: `eas build --profile development --platform ios`
- Hoặc test trên iOS Simulator (cần Sign in với Apple ID trong Settings của Simulator)
- App → "Continue with Apple" → native dialog Apple → Face ID/passcode → login

> **Lưu ý**: Apple trả về tên user **chỉ lần đầu** đăng nhập. Code đã handle gửi tên này lên server lần đầu để lưu.

---

## 4. Email (Resend) cho Forgot Password

### 4.1. Setup Resend

1. Vào https://resend.com → Sign up
2. **API Keys** → **Create API Key** → name `plango-prod` → copy key
3. **Domains** → **Add Domain** → `plango.vn` (cần domain bạn sở hữu)
   - Resend cho 3 DNS record (TXT, MX) → thêm vào DNS provider (Cloudflare/Namecheap)
   - Đợi 5-30 phút → status "Verified"

### 4.2. Server `.env`

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=PlanGo <noreply@plango.vn>
APP_URL=https://app.plango.vn
```

> **Dev mode**: Nếu không set `RESEND_API_KEY`, server log email vào console thay vì gửi thật. Đủ cho test forgot-password flow lúc dev.

### 4.3. Test

1. Login PlanGo → đăng xuất → màn login → click "Quên mật khẩu?"
2. Nhập email → "Gửi liên kết đặt lại"
3. Check email → click link → đến screen "Đặt lại mật khẩu" → nhập password mới → success

---

## 5. Test flow social trên dev local (Expo Go)

Expo Go có sẵn redirect URI `https://auth.expo.io/@<expo-username>/<slug>` — không cần build native:

1. Đăng nhập Expo CLI: `npx expo login`
2. Thêm `https://auth.expo.io/@your-username/plango` vào Authorized redirect URIs của Google/Facebook
3. `npm run expo:dev` → tap social button → flow OAuth bật qua Expo proxy → callback → BE issue JWT

> ⚠️ Apple Sign In **không hoạt động trong Expo Go** — phải build native EAS.

---

## 6. Production checklist

- [ ] Google OAuth: chuyển consent screen từ "Testing" → "Production" (cần verify domain ownership)
- [ ] Facebook: submit cho App Review, chuyển sang Live mode
- [ ] Apple: kích hoạt App ID trong production provisioning profile
- [ ] Resend: verify domain DNS đầy đủ (TXT, MX, DKIM, SPF, DMARC)
- [ ] Privacy Policy + Terms of Service: deploy publicly (Google/Apple yêu cầu URL)
- [ ] Rate limit: BE `authLimiter` = 10 attempts/phút/IP — điều chỉnh ở `server/middlewares/rate-limit.ts` nếu cần
- [ ] Monitor Sentry: set `SENTRY_DSN` để track auth errors trong production
- [ ] Backup user table: cron `pg_dump` daily

---

## Troubleshooting

### Google: "Error 400: invalid_request"

- Authorized JavaScript origins hoặc redirect URIs chưa khớp với URL FE gọi
- Recheck `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB` đúng client (đừng nhầm với iOS/Android client)

### Facebook: "Email permission required"

- User chưa cấp quyền `email` trong Facebook dialog. Hỏi lại user.
- App bị Facebook khoá permission `email` (chưa pass review) → submit App Review

### Apple: "ERR_REQUEST_CANCELED"

- User huỷ dialog Apple
- Hoặc Bundle ID không khớp giữa Apple Developer + `app.json`

### Resend: emails không gửi được

- Domain chưa verified → check Resend dashboard
- Domain verified nhưng vào spam → setup DKIM + SPF + DMARC
- Vẫn vào spam → request domain warmup (Resend support)

### BE: "OAUTH_NOT_CONFIGURED"

- Tương ứng env var chưa set. Check `.env` server, restart `npm run dev`
