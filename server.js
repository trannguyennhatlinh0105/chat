// server.js — Trợ lý Binhnn Digital + Webhook + Trích xuất lead (fixed SyntaxError)
// - Tương thích Vercel Serverless: export default app; KHÔNG process.exit
// - Local dev vẫn chạy qua app.listen khi không có biến môi trường VERCEL

import express from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import * as crypto from "crypto"; // dùng namespace import để tránh lỗi ESM
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // bắt buộc cho /api/chat
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ""; // tuỳ chọn
const MODEL = process.env.GEMINI_MODEL || "models/gemini-1.5-flash";
const LEADS_WEBHOOK_URL = process.env.LEADS_WEBHOOK_URL || ""; // Apps Script/Zapier
const CHATWOOT_API_KEY = process.env.CHATWOOT_API_KEY || ""; // API key cho Chatwoot
const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL || ""; // Base URL của Chatwoot instance
const PORT = process.env.PORT || 3000;

// Chuẩn hoá __dirname trong ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- Load business config & KB ----
const bizPath = path.join(__dirname, "config", "business.json");
const kbPath = path.join(__dirname, "data", "kb.md");
const business = fs.existsSync(bizPath) ? JSON.parse(fs.readFileSync(bizPath, "utf8")) : {
  brand: "Binhnn Digital",
  services: ["Thiết kế web","SEO tổng thể","Chạy quảng cáo","Giải pháp digital trọn gói"],
  lead_required: ["full_name","email","phone","service_interest"],
  booking_url: ""
};
const KB = fs.existsSync(kbPath) ? fs.readFileSync(kbPath, "utf8") : "";

// ---- Persona & schema ----
const SYSTEM_INSTRUCTION = `Bạn là trợ lý ảo của ${business.brand}.
- Giọng điệu: thân thiện, chuyên nghiệp, ngắn gọn.
- Ưu tiên tư vấn các dịch vụ: ${business.services.join(", ")}.
- Khi người dùng hỏi, trả lời dựa trên Knowledge Base (KB) trước; nếu KB không có, đưa câu trả lời tốt nhất + nói rõ là ước lượng.
- Luôn hướng tới việc đặt lịch tư vấn (nếu phù hợp): ${business.booking_url || "(chưa cấu hình)"}.
- Nếu khách có nhu cầu, từng bước hỏi để thu thập: họ tên, email, điện thoại, website hiện tại, mục tiêu, ngân sách, thời gian.
- Nếu ngoài phạm vi, đề xuất phương án khác hoặc hẹn lịch.
- Không bịa giá/ưu đãi nếu KB không có.
- Tất cả trả lời bằng tiếng Việt.`;

const leadSchema = {
  type: "object",
  properties: {
    full_name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    company: { type: "string" },
    website: { type: "string" },
    service_interest: { type: "array", items: { type: "string" } },
    budget: { type: "string" },
    timeline: { type: "string" },
    goals: { type: "string" },
    notes: { type: "string" },
    qualified: { type: "boolean" },
    missing_fields: { type: "array", items: { type: "string" } }
  }
};

// ---- Helpers ----
function signOk(req){
  if (!WEBHOOK_SECRET) {
    console.log("[Signature] No WEBHOOK_SECRET, allowing all requests");
    return true;
  }
  const sig = req.header("x-webhook-signature");
  if (!sig) {
    console.log("[Signature] No signature header found, rejecting");
    return false;
  }
  const payload = JSON.stringify(req.body || {});
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
  const isValid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  console.log("[Signature] Validation result:", isValid);
  return isValid;
}

async function geminiCall({ prompt, history = [], jsonMode = false, schema = null }){
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const contents = [];
  if (SYSTEM_INSTRUCTION) {
    contents.push({ role: "user", parts: [{ text: `# System Instruction
${SYSTEM_INSTRUCTION}

# Knowledge Base (rút gọn)
${KB.slice(0, 12000)}` }] });
  }
  for (const m of history) contents.push(m);
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const body = {
    contents,
    generationConfig: {
      temperature: jsonMode ? 0.2 : 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: jsonMode ? 512 : 1024,
      ...(jsonMode ? { responseMimeType: "application/json", responseSchema: schema || leadSchema } : {})
    }
  };

  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map(p => (typeof p?.text === "string" ? p.text : ""))
    .join("\n")
    .trim();
  // Convert \n trong source => newline khi chạy
  return text;
}

