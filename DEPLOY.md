# 🚀 Hướng dẫn Deploy lên Vercel

## Bước 1: Chuẩn bị code
✅ Code đã được fix lỗi và test thành công  
✅ File `.gitignore` đã được tạo (không push API key)  
✅ File `vercel.json` đã được cấu hình đúng  

## Bước 2: Push lên GitHub

### 2.1. Khởi tạo Git (nếu chưa có)
```bash
git init
git add .
git commit -m "Initial commit: Binhnn Digital Chat Bot"
```

### 2.2. Connect với GitHub repo
```bash
git remote add origin https://github.com/trannguyennhatlinh0105/chat.git
git branch -M main
git push -u origin main
```

## Bước 3: Deploy trên Vercel

### 3.1. Import Project
1. Truy cập [vercel.com](https://vercel.com/)
2. Đăng nhập bằng GitHub
3. Click **"New Project"**
4. Import repo `trannguyennhatlinh0105/chat`

### 3.2. Cấu hình Environment Variables
Trong Vercel dashboard, vào **Settings > Environment Variables** và thêm:

```
GEMINI_API_KEY = AIzaSyALhfHGzo2irnBJj_FYqS9p8CefvrTmYJQ
GEMINI_MODEL = models/gemini-1.5-flash  
WEBHOOK_SECRET = your_webhook_secret_here
LEADS_WEBHOOK_URL = https://script.google.com/macros/s/AKfycbzXI9SJHNa0fIivetEhBKZ7tbkwOO4s1sIFJXZu3JWz_1AuxRpUBUtOiLZTZTnDefq0xg/exec
```

### 3.3. Deploy Settings
- **Framework Preset:** Other
- **Build Command:** (để trống)
- **Output Directory:** (để trống)
- **Install Command:** `npm install`

### 3.4. Deploy
Click **"Deploy"** và chờ vài phút!

## Bước 4: Test Production

### 4.1. Kiểm tra endpoints
- `https://your-app.vercel.app/` - Chat interface
- `https://your-app.vercel.app/health` - Health check
- `https://your-app.vercel.app/api/config` - Config API

### 4.2. Test chat functionality
1. Mở chat interface
2. Gửi tin nhắn: "Xin chào"
3. Kiểm tra bot có trả lời không

## 🔧 Troubleshooting

### Lỗi "Missing GEMINI_API_KEY"
- Kiểm tra Environment Variables trong Vercel dashboard
- Redeploy sau khi thêm biến môi trường

### Lỗi 500 Internal Server Error
- Kiểm tra Function Logs trong Vercel dashboard
- Đảm bảo model name đúng: `models/gemini-1.5-flash`

### Static files không load
- Kiểm tra `vercel.json` routes configuration
- Đảm bảo files trong `/public` folder

## 📞 Support
- **Website:** [binhnn.dev](https://binhnn.dev)
- **Email:** contact@binhnn.dev
