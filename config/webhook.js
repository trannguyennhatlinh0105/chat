export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const secret = process.env.WEBHOOK_SECRET || "";
  const body = req.body || {}; // Vercel tự parse JSON khi header Content-Type: application/json
  if (secret) {
    const crypto = await import("crypto");
    const payload = JSON.stringify(body);
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const sig = req.headers["x-webhook-signature"];
    if (sig !== expected) return res.status(401).json({ ok:false, error: "Invalid signature" });
  }

  console.log("[Webhook]", new Date().toISOString(), body);
  return res.json({ ok: true, received: true });
}