async function forwardLead(lead){
  if (!LEADS_WEBHOOK_URL) return { forwarded: false };
  try {
    const r = await fetch(LEADS_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
    return { forwarded: true, status: r.status };
  } catch (e) {
    return { forwarded: false, error: String(e) };
  }
}

async function sendChatwootMessage(conversationId, accountId, message) {
  if (!CHATWOOT_API_KEY || !CHATWOOT_BASE_URL) {
    console.log("[Chatwoot] Missing API credentials");
    return { sent: false, error: "Missing CHATWOOT_API_KEY or CHATWOOT_BASE_URL" };
  }
  
  try {
    const url = `${CHATWOOT_BASE_URL}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
    console.log("[Chatwoot] Sending to URL:", url);
    console.log("[Chatwoot] Using API key:", CHATWOOT_API_KEY.substring(0, 10) + "...");
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CHATWOOT_API_KEY}`,
        "api_access_token": CHATWOOT_API_KEY // Fallback cho một số Chatwoot versions
      },
      body: JSON.stringify({
        content: `🤖 ${message}`,
        message_type: "outgoing"
      })
    });
    
    console.log("[Chatwoot] Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log("[Chatwoot] Error response:", errorText);
      throw new Error(`Chatwoot API error: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    console.log("[Chatwoot] Success response:", responseData);
    return { sent: true, status: response.status, data: responseData };
  } catch (e) {
    console.error("[Chatwoot] Send error:", e);
    return { sent: false, error: String(e) };
  }
}

// ---- API ----
app.get("/api/config", (_, res) => res.json({ brand: business.brand, booking_url: business.booking_url }));

// Debug endpoint để kiểm tra environment variables
app.get("/api/debug", (_, res) => {
  res.json({
    hasGeminiKey: !!GEMINI_API_KEY,
    hasWebhookSecret: !!WEBHOOK_SECRET,
    hasChatwootKey: !!CHATWOOT_API_KEY,
    hasChatwootUrl: !!CHATWOOT_BASE_URL,
    chatwootUrl: CHATWOOT_BASE_URL || "NOT_SET",
    geminiModel: MODEL,
    nodeEnv: process.env.NODE_ENV || "not_set"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    // 1) Trả lời người dùng
    const answer = await geminiCall({ prompt: message, history: Array.isArray(history) ? history : [] });

    // 2) Trích xuất lead ở dạng JSON có cấu trúc
    const extractPrompt = `Dựa trên hội thoại trên, hãy trích xuất thông tin lead nếu có. Nếu thiếu trường, liệt kê trong missing_fields. Đánh dấu qualified=true nếu khách có nhu cầu thật sự.`;
    let leadJson = await geminiCall({ prompt: extractPrompt, history: [ ...(Array.isArray(history)?history:[]), { role: "model", parts:[{ text: answer }] } ], jsonMode: true, schema: leadSchema });
    let lead;
    try { lead = JSON.parse(leadJson); } catch { lead = {}; }

    // 3) Forward lead sang Google Sheet/Zapier (nếu cấu hình)
    const fwd = await forwardLead({ source: "chat", brand: business.brand, ...lead, created_at: new Date().toISOString() });

    return res.json({ ok: true, answer, lead, forward: fwd });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// POST webhook thực tế - Tích hợp Chatwoot
app.post("/webhook", async (req, res) => {
  try {
    console.log("[Webhook] === NEW WEBHOOK REQUEST ===");
    console.log("[Webhook] Timestamp:", new Date().toISOString());
    console.log("[Webhook] Headers:", JSON.stringify(req.headers, null, 2));
    console.log("[Webhook] Body:", JSON.stringify(req.body, null, 2));
    
    // Disable signature validation để debug
    // if (!signOk(req)) {
    //   console.log("[Webhook] Signature check failed");
    //   return res.status(401).json({ ok:false, error: "Invalid signature" });
    // }
    
    const webhookData = req.body;
    
    // Kiểm tra xem có phải Chatwoot webhook không
    if (webhookData.event && webhookData.data) {
      console.log("[Webhook] Event type:", webhookData.event);
      console.log("[Webhook] Data structure:", Object.keys(webhookData.data));
      
      // Flexible message detection - handle nhiều formats
      const isMessageEvent = webhookData.event.includes('message') || webhookData.event === 'message_created';
      const messageData = webhookData.data;
      
      // Lấy content từ nhiều possible fields
      const content = messageData.content || messageData.message?.content || messageData.body;
      const messageType = messageData.message_type || messageData.type || 'unknown';
      const conversationId = messageData.conversation?.id || messageData.conversation_id;
      const accountId = messageData.account?.id || messageData.account_id;
      
      console.log("[Webhook] Extracted - Event:", webhookData.event, "Type:", messageType, "Content:", content);
      console.log("[Webhook] IDs - Conversation:", conversationId, "Account:", accountId);
      
      // Xử lý nếu là incoming message và có đủ thông tin
      if (isMessageEvent && content && conversationId && accountId) {
        // Skip bot messages (avoid loops)
        if (content.includes('🤖') || content.includes('[Bot]') || messageType === 'outgoing') {
          console.log("[Webhook] Skipping bot message to avoid loop");
          return res.json({ ok: true, received: true, skipped: "bot_message" });
        }
        
        console.log(`[Chatwoot] Processing user message: "${content}"`);
        
        try {
          console.log("[AI] Calling Gemini...");
          const aiResponse = await geminiCall({ prompt: content, history: [] });
          console.log(`[AI] Response: "${aiResponse}"`);
          
          console.log("[Chatwoot] Sending response back...");
          const chatwootResult = await sendChatwootMessage(conversationId, accountId, aiResponse);
          
          return res.json({ 
            ok: true, 
            received: true, 
            processed: true,
            ai_response: aiResponse,
            chatwoot_sent: chatwootResult.sent,
            chatwoot_error: chatwootResult.error || null
          });
        } catch (error) {
          console.error('[Processing Error]', error);
          return res.json({ 
            ok: true, 
            received: true, 
            processed: false,
            error: String(error)
          });
        }
      } else {
        console.log("[Webhook] Not processing - missing data or not message event");
      }
    } else {
      console.log("[Webhook] Not a structured webhook - missing event or data");
    }
    
    // Webhook khác hoặc không phải message
    console.log("[Webhook] Returning basic OK response");
    return res.json({ ok:true, received:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: String(e?.message||e) });
  }
});

// Webhook bypass cho debug (không cần signature)
app.post("/webhook-test", async (req, res) => {
  try {
    console.log("[Webhook-Test] === BYPASS WEBHOOK ===");
    console.log("[Webhook-Test] Body:", JSON.stringify(req.body, null, 2));
    
    const webhookData = req.body;
    
    // Xử lý trực tiếp không cần check signature
    if (webhookData.event && webhookData.data) {
      console.log("[Webhook-Test] Event:", webhookData.event);
      
      if (webhookData.event === 'message_created' && 
          webhookData.data.message_type === 'incoming') {
        
        const message = webhookData.data.content;
        const conversationId = webhookData.data.conversation?.id;
        const accountId = webhookData.data.account?.id;
        
        console.log("[Webhook-Test] Processing:", message, conversationId, accountId);
        
        if (message && conversationId && accountId) {
          try {
            const aiResponse = await geminiCall({ prompt: message, history: [] });
            const chatwootResult = await sendChatwootMessage(conversationId, accountId, aiResponse);
            
            return res.json({ 
              ok: true, 
              processed: true,
              ai_response: aiResponse,
              chatwoot_sent: chatwootResult.sent,
              chatwoot_error: chatwootResult.error || null
            });
          } catch (error) {
            console.error("[Webhook-Test] Error:", error);
            return res.json({ ok: false, error: String(error) });
          }
        }
      }
    }
    
    return res.json({ ok: true, received: true, processed: false });
  } catch (e) {
    console.error("[Webhook-Test] Error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// GET /webhook để ai mở bằng trình duyệt thì thấy hướng dẫn
app.get("/webhook", (_, res) => res.status(405).send("Use POST with JSON body to this endpoint."));

app.get("/health", (_, res) => res.json({ ok: true }));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Vercel: export default app (Serverless). Local: chỉ listen khi không chạy trên Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
}
export default app;