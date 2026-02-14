// Front-end logic for AI Payment Fraud Risk Lab

let aiFactorsChart = null;
let rulesVsAiChart = null;
let riskHistoryChart = null;

// ---------------- DOM ----------------
const channelSelect = document.getElementById("channel");
const actorRoleSelect = document.getElementById("actorRole");
const amountInput = document.getElementById("amountInput");
const messageInput = document.getElementById("messageInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const sampleBtn = document.getElementById("sampleBtn");
const statusLine = document.getElementById("statusLine");

const riskScoreNumber = document.getElementById("riskScoreNumber");
const riskScoreLabel = document.getElementById("riskScoreLabel");
const riskScoreDescription = document.getElementById("riskScoreDescription");

const heuristicSummary = document.getElementById("heuristicSummary");
const keyIndicatorsList = document.getElementById("keyIndicatorsList");
const safeAdviceList = document.getElementById("safeAdviceList");
const highlightedMessageDiv = document.getElementById("highlightedMessage");

// 🔥 IMPORTANT — Backend base URL
const API_BASE = "https://deepfake-financial-crime-detector.onrender.com";

// ---------------- STATUS ----------------
function setStatus(msg, type = "info") {
  statusLine.textContent = msg || "";
  if (!msg) return;

  if (type === "error") statusLine.style.color = "#ff7b8c";
  else if (type === "success") statusLine.style.color = "#6ee7b7";
  else statusLine.style.color = "#9caec7";
}

// ---------------- HIGHLIGHT ----------------
function highlightMessage(text) {
  if (!text) return "";

  const patterns = [
    { r: /\burgent|immediately|asap|right now\b/gi, c: "token-urgency" },
    { r: /\bceo|cfo|director|vp|executive\b/gi, c: "token-authority" },
    { r: /\bconfidential|secret|do not share\b/gi, c: "token-secrecy" },
    {
      r: /\bwire|iban|swift|account|routing\b/gi,
      c: "token-payment",
    },
  ];

  let html = text;
  patterns.forEach(
    (p) => (html = html.replace(p.r, `<span class="${p.c}">$&</span>`)),
  );

  return html;
}

// ---------------- ANALYSIS ----------------
async function runAnalysis() {
  const message = messageInput.value.trim();

  if (!message) {
    setStatus("Please paste a message first.", "error");
    return;
  }

  analyzeBtn.disabled = true;
  setStatus("Running fraud analysis...", "info");

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        channel: channelSelect.value,
        actorRole: actorRoleSelect.value,
        amount: amountInput.value,
      }),
    });

    if (!res.ok) throw new Error("Analysis failed");

    const data = await res.json();

    const { finalScore, level, heuristics, ai } = data;

    // Score
    riskScoreNumber.textContent = Math.round(finalScore);
    riskScoreLabel.textContent = level;

    // Description
    riskScoreDescription.textContent =
      level === "HIGH"
        ? "High fraud risk detected."
        : level === "MEDIUM"
          ? "Moderate fraud indicators detected."
          : "Low fraud risk.";

    // Heuristics
    heuristicSummary.innerHTML = `
      <li>Score: ${Math.round(heuristics.baseScore)}/100</li>
      <li>Urgency: ${heuristics.urgencyHits}</li>
      <li>Authority: ${heuristics.authorityHits}</li>
      <li>Secrecy: ${heuristics.secrecyHits}</li>
      <li>Payment keywords: ${heuristics.paymentHits}</li>
    `;

    // AI indicators
    keyIndicatorsList.innerHTML =
      ai?.key_indicators?.map((x) => `<li>${x}</li>`).join("") ||
      "<li>No data</li>";

    safeAdviceList.innerHTML =
      ai?.safe_handling_advice?.map((x) => `<li>${x}</li>`).join("") ||
      "<li>No data</li>";

    highlightedMessageDiv.innerHTML = highlightMessage(message);

    setStatus("Analysis complete ✅", "success");
  } catch (err) {
    console.error(err);
    setStatus("Error: " + err.message, "error");
  } finally {
    analyzeBtn.disabled = false;
  }
}

// ---------------- HISTORY ----------------
async function refreshHistorySummary() {
  try {
    const res = await fetch(`${API_BASE}/api/events-summary`);

    const data = await res.json();

    console.log("History:", data);
  } catch (err) {
    console.error("History load failed", err);
  }
}

// ---------------- EVENTS ----------------
analyzeBtn.addEventListener("click", runAnalysis);

messageInput.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    runAnalysis();
  }
});

// Init
setStatus("Paste a payment instruction to begin.");
refreshHistorySummary();
