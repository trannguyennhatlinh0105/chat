# 🔗 Tích hợp Chatwoot với Bot AI

## 📋 Hướng dẫn setup

### Bước 1: Cấu hình Webhook trong Chatwoot

1. **Vào Chatwoot Admin**
   - Settings → Integrations → Webhooks
   - Thêm webhook mới với URL: `https://botbinhnn.vercel.app/webhook`
   - Chọn events: `message_created`

### Bước 2: Lấy Chatwoot API Key

1. **Vào Chatwoot Admin**
   - Settings → Integrations → API Access Tokens  
   - Tạo token mới với quyền agent
   - Copy API key

### Bước 3: Cấu hình Environment Variables trên Vercel

Thêm các biến sau trong Vercel Dashboard:

```
CHATWOOT_API_KEY = your_chatwoot_api_access_token
CHATWOOT_BASE_URL = https://your-chatwoot-instance.com
```

**Ví dụ:**
```
CHATWOOT_API_KEY = ctk_abc123xyz789
CHATWOOT_BASE_URL = https://chat.yourdomain.com
```

### Bước 4: Redeploy

Sau khi thêm environment variables, redeploy project trên Vercel.

## 🔧 Cách hoạt động

1. **Khách hàng gửi tin nhắn** trong Chatwoot
2. **Chatwoot gửi webhook** tới `https://botbinhnn.vercel.app/webhook`
3. **Bot xử lý tin nhắn** bằng Gemini AI
4. **Bot gửi phản hồi** lại Chatwoot qua API
5. **Khách hàng nhận phản hồi** trong chat

## 📝 Format webhook từ Chatwoot

```json
{
  "event": "message_created",
  "data": {
    "id": 123,
    "content": "Xin chào",
    "message_type": "incoming",
    "conversation": {
      "id": 456
    },
    "account": {
      "id": 1
    }
  }
}
```

## 🔍 Debug

### Kiểm tra webhook logs:
1. Vào Vercel Dashboard → Functions → View Function Logs
2. Tìm log `[Webhook]` và `[Chatwoot]`

### Test webhook thủ công:
```bash
curl -X POST https://botbinhnn.vercel.app/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message_created",
    "data": {
      "content": "Test message",
      "message_type": "incoming",
      "conversation": {"id": 123},
      "account": {"id": 1}
    }
  }'
```

### Kiểm tra phản hồi:
- `chatwoot_sent: true` - Gửi thành công
- `chatwoot_sent: false` - Có lỗi, xem `chatwoot_error`

## ⚠️ Lưu ý

1. **Bot chỉ trả lời tin nhắn incoming** (từ khách hàng)
2. **Không trả lời tin nhắn của bot** (tránh loop)
3. **Cần CHATWOOT_API_KEY** để gửi phản hồi tự động
4. **Webhook secret** có thể bỏ trống nếu Chatwoot không hỗ trợ

## 🎯 Kết quả mong đợi

Sau khi setup đúng:
- ✅ Khách hàng gửi "Xin chào" 
- ✅ Bot tự động trả lời trong vài giây
- ✅ Conversation diễn ra tự nhiên
- ✅ Lead được thu thập tự động
