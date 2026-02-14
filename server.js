// server.js — Production Backend (Render-ready)
// AI Payment Fraud Risk Lab Backend

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import Groq from "groq-sdk";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// 🔐 Groq Client Setup
// ===============================
if (!process.env.GROQ_API_KEY) {
  console.warn("⚠️ GROQ_API_KEY is not set in .env. AI analysis will fail.");
}
// 👇 ADD DEBUG LINE HERE
console.log("Loaded GROQ KEY:", process.env.GROQ_API_KEY ? "YES" : "NO");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ===============================
// 🗄️ MongoDB (Mongoose) Setup
// ===============================
const MONGODB_URI = process.env.MONGODB_URI;
let RiskEvent = null;

if (!MONGODB_URI) {
  console.warn(
    "⚠️ MONGODB_URI is not set in .env. Risk events will not be persisted.",
  );
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

  const riskEventSchema = new mongoose.Schema(
    {
      channel: String,
      actorRole: String,
      amountRaw: String,
      parsedAmount: Number,
      finalScore: Number,
      riskLevel: String,
      heuristics: Object,
      ai: Object,
    },
    { timestamps: true },
  );

  RiskEvent = mongoose.model("RiskEvent", riskEventSchema);
}

// ===============================
// ⚙️ Middleware
// ===============================
app.use(cors());
app.use(express.json());

// ===============================
// 🧠 Heuristic Analysis
// ===============================
function heuristicAnalysis(message = "", amountRaw = "") {
  const text = message.toLowerCase();

  const urgentPatterns = [
    "urgent",
    "immediately",
    "asap",
    "right now",
    "today",
    "within the hour",
    "cannot wait",
    "do not delay",
  ];

  const authorityPatterns = [
    "ceo",
    "cfo",
    "director",
    "vp",
    "vice president",
    "chairman",
    "board",
    "executive",
    "senior manager",
  ];

  const secrecyPatterns = [
    "confidential",
    "do not tell",
    "do not share",
    "keep this between us",
    "secret",
    "off the record",
  ];

  const paymentPatterns = [
    "wire transfer",
    "bank transfer",
    "account number",
    "routing number",
    "swift",
    "iban",
    "crypto",
    "bitcoin",
    "gift cards",
    "prepaid cards",
  ];

  const suspiciousMetaPatterns = [
    "new account",
    "change of bank details",
    "different account",
    "overdue invoice",
    "update beneficiary",
  ];

  const countMatches = (patterns) =>
    patterns.reduce((count, p) => (text.includes(p) ? count + 1 : count), 0);

  const urgencyHits = countMatches(urgentPatterns);
  const authorityHits = countMatches(authorityPatterns);
  const secrecyHits = countMatches(secrecyPatterns);
  const paymentHits = countMatches(paymentPatterns);
  const metaHits = countMatches(suspiciousMetaPatterns);

  // Safe amount parsing
  let parsedAmount = null;
  if (amountRaw) {
    const cleaned = String(amountRaw)
      .replace(/[^0-9.]/g, "")
      .trim();
    if (cleaned !== "") {
      const val = parseFloat(cleaned);
      if (!Number.isNaN(val)) parsedAmount = val;
    }
  }

  let amountScore = 0;
  if (parsedAmount !== null) {
    if (parsedAmount >= 100000) amountScore = 30;
    else if (parsedAmount >= 20000) amountScore = 20;
    else if (parsedAmount >= 5000) amountScore = 10;
  }

  let baseScore =
    urgencyHits * 8 +
    authorityHits * 10 +
    secrecyHits * 12 +
    paymentHits * 7 +
    metaHits * 9 +
    amountScore;

  if (baseScore > 100) baseScore = 100;

  return {
    urgencyHits,
    authorityHits,
    secrecyHits,
    paymentHits,
    metaHits,
    amount: parsedAmount,
    baseScore,
  };
}

// ===============================
// 🤖 Groq AI Analysis
// ===============================
async function aiAnalysis({ message, channel, actorRole, amount }) {
  const prompt = `
You are an AI fraud-detection assistant specializing in
deepfake-enabled payment fraud and BEC attacks.

Return ONLY valid JSON:

{
  "overall_risk_score": 0-100,
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "factor_scores": {
    "urgency": 0-100,
    "authority_impersonation": 0-100,
    "secrecy_or_bypass": 0-100,
    "unusual_payment_instructions": 0-100,
    "language_manipulation": 0-100
  },
  "key_indicators": [],
  "safe_handling_advice": [],
  "short_summary": ""
}

Message: """${message}"""
Channel: ${channel}
Role: ${actorRole}
Amount: ${amount}
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "You are a fraud risk scoring engine. Respond ONLY with JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  let raw = completion.choices?.[0]?.message?.content || "{}";

  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?/i, "").trim();
    raw = raw.replace(/```$/, "").trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    raw = raw.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(raw);
  } catch {
    console.error("❌ Failed to parse AI JSON:", raw);
    return null;
  }
}

// ===============================
// 📊 Analyze Route
// ===============================
app.post("/api/analyze", async (req, res) => {
  const { message, channel, actorRole, amount } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "Message text required" });
  }

  const heuristics = heuristicAnalysis(message, amount);
  let aiResult = null;

  try {
    aiResult = await aiAnalysis({
      message,
      channel,
      actorRole,
      amount,
    });
  } catch (err) {
    console.error("AI error:", err);
  }

  let finalScore = heuristics.baseScore;

  if (aiResult?.overall_risk_score) {
    finalScore = (heuristics.baseScore + aiResult.overall_risk_score) / 2;
  }

  if (finalScore > 100) finalScore = 100;

  let level = "LOW";
  if (finalScore >= 70) level = "HIGH";
  else if (finalScore >= 40) level = "MEDIUM";

  if (RiskEvent) {
    await RiskEvent.create({
      channel,
      actorRole,
      amountRaw: amount,
      parsedAmount: heuristics.amount,
      finalScore,
      riskLevel: level,
      heuristics,
      ai: aiResult,
    });
  }

  res.json({
    ok: true,
    finalScore,
    level,
    heuristics,
    ai: aiResult,
  });
});

// ===============================
// 📈 Events Summary
// ===============================
app.get("/api/events-summary", async (req, res) => {
  if (!RiskEvent) {
    return res.json({
      ok: false,
      error: "MongoDB not configured",
    });
  }

  const total = await RiskEvent.countDocuments();

  const byLevel = await RiskEvent.aggregate([
    { $group: { _id: "$riskLevel", count: { $sum: 1 } } },
  ]);

  res.json({ ok: true, total, byLevel });
});

// ===============================
// ❤️ Health Route
// ===============================
app.get("/", (req, res) => {
  res.send("AI Fraud Risk API running");
});

// ===============================
// 🚀 Start Server
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Deepfake Fraud Detector running on port ${PORT}`);
});
