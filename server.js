// server.js
// Node 18+ (built‑in fetch). Minimal Express server with:
//  - POST /api/chat  -> proxy to Google AI Studio (Gemini)
//  - POST /webhook   -> receive 3rd‑party events (optional shared secret)
//  - GET  /          -> serve static UI from /public

import express from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // required
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ""; // optional
const MODEL = process.env.GEMINI_MODEL || "models/gemini-1.5-flash"; // fast & cheap
const PORT = process.env.PORT || 3000;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in environment.");
  process.exit(1);
}

const __dirname = path.resolve();
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- Helpers ----
function isValidSignature(req) {
  if (!WEBHOOK_SECRET) return true; // no secret -> accept all
  const sig = req.header("x-webhook-signature");
  if (!sig) return false;
  const payload = JSON.stringify(req.body || {});
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  // timing‑safe compare
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

async function callGemini(prompt, history = []) {
  // history: array of {role: "user"|"model", parts: [{text:"..."}]}
  const contents = [];
  for (const msg of history) contents.push(msg);
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const candidates = data?.candidates || [];
  const text = candidates[0]?.content?.parts?.map(p => p.text).join("\n") || "";
  return text.trim();
}

// ---- API: Chat ----
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing 'message' string" });
    }
    const answer = await callGemini(message, Array.isArray(history) ? history : []);
    return res.json({ ok: true, answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// ---- API: Webhook ----
// 3rd parties POST events here. Example payload:
// { type: "lead.created", data: { name: "Alice" } }
app.post("/webhook", (req, res) => {
  try {
    if (!isValidSignature(req)) {
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }
    const evt = req.body || {};
    console.log("[Webhook]", new Date().toISOString(), JSON.stringify(evt));
    // TODO: store, forward, or trigger a bot message, etc.
    return res.json({ ok: true, received: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// ---- Serve UI ----
app.get("/health", (_, res) => res.json({ ok: true }));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});