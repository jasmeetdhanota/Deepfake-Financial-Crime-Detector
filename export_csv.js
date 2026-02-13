// export_csv.js
// Export RiskEvent documents from MongoDB to fraud_risk_history.csv

import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not set in .env – cannot export.");
  process.exit(1);
}

// --- RiskEvent schema (must match server.js) ---
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
  { timestamps: true }
);

const RiskEvent = mongoose.model("RiskEvent", riskEventSchema);

// --- Helper: CSV escape ---
function toCsvCell(value) {
  if (value === null || value === undefined) return '""';
  const s = String(value).replace(/"/g, '""');
  return `"${s}"`;
}

async function run() {
  try {
    console.log("🔌 Connecting to MongoDB…");
    await mongoose.connect(MONGODB_URI);

    const events = await RiskEvent.find()
      .sort({ createdAt: 1 })
      .lean();

    console.log(`📊 Found ${events.length} risk events`);

    const outputPath = path.join(__dirname, "fraud_risk_history.csv");

    // CSV header – ALWAYS write at least this one line
    const header = [
      "createdAt",
      "channel",
      "actorRole",
      "amountRaw",
      "parsedAmount",
      "finalScore",
      "riskLevel",
      "heur_urgencyHits",
      "heur_authorityHits",
      "heur_secrecyHits",
      "heur_paymentHits",
      "heur_metaHits",
      "ai_overall_risk_score",
      "ai_risk_level",
    ];

    const lines = [header.join(",")];

    for (const e of events) {
      const h = e.heuristics || {};
      const ai = e.ai || {};

      const row = [
        e.createdAt instanceof Date ? e.createdAt.toISOString() : "",
        e.channel || "",
        e.actorRole || "",
        e.amountRaw || "",
        e.parsedAmount ?? "",
        e.finalScore ?? "",
        e.riskLevel || "",
        h.urgencyHits ?? "",
        h.authorityHits ?? "",
        h.secrecyHits ?? "",
        h.paymentHits ?? "",
        h.metaHits ?? "",
        ai.overall_risk_score ?? "",
        ai.risk_level || "",
      ].map(toCsvCell);

      lines.push(row.join(","));
    }

    fs.writeFileSync(outputPath, lines.join("\n"), "utf8");

    console.log(
      `✅ Export complete: ${events.length} rows written to ${outputPath}`
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Export failed:", err);
    process.exit(1);
  }
}

run();
