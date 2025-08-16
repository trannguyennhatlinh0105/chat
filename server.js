// server.js — Trợ lý Binhnn Digital + Webhook + Trích xuất lead
import express from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import crypto from "crypto";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // bắt buộc
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ""; // tuỳ chọn
const MODEL = process.env.GEMINI_MODEL || "models/gemini-1.5-flash";
const LEADS_WEBHOOK_URL = process.env.LEADS_WEBHOOK_URL || ""; // Apps Script/Zapier
const PORT = process.env.PORT || 3000;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

const __dirname = path.resolve();
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
  if (!WEBHOOK_SECRET) return true;
  const sig=req.header("x-webhook-signature");
  if(!sig) return false;
  const payload=JSON.stringify(req.body||{});
  const expected=crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

async function geminiCall({prompt, history=[] , jsonMode=false, schema=null}){
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

  const r = await fetch(url, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body)});
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p=>p.text).join("
").trim();
  return text;
}

async function forwardLead(lead){
  if (!LEADS_WEBHOOK_URL) return { forwarded: false };
  try {
    const r = await fetch(LEADS_WEBHOOK_URL, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(lead) });
    return { forwarded: true, status: r.status };
  } catch (e) {
    return { forwarded: false, error: String(e) };
  }
}

// ---- API ----
app.get("/api/config", (_,res)=>res.json({ brand: business.brand, booking_url: business.booking_url }));

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    // 1) Trả lời người dùng
    const answer = await geminiCall({ prompt: message, history: Array.isArray(history)?history:[] });

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
    return res.status(500).json({ ok:false, error: String(err?.message||err) });
  }
});

app.post("/webhook", (req, res) => {
  try {
    if (!signOk(req)) return res.status(401).json({ ok:false, error: "Invalid signature" });
    console.log("[Webhook]", new Date().toISOString(), JSON.stringify(req.body));
    return res.json({ ok:true, received:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: String(e?.message||e) });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));