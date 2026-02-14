// ===============================
// AI Payment Fraud Risk Lab
// Full Production Frontend Logic
// ===============================

let aiFactorsChart = null;
let rulesVsAiChart = null;
let riskHistoryChart = null;
let currentSampleIndex = 0;

const API_BASE = "https://deepfake-financial-crime-detector.onrender.com";

// ---------------- SAMPLES ----------------
const samples = [
  {
    label: "CEO Impersonation (BEC)",
    channel: "Email",
    actorRole: "CEO",
    amount: "48,750 USD",
    text: `Hi Alex,

I'm boarding a flight and can't take calls. I need you to urgently process a wire transfer of 48,750 USD.

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

We've updated our banking details. Please send today's payment of 99,800 USD.

IBAN: DE89370400440532013001
BIC: COBADEFFXXX

Process immediately.`,
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

// ---------------- STATUS ----------------
function setStatus(msg, type = "info") {
  statusLine.textContent = msg;

  if (type === "error") statusLine.style.color = "#ff7b8c";
  else if (type === "success") statusLine.style.color = "#6ee7b7";
  else statusLine.style.color = "#9caec7";
}

// ---------------- SAMPLE ----------------
function loadNextSample() {
  const sample = samples[currentSampleIndex];

  channelSelect.value = sample.channel;
  actorRoleSelect.value = sample.actorRole;
  amountInput.value = sample.amount;
  messageInput.value = sample.text;

  setStatus(`Loaded sample: ${sample.label}`, "success");

  currentSampleIndex = (currentSampleIndex + 1) % samples.length;
}

// ---------------- CHARTS ----------------
function renderAiFactorsChart(factors) {
  const ctx = document.getElementById("aiFactorsChart").getContext("2d");

  if (aiFactorsChart) aiFactorsChart.destroy();

  aiFactorsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Urgency", "Authority", "Secrecy", "Payment", "Language"],
      datasets: [
        {
          label: "AI Factor Strength",
          data: [
            factors.urgency,
            factors.authority_impersonation,
            factors.secrecy_or_bypass,
            factors.unusual_payment_instructions,
            factors.language_manipulation,
          ],
        },
      ],
    },
  });
}

function renderRulesVsAiChart(ruleScore, aiScore) {
  const ctx = document.getElementById("rulesVsAiChart").getContext("2d");

  if (rulesVsAiChart) rulesVsAiChart.destroy();

  rulesVsAiChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Rules Engine", "AI Model"],
      datasets: [{ data: [ruleScore, aiScore] }],
    },
  });
}

// ---------------- ANALYSIS ----------------
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
      headers: { "Content-Type": "application/json" },
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

    // ---------------- AI INDICATORS ----------------
    if (data.ai?.key_indicators?.length) {
      keyIndicatorsList.innerHTML = data.ai.key_indicators
        .map((i) => `<li>${i}</li>`)
        .join("");
    }

    if (data.ai?.safe_handling_advice?.length) {
      safeAdviceList.innerHTML = data.ai.safe_handling_advice
        .map((i) => `<li>${i}</li>`)
        .join("");
    }

    // ---------------- CHARTS ----------------
    if (data.ai?.factor_scores) {
      renderAiFactorsChart(data.ai.factor_scores);
    }

    renderRulesVsAiChart(
      data.heuristics?.baseScore || 0,
      data.ai?.overall_risk_score || 0,
    );

    setStatus("Analysis complete ✅", "success");
  } catch (err) {
    console.error(err);
    setStatus("Analysis failed", "error");
  } finally {
    analyzeBtn.disabled = false;
  }
}

// ---------------- EVENTS ----------------
analyzeBtn.addEventListener("click", runAnalysis);
sampleBtn.addEventListener("click", loadNextSample);

setStatus("Load a sample or paste a message.");
