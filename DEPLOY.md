# PlanGo — Deploy Guide

Combo free hosting: **Vercel (frontend) + Render (backend) + Xata (DB) + UptimeRobot (keep-alive)** = $0/tháng forever.

Total setup time: ~30 phút.

---

## Prerequisites

- [x] GitHub repo: `thamntt/PlanGo`
- [x] Xata DB connected (DATABASE_URL trong `.env` local)
- [ ] Render account
- [ ] Vercel account
- [ ] UptimeRobot account

---

## Step 1 — Deploy Backend lên Render (10 phút)

1. Vào [render.com](https://render.com) → **Sign up with GitHub**
2. Click **New +** → **Web Service**
3. Connect repo: chọn `thamntt/PlanGo`
4. Trên trang config, Render sẽ auto-detect `render.yaml` → bấm **Apply**

   Nếu không detect được, set tay:
   - Name: `plango-backend`
   - Region: `Singapore`
   - Branch: `dev`
   - Build Command: `npm install --legacy-peer-deps`
   - Start Command: `npx tsx server/index.ts`
   - Plan: **Free**

5. **Quan trọng — Set Environment Variables:**
   Trên dashboard project, vào tab **Environment** → click **Add Environment Variable**, paste hết từ `.env` local trừ EXPO_PUBLIC_DOMAIN:

   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=postgresql://xata:KEY@xxx.us-east-1.xata.tech/xata?sslmode=require
   SESSION_SECRET=<copy từ .env>
   GEMINI_API_KEY=<copy>
   OPENAI_API_KEY=<copy>
   GOOGLE_PLACES_API_KEY=<copy>
   GOONG_API_KEY=<copy>
   SERPAPI_KEY=<copy>
   ```

6. Click **Create Web Service**
7. Đợi build (5-10 phút lần đầu) → xong sẽ có URL kiểu:
   ```
   https://plango-backend.onrender.com
   ```
8. Test: mở `https://plango-backend.onrender.com/api/health` → phải trả `{"status":"ok"...}`

✅ **Backend đã online**

---

## Step 2 — Deploy Frontend lên Vercel (10 phút)

1. Vào [vercel.com](https://vercel.com) → **Sign Up with GitHub**
2. **Import Project** → chọn repo `thamntt/PlanGo`
3. Vercel sẽ auto-detect `vercel.json`, để mặc định
4. **Environment Variables** — chỉ cần 1 biến:
   ```
   EXPO_PUBLIC_DOMAIN=plango-backend.onrender.com
   ```
   (không có `https://`, không có `/api`)
5. Click **Deploy**
6. Đợi 3-5 phút build
7. Vercel trả URL kiểu:
   ```
   https://plan-go.vercel.app
   ```

✅ **Frontend đã online**

---

## Step 3 — Setup UptimeRobot Keep-Alive (5 phút)

Render free service sleep sau 15 phút inactive. UptimeRobot ping liên tục giữ awake.

1. Vào [uptimerobot.com](https://uptimerobot.com) → Sign up (free)
2. **Add New Monitor** → **HTTP(s)**
3. Config:
   - Friendly Name: `PlanGo Backend`
   - URL: `https://plango-backend.onrender.com/api/health`
   - Monitoring Interval: **5 minutes** (free tier minimum)
4. Click **Create Monitor**

✅ **Keep-alive đã bật**

---

## Step 4 — Test End-to-End

1. Mở URL Vercel trên browser: `https://plan-go.vercel.app`
2. Đăng ký tài khoản mới
3. Tạo trip → check không có lỗi 500
4. Share URL cho bạn bè qua Zalo/Messenger

---

## Common Issues

### Backend build fail trên Render với "EADDRINUSE" hoặc port error
- Đảm bảo `PORT=10000` (Render dùng 10000 cho free tier)
- Code đã đọc `env.PORT` rồi nên OK

### Frontend báo "Network error" khi gọi BE
- Check `EXPO_PUBLIC_DOMAIN` không có `https://` prefix
- Check Render BE đang awake (mở `/api/health` thử)

### "Cold start" 30-60s khi user mới mở app
- Setup UptimeRobot ping đúng URL
- Render miss 1 vài ping vẫn OK, nhưng nếu liên tục miss thì sleep

### CORS error
- Backend đã có CORS middleware, nếu vẫn lỗi check `EXPO_PUBLIC_DOMAIN` của Vercel match exactly

### Xata DB hết quota (75GB egress)
- Sau vài tháng nếu nhiều user → upgrade Xata Pro hoặc switch Supabase

---

## Updating App

Mỗi lần code update:
```bash
git add .
git commit -m "your message"
git push origin dev
```

Render + Vercel watch branch `dev` → tự rebuild + redeploy. Đợi 3-5 phút là xong.

---

## URL List sau setup

- **Web app:** `https://plan-go.vercel.app`
- **Backend API:** `https://plango-backend.onrender.com`
- **Health check:** `https://plango-backend.onrender.com/api/health`
- **GitHub:** `https://github.com/thamntt/PlanGo`
- **Xata dashboard:** `https://app.xata.io`
- **Render dashboard:** `https://dashboard.render.com`
- **Vercel dashboard:** `https://vercel.com/dashboard`
- **UptimeRobot:** `https://uptimerobot.com/dashboard`

---

## Cost Summary

| Service | Plan | Cost |
|---|---|---|
| Xata DB | Free (15GB + 75GB egress) | $0/tháng |
| Render BE | Free (512MB RAM, keep-alive trick) | $0/tháng |
| Vercel FE | Hobby (100GB bandwidth) | $0/tháng |
| UptimeRobot | Free (50 monitors) | $0/tháng |
| GitHub | Free | $0/tháng |
| **TOTAL** | | **$0/tháng** |

Đủ dùng cho 0-500 active user. Nếu vượt → upgrade dần (~$25/tháng Supabase Pro hoặc Render Starter).
