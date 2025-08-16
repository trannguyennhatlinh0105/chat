# Test Chatwoot Webhook Manual

## Test với data thật từ Chatwoot

Hãy copy paste exact webhook data từ Chatwoot logs (nếu có) hoặc test với format này:

```powershell
$body = @'
{
  "event": "message_created",
  "data": {
    "id": 999,
    "content": "Xin chào tôi cần hỗ trợ",
    "message_type": "incoming",
    "created_at": "2025-01-16T10:00:00Z",
    "conversation": {
      "id": 1
    },
    "account": {
      "id": 1
    },
    "sender": {
      "id": 1,
      "name": "Customer"
    }
  }
}
'@

Invoke-WebRequest -Uri "https://botbinhnn.vercel.app/webhook" -Method POST -ContentType "application/json" -Body $body
```

## Nếu manual test hoạt động → Vấn đề ở Chatwoot config
## Nếu manual test không hoạt động → Vấn đề ở code
