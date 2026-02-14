// Front-end logic for AI Payment Fraud Risk Lab

let aiFactorsChart = null;
let rulesVsAiChart = null;
let riskHistoryChart = null;

// ===============================
// 🌐 BACKEND BASE URL (Render)
// ===============================
const API_BASE = "https://deepfake-financial-crime-detector.onrender.com";

// --- DOM references ---
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

// ===============================
// 📊 Status Utility
// ===============================
function setStatus(msg, type = "info") {
  statusLine.textContent = msg || "";

  if (type === "error") statusLine.style.color = "#ff7b8c";
  else if (type === "success") statusLine.style.color = "#6ee7b7";
  else statusLine.style.color = "#9caec7";
}

// ===============================
// 📌 Highlight Risky Phrases
// ===============================
function highlightMessage(text) {
  if (!text) return "";

  const patterns = [
    {
      regex:
        /\burgent|immediately|asap|right now|within the next|do not delay/gi,
      cls: "token-urgency",
    },
    {
      regex: /\bceo|cfo|director|vp|executive|finance director/gi,
      cls: "token-authority",
    },
    {
      regex: /\bconfidential|secret|do not share|keep this between us/gi,
      cls: "token-secrecy",
    },
    {
      regex:
        /\bwire transfer|bank transfer|iban|swift|crypto|bitcoin|account\b/gi,
      cls: "token-payment",
    },
  ];

  let html = text;

  patterns.forEach(({ regex, cls }) => {
    html = html.replace(regex, (m) => `<span class="${cls}">${m}</span>`);
  });

  return html;
}

// ===============================
// 📊 Charts
// ===============================
function initOrUpdateAiFactorsChart(factors) {
  const ctx = document.getElementById("aiFactorsChart").getContext("2d");

  const data = [
    factors?.urgency ?? 0,
    factors?.authority_impersonation ?? 0,
    factors?.secrecy_or_bypass ?? 0,
    factors?.unusual_payment_instructions ?? 0,
    factors?.language_manipulation ?? 0,
  ];

  if (aiFactorsChart) {
    aiFactorsChart.data.datasets[0].data = data;
    aiFactorsChart.update();
    return;
  }

  aiFactorsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Urgency", "Authority", "Secrecy", "Payment", "Language"],
      datasets: [{ label: "AI Risk Factors", data }],
    },
  });
}

// ===============================
// 📈 Risk History
// ===============================
async function refreshHistorySummary() {
  try {
    const res = await fetch(`${API_BASE}/api/events-summary`);
    const data = await res.json();

    if (!data.ok) return;

    const ctx = document.getElementById("riskHistoryChart").getContext("2d");

    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };

    data.byLevel.forEach((lvl) => {
      counts[lvl._id] = lvl.count;
    });

    if (riskHistoryChart) {
      riskHistoryChart.data.datasets[0].data = Object.values(counts);
      riskHistoryChart.update();
      return;
    }

    riskHistoryChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["LOW", "MEDIUM", "HIGH"],
        datasets: [
          {
            label: "Fraud Events",
            data: Object.values(counts),
          },
        ],
      },
    });
  } catch (err) {
    console.error("History load failed", err);
  }
}

// ===============================
// 🧠 Run Fraud Analysis
// ===============================
async function runAnalysis() {
  const message = messageInput.value;

  if (!message) {
    setStatus("Paste message first.", "error");
    return;
  }

  setStatus("Running fraud analysis…");

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        channel: channelSelect.value,
        actorRole: actorRoleSelect.value,
        amount: amountInput.value,
      }),
    });

    if (!res.ok) throw new Error("Analysis failed");

    const data = await res.json();

    // Score
    riskScoreNumber.textContent = Math.round(data.finalScore);
    riskScoreLabel.textContent = data.level;

    // Heuristics
    heuristicSummary.innerHTML = `
      <li>Urgency hits: ${data.heuristics.urgencyHits}</li>
      <li>Authority hits: ${data.heuristics.authorityHits}</li>
      <li>Secrecy hits: ${data.heuristics.secrecyHits}</li>
      <li>Payment hits: ${data.heuristics.paymentHits}</li>
    `;

    // AI Indicators
    keyIndicatorsList.innerHTML =
      data.ai?.key_indicators?.map((i) => `<li>${i}</li>`).join("") ||
      "<li>No data</li>";

    // Advice
    safeAdviceList.innerHTML =
      data.ai?.safe_handling_advice?.map((i) => `<li>${i}</li>`).join("") ||
      "<li>No data</li>";

    // Highlight text
    highlightedMessageDiv.innerHTML = highlightMessage(message);

    // Charts
    initOrUpdateAiFactorsChart(data.ai?.factor_scores);

    refreshHistorySummary();

    setStatus("Analysis complete", "success");
  } catch (err) {
    console.error(err);
    setStatus("Error running analysis", "error");
  }
}

// ===============================
// 🎛️ Event Listeners
// ===============================
analyzeBtn.addEventListener("click", runAnalysis);

// Initial state
setStatus("Paste a payment instruction or load a sample.");
refreshHistorySummary();
