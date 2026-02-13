// server.js - Groq + MongoDB version (fixed JSON parsing & NaN)
// AI Payment Fraud Risk Lab Backend

import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

// --- Groq client ---
if (!process.env.GROQ_API_KEY) {
  console.warn("⚠️ GROQ_API_KEY is not set in .env. AI analysis will fail.");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// --- MongoDB (Mongoose) setup ---
const MONGODB_URI = process.env.MONGODB_URI;
let RiskEvent = null;

if (!MONGODB_URI) {
  console.warn(
    "⚠️ MONGODB_URI is not set in .env. Risk events will not be persisted."
  );
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("✅ Connected to MongoDB");
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err);
    });

  const riskEventSchema = new mongoose.Schema(
    {
      channel: String,
      actorRole: String,
      amountRaw: String,
      parsedAmount: Number, // can be null / undefined
      finalScore: Number,
      riskLevel: String,
      heuristics: Object,
      ai: Object,
    },
    { timestamps: true }
  );

  RiskEvent = mongoose.model("RiskEvent", riskEventSchema);
}

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Simple heuristic analysis (rule-based) ---
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

  // ✅ SAFE amount parsing: never NaN, use null when not present
  let parsedAmount = null;
  if (amountRaw !== undefined && amountRaw !== null) {
    const cleaned = String(amountRaw).replace(/[^0-9.]/g, "").trim();
    if (cleaned !== "") {
      const val = parseFloat(cleaned);
      if (!Number.isNaN(val)) {
        parsedAmount = val;
      }
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
    amount: parsedAmount, // always Number or null
    baseScore,
  };
}

// --- Groq-driven semantic analysis ---
async function aiAnalysis({ message, channel, actorRole, amount }) {
  const prompt = `
You are an AI fraud-detection assistant specializing in
deepfake-enabled payment fraud, business email compromise (BEC), and
social engineering in financial institutions.

You will be given a payment-related message and some context.
Your job is to assess the likelihood that this is a fraudulent or
social-engineering request.

Return ONLY a JSON object with this exact structure:

{
  "overall_risk_score": <number 0-100>,
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "factor_scores": {
    "urgency": <0-100>,
    "authority_impersonation": <0-100>,
    "secrecy_or_bypass": <0-100>,
    "unusual_payment_instructions": <0-100>,
    "language_manipulation": <0-100>
  },
  "key_indicators": [ "string", "string", ... ],
  "safe_handling_advice": [ "string", "string", ... ],
  "short_summary": "1-2 sentence human-readable explanation."
}

Be conservative: if there are multiple red flags,
"overall_risk_score" should be 70+ and "HIGH".

Message:
"""${message || ""}"""

Channel: ${channel || "unknown"}
Claimed sender role: ${actorRole || "unknown"}
Requested amount: ${amount || "not specified"}
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a precise, cautious fraud risk scoring engine for a bank. ALWAYS respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  let raw = completion.choices?.[0]?.message?.content || "{}";

  // --- CLEAN UP ANY MARKDOWN CODE FENCES OR EXTRA TEXT ---
  if (raw.startsWith("```")) {
    // Remove leading ``` or ```json
    raw = raw.replace(/^```(?:json)?/i, "").trim();
    // Remove trailing ```
    raw = raw.replace(/```$/, "").trim();
  }

  // Extra safety: keep only the JSON object between first '{' and last '}'
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    raw = raw.slice(firstBrace, lastBrace + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("❌ Failed to parse AI JSON after cleanup:", err);
    console.error("Cleaned AI output:", raw);
    parsed = null;
  }
  return parsed;
}

// --- Route: Analyze message ---
app.post("/api/analyze", async (req, res) => {
  const { message, channel, actorRole, amount } = req.body || {};

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: "Message text is required." });
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
    console.error("AI analysis error:", err);
  }

  let finalScore = heuristics.baseScore;

  if (aiResult && typeof aiResult.overall_risk_score === "number") {
    finalScore = (heuristics.baseScore + aiResult.overall_risk_score) / 2;
  }

  if (finalScore > 100) finalScore = 100;
  if (finalScore < 0) finalScore = 0;

  let level = "LOW";
  if (finalScore >= 70) level = "HIGH";
  else if (finalScore >= 40) level = "MEDIUM";

  // --- Persist to MongoDB (if configured) ---
  if (RiskEvent) {
    try {
      // avoid NaN in parsedAmount
      let parsedAmountForDb = null;
      if (
        typeof heuristics.amount === "number" &&
        !Number.isNaN(heuristics.amount)
      ) {
        parsedAmountForDb = heuristics.amount;
      }

      await RiskEvent.create({
        channel: channel || "unknown",
        actorRole: actorRole || "",
        amountRaw: amount || "",
        parsedAmount: parsedAmountForDb, // Number or null
        finalScore,
        riskLevel: level,
        heuristics,
        ai: aiResult,
      });
    } catch (err) {
      console.error("❌ Failed to persist risk event:", err);
    }
  }

  res.json({
    ok: true,
    finalScore,
    level,
    heuristics,
    ai: aiResult,
  });
});

// --- Route: stats / EDA summary for charts & Tableau ---
app.get("/api/events-summary", async (req, res) => {
  if (!RiskEvent) {
    return res.json({
      ok: false,
      error: "MongoDB not configured; no historical data.",
    });
  }

  try {
    const total = await RiskEvent.countDocuments();

    const byLevel = await RiskEvent.aggregate([
      {
        $group: {
          _id: "$riskLevel",
          count: { $sum: 1 },
        },
      },
    ]);

    const recent = await RiskEvent.find()
      .sort({ createdAt: -1 })
      .limit(30)
      .select("finalScore riskLevel parsedAmount createdAt")
      .lean();

    res.json({
      ok: true,
      total,
      byLevel,
      recent,
    });
  } catch (err) {
    console.error("❌ Failed to compute events summary:", err);
    res.status(500).json({ ok: false, error: "Failed to load stats" });
  }
});

// --- Fallback route (serve index.html) ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(
    `🚀 Deepfake Fraud Detector running on http://localhost:${PORT}`
  );
});
