# Binhnn Digital Chat Bot 🤖

Trợ lý AI thông minh được tích hợp Gemini AI cho Binhnn Digital - hỗ trợ tư vấn dịch vụ và thu thập lead tự động.

## ✨ Tính năng

- 🤖 **Chat AI thông minh** với Gemini 1.5 Flash
- 🎯 **Thu thập lead tự động** từ cuộc hội thoại
- 📊 **Forward lead** tới Google Sheets, Zapier
- 🔒 **Webhook bảo mật** với signature verification
- 🚀 **Deploy dễ dàng** trên Vercel/Render
- 📱 **Responsive UI** hoạt động mọi thiết bị

## 🚀 Cài đặt nhanh

### 1. Clone và cài đặt dependencies
```bash
git clone <repo-url>
cd chat
npm install
```

### 2. Cấu hình biến môi trường
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

Chỉnh sửa `.env`:
```bash
# Bắt buộc: API key từ Google AI Studio
GEMINI_API_KEY=your_gemini_api_key_here

# Tùy chọn
GEMINI_MODEL=models/gemini-1.5-flash
WEBHOOK_SECRET=your_webhook_secret
LEADS_WEBHOOK_URL=your_webhook_url
PORT=3000
```

### 3. Chạy ứng dụng
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Lỗi thường gặp và cách khắc phục

### ❌ **HTTP 500: FUNCTION_INVOCATION_FAILED**

**Nguyên nhân:** Code có lỗi cú pháp hoặc biến môi trường chưa đúng.

**Khắc phục:**
1. **Kiểm tra GEMINI_API_KEY:** Đảm bảo đã set đúng API key
2. **Kiểm tra syntax:** Đã fix lỗi duplicate variable `parts` trong `server.js`
3. **Cài đặt dependencies:** Chạy `npm install`

### ❌ **Missing GEMINI_API_KEY**

**Khắc phục:** 
1. Tạo API key tại [Google AI Studio](https://makersuite.google.com/)
2. Thêm vào file `.env`: `GEMINI_API_KEY=your_key_here`

### ❌ **ERR_MODULE_NOT_FOUND**

**Khắc phục:** 
```bash
npm install
```

## 📁 Cấu trúc dự án

```
├── server.js          # Main server + API endpoints
├── package.json       # Dependencies & scripts
├── vercel.json        # Vercel deployment config
├── .env              # Environment variables (local)
├── .env.example      # Template cho .env
├── config/
│   └── business.json # Cấu hình doanh nghiệp
├── data/
│   └── kb.md        # Knowledge base
└── public/
    └── index.html   # Frontend chat interface
```

## 🌐 Deploy

### Vercel (Recommended)
1. Connect repo to Vercel
2. Set environment variables in dashboard
3. Deploy tự động

### Render
1. Connect repo to Render  
2. Set environment variables
3. Deploy

## 🔗 API Endpoints

- `GET /` - Chat interface
- `POST /api/chat` - Chat với AI
- `GET /api/config` - Lấy cấu hình
- `POST /webhook` - Nhận webhook
- `GET /health` - Health check

## 📞 Hỗ trợ

- **Website:** [binhnn.dev](https://binhnn.dev)
- **Email:** contact@binhnn.dev
- **Phone:** 0876 011 134

