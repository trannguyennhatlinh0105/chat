# 🔗 Webhook URLs

## 📥 Incoming Webhooks (Nhận data từ bên ngoài)

Sau khi deploy lên Vercel, webhook URLs sẽ là:

### Production URLs:
```
https://[your-vercel-domain]/webhook      # Main webhook endpoint
https://[your-vercel-domain]/health       # Health check
https://[your-vercel-domain]/api/chat     # Chat API
https://[your-vercel-domain]/api/config   # Config API
```

### Local Development URLs:
```
http://localhost:3000/webhook      # Main webhook endpoint
http://localhost:3000/health       # Health check
http://localhost:3000/api/chat     # Chat API
http://localhost:3000/api/config   # Config API
```

## 📤 Outgoing Webhook (Gửi data ra ngoài)

Hiện tại đã cấu hình:
```
LEADS_WEBHOOK_URL = https://script.google.com/macros/s/AKfycbzXI9SJHNa0fIivetEhBKZ7tbkwOO4s1sIFJXZu3JWz_1AuxRpUBUtOiLZTZTnDefq0xg/exec
```

## 🛠️ Cách sử dụng:

### 1. Nhận webhook từ bên ngoài:
```bash
curl -X POST https://your-app.vercel.app/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: [signature]" \
  -d '{"message": "Hello from external service"}'
```

### 2. Test chat API:
```bash
curl -X POST https://your-app.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Xin chào", "history": []}'
```

### 3. Kiểm tra health:
```bash
curl https://your-app.vercel.app/health
```

## 🔐 Bảo mật:

- Webhook có thể dùng signature verification với `WEBHOOK_SECRET`
- Header cần: `x-webhook-signature`
- Nếu không set `WEBHOOK_SECRET`, mọi request đều được chấp nhận

## 🚀 Sau khi deploy:

1. Vào Vercel Dashboard
2. Copy domain của bạn
3. Thay `[your-vercel-domain]` bằng domain thật
4. Sử dụng các URL trên cho webhook integration
