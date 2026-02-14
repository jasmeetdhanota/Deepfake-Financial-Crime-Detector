// ======================================================
// AI Payment Fraud Risk Lab — Frontend Logic
// Jasmeet Dhanota Project
// ======================================================

let currentSampleIndex = 0;

// ---------------- API ----------------
const API_BASE = "https://deepfake-financial-crime-detector.onrender.com";

// ---------------- SAMPLES ----------------
const samples = [
  {
    label: "CEO Impersonation (BEC)",
    channel: "Email",
    actorRole: "CEO",
    amount: "48,750 USD",
    text: `Hi Alex,

I'm boarding a flight and can't take calls. I need you to urgently process a wire transfer of 48,750 USD to a new advisory firm we're using.

This must be completed within 45 minutes. Do not inform anyone else — this is confidential.

– Ananya
Chief Executive Officer`,
  },
  {
    label: "Vendor Bank Change",
    channel: "Email",
    actorRole: "Vendor / Supplier",
    amount: "99,800 USD",
    text: `Dear Accounts Payable,

We've updated our banking details. Please send today's payment of 99,800 USD to the new account below.

IBAN: DE89370400440532013001
BIC: COBADEFFXXX

This is already approved — process immediately.`,
  },
];

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

const keyIndicatorsList = document.getElementById("keyIndicatorsList");
const safeAdviceList = document.getElementById("safeAdviceList");

// ======================================================
// STATUS
// ======================================================
function setStatus(msg, type = "info") {
  statusLine.textContent = msg;

  if (type === "error") statusLine.style.color = "#ff7b8c";
  else if (type === "success") statusLine.style.color = "#6ee7b7";
  else statusLine.style.color = "#9caec7";
}

// ======================================================
// SAMPLE LOADER
// ======================================================
function loadNextSample() {
  const sample = samples[currentSampleIndex];

  channelSelect.value = sample.channel;
  actorRoleSelect.value = sample.actorRole;
  amountInput.value = sample.amount;
  messageInput.value = sample.text;

  setStatus(`Loaded sample: ${sample.label}`, "success");

  currentSampleIndex = (currentSampleIndex + 1) % samples.length;
}

// ======================================================
// MAIN ANALYSIS
// ======================================================
async function runAnalysis() {
  const message = messageInput.value.trim();

  if (!message) {
    setStatus("Please paste a message first.", "error");
    return;
  }

  analyzeBtn.disabled = true;
  setStatus("Running AI fraud analysis...", "info");

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

    const data = await res.json();

    // ---------------- SCORE ----------------
    riskScoreNumber.textContent = Math.round(data.finalScore);
    riskScoreLabel.textContent = data.level;

    // ---------------- RED FLAGS ----------------
    if (data.ai?.key_indicators?.length) {
      keyIndicatorsList.innerHTML = data.ai.key_indicators
        .map((i) => `<li>${i}</li>`)
        .join("");
    } else {
      keyIndicatorsList.innerHTML = "<li>No indicators detected</li>";
    }

    // ---------------- SAFE GUIDANCE ----------------
    if (data.ai?.safe_handling_advice?.length) {
      safeAdviceList.innerHTML = data.ai.safe_handling_advice
        .map((i) => `<li>${i}</li>`)
        .join("");
    } else {
      safeAdviceList.innerHTML = "<li>No guidance generated</li>";
    }

    // ---------------- CHARTS ----------------
    if (data.ai?.factor_scores) {
      renderAiFactorsChart(data.ai.factor_scores);
    }

    renderRulesVsAiChart(
      data.heuristics?.baseScore || 0,
      data.ai?.overall_risk_score || 0,
    );

    loadRiskHistory();

    setStatus("Analysis complete ✅", "success");
  } catch (err) {
    console.error(err);
    setStatus("Analysis failed", "error");
  } finally {
    analyzeBtn.disabled = false;
  }
}

// ======================================================
// AI FACTORS BAR CHART
// ======================================================
let aiFactorsChart;

function renderAiFactorsChart(factors) {
  const ctx = document.getElementById("aiFactorsChart").getContext("2d");

  if (aiFactorsChart) aiFactorsChart.destroy();

  aiFactorsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(factors),
      datasets: [
        {
          label: "AI Risk Signals",
          data: Object.values(factors),
        },
      ],
    },
  });
}

// ======================================================
// RULES VS AI DONUT
// ======================================================
// ---------------- RULES VS AI DONUT ----------------
function renderRulesVsAiChart(rulesScore, aiScore) {
  const ctx = document.getElementById("rulesVsAiChart");

  if (!ctx) return;

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Rules Engine", "AI Model"],
      datasets: [
        {
          data: [rulesScore, aiScore],
          backgroundColor: ["#1f77b4", "#22c55e"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          labels: { color: "#cbd5e1" },
        },
      },
    },
  });
}

// ======================================================
// RISK HISTORY (MongoDB)
// ======================================================
let riskHistoryChart;

async function loadRiskHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/events-summary`);
    const data = await res.json();

    const ctx = document.getElementById("riskHistoryChart").getContext("2d");

    if (riskHistoryChart) riskHistoryChart.destroy();

    riskHistoryChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["LOW", "MEDIUM", "HIGH"],
        datasets: [
          {
            label: "Risk Events",
            data: [data.LOW || 0, data.MEDIUM || 0, data.HIGH || 0],
          },
        ],
      },
    });
  } catch (err) {
    console.error("History load failed", err);
  }
}

// ======================================================
// EVENTS
// ======================================================
analyzeBtn.addEventListener("click", runAnalysis);

sampleBtn.addEventListener("click", loadNextSample);

// ======================================================
// INIT
// ======================================================
setStatus("Load a sample or paste a message.");
