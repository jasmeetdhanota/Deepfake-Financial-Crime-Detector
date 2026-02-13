// Front-end logic for AI Payment Fraud Risk Lab

let aiFactorsChart = null;
let rulesVsAiChart = null;
let riskHistoryChart = null;

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

const chartTabs = document.querySelectorAll(".chart-tab");
const chartViews = document.querySelectorAll(".chart-view");

// --- Sample scenarios for demo ---
const samples = [
  {
    label: "CEO impersonation BEC email",
    channel: "Email",
    actorRole: "CEO",
    amount: "48,750 USD",
    text: `Hi Ayush,

I'm boarding a flight and can't take calls. I need you to urgently process a wire transfer of 48,750 USD to a new advisory firm we're using for the acquisition.

This has to be completed within the next 45 minutes or we risk delaying the deal. Use the bank details below and do not loop anyone else in on this — it's confidential until the announcement goes out.

Bank: Northshore Capital
Account: 938401992
Routing: 026009593

Reply once it's done.

– Ananya
Chief Executive Officer`,
  },
  {
    label: "Vendor bank details change (invoice fraud)",
    channel: "Email",
    actorRole: "Vendor / Supplier",
    amount: "99,800 USD",
    text: `Dear Accounts Payable,

Following an internal audit we've updated our banking arrangements. Please send today's payment of 99,800 USD to the new account below instead of the one on file.

NEW ACCOUNT DETAILS (EFFECTIVE IMMEDIATELY)
Bank: Continental Trust
IBAN: DE89 3704 0044 0532 0130 01
BIC: COBADEFFXXX

This has already been approved by our finance director, so there is no need for additional confirmation. To avoid delays, please process this today.

Kind regards,
Rohan
Finance Controller, Apex Components`,
  },
  {
    label: "Bank fraud team voice transcript (social engineering)",
    channel: "Voice transcript",
    actorRole: "Bank fraud team",
    amount: "unspecified",
    text: `Agent: This is the fraud and security team from your bank. Your account is under active attack. 
You must stay on the line and follow my instructions exactly or your funds will be frozen.

Agent: Right now someone is attempting to move money out of your account. To secure it, you need to transfer the full balance to a safe holding account that we control. 
Do NOT log out of your banking app and do NOT speak to any other representatives, that will trigger an automatic freeze.

Agent: Read me your current balance and then confirm when you are ready to transfer everything to the secure account number I provide.`,
  },
];

let currentSampleIndex = 0;

// --- Utility: set status text ---
function setStatus(msg, type = "info") {
  statusLine.textContent = msg || "";
  if (!msg) return;
  if (type === "error") {
    statusLine.style.color = "#ff7b8c";
  } else if (type === "success") {
    statusLine.style.color = "#6ee7b7";
  } else {
    statusLine.style.color = "#9caec7";
  }
}

// --- Utility: risk label text ---
function getRiskLabel(score) {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

// --- Utility: highlight risky phrases in message ---
function highlightMessage(originalText) {
  if (!originalText || !originalText.trim()) {
    return "Message highlights will appear here after you run an analysis.";
  }

  let html = originalText;

  const makeReplacer = (cls) => (match) =>
    `<span class="${cls}">${match}</span>`;

  const patterns = [
    // urgency
    {
      regex:
        /\burgent\b|\burgently\b|\bimmediately\b|\basap\b|\bright now\b|\bwithin the next\b|\bdo not delay\b/gi,
      cls: "token-urgency",
    },
    // authority
    {
      regex:
        /\bceo\b|\bcfo\b|\bchief executive\b|\bfinance director\b|\bvp\b|\bvice president\b|\bboard\b|\bexecutive\b/gi,
      cls: "token-authority",
    },
    // secrecy
    {
      regex:
        /\bconfidential\b|\bdo not tell\b|\bdo not share\b|\bkeep this between us\b|\bsecret\b|\boff the record\b/gi,
      cls: "token-secrecy",
    },
    // payment
    {
      regex:
        /\bwire transfer\b|\bbank transfer\b|\baccount\b|\brouting\b|\bswift\b|\biban\b|\bcrypto\b|\bbitcoin\b|\bgift cards?\b|\bprepaid\b|\bsafe account\b|\bholding account\b/gi,
      cls: "token-payment",
    },
  ];

  // To avoid overlapping replacements, work on a running string
  patterns.forEach(({ regex, cls }) => {
    html = html.replace(regex, makeReplacer(cls));
  });

  return html;
}

// --- Chart helpers ---
function initOrUpdateAiFactorsChart(factors) {
  const ctx = document.getElementById("aiFactorsChart").getContext("2d");
  const labels = [
    "Urgency",
    "Authority impersonation",
    "Secrecy / bypass",
    "Unusual payment instructions",
    "Language manipulation",
  ];
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
      labels,
      datasets: [
        {
          label: "AI factor strength (0–100)",
          data,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
        },
      },
    },
  });
}

function initOrUpdateRulesVsAiChart(heuristicScore, aiScore) {
  const ctx = document.getElementById("rulesVsAiChart").getContext("2d");
  const data = [heuristicScore ?? 0, aiScore ?? 0];

  if (rulesVsAiChart) {
    rulesVsAiChart.data.datasets[0].data = data;
    rulesVsAiChart.update();
    return;
  }

  rulesVsAiChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Rules engine (heuristics)", "AI model (Groq LLM)"],
      datasets: [
        {
          data,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "65%",
    },
  });
}

function initOrUpdateRiskHistoryChart(summary) {
  const ctx = document.getElementById("riskHistoryChart").getContext("2d");
  const levels = ["LOW", "MEDIUM", "HIGH"];
  const countsByLevel = { LOW: 0, MEDIUM: 0, HIGH: 0 };

  if (summary?.byLevel) {
    summary.byLevel.forEach((item) => {
      const key = item._id || "LOW";
      countsByLevel[key] = item.count || 0;
    });
  }

  const data = levels.map((lvl) => countsByLevel[lvl]);

  if (riskHistoryChart) {
    riskHistoryChart.data.datasets[0].data = data;
    riskHistoryChart.update();
    return;
  }

  riskHistoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: levels,
      datasets: [
        {
          label: "Number of events",
          data,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

// --- Load MongoDB summary for history chart ---
async function refreshHistorySummary() {
  try {
    const res = await fetch(
      "https://deepfake-fraud-api.onrender.com/api/events-summary",
    );
    const data = await res.json();
    if (!data.ok) {
      return;
    }
    initOrUpdateRiskHistoryChart(data);
  } catch (err) {
    console.error("Failed to load events summary", err);
  }
}

// --- Handle risk analysis ---
async function runAnalysis() {
  const message = messageInput.value;
  if (!message || !message.trim()) {
    setStatus("Please paste the message first.", "error");
    return;
  }

  const channel = channelSelect.value;
  const actorRole = actorRoleSelect.value;
  const amount = amountInput.value;

  analyzeBtn.disabled = true;
  sampleBtn.disabled = true;
  setStatus("Running AI-guided fraud analysis…", "info");

  try {
    const res = await fetch(
      "https://deepfake-fraud-api.onrender.com/api/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, channel, actorRole, amount }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Analysis failed");
    }

    const data = await res.json();
    const { finalScore, level, heuristics, ai } = data;

    // Update risk score
    riskScoreNumber.textContent =
      typeof finalScore === "number" ? Math.round(finalScore) : "--";
    riskScoreLabel.textContent =
      level === "HIGH" ? "HIGH" : level === "MEDIUM" ? "MEDIUM" : "LOW";

    if (level === "HIGH") {
      riskScoreDescription.textContent =
        "This message has multiple red flags indicating a potential business email compromise or social engineering attempt. Escalate and verify via a trusted channel.";
      riskScoreLabel.style.color = "#ff7b8c";
    } else if (level === "MEDIUM") {
      riskScoreDescription.textContent =
        "Some indicators of possible fraud; verify using a second factor and follow standard approval procedures.";
      riskScoreLabel.style.color = "#ffb347";
    } else {
      riskScoreDescription.textContent =
        "Low apparent risk, but always follow standard verification procedures.";
      riskScoreLabel.style.color = "#6ee7b7";
    }

    // Heuristics summary
    const h = heuristics || {};
    const listItems = [];
    listItems.push(`Heuristic score: ${Math.round(h.baseScore ?? 0)}/100`);
    listItems.push(`Urgency phrases detected: ${h.urgencyHits ?? 0}`);
    listItems.push(`Authority/role phrases detected: ${h.authorityHits ?? 0}`);
    listItems.push(`Secrecy / bypass instructions: ${h.secrecyHits ?? 0}`);
    listItems.push(
      `Payment-instruction keywords (wire/crypto/gift cards): ${
        h.paymentHits ?? 0
      }`,
    );
    if (h.amount != null && !Number.isNaN(h.amount)) {
      listItems.push(`Parsed requested amount ≈ ${h.amount.toLocaleString()}`);
    }

    heuristicSummary.innerHTML = listItems
      .map((txt) => `<li>${txt}</li>`)
      .join("");

    // Key AI indicators
    if (ai && Array.isArray(ai.key_indicators) && ai.key_indicators.length) {
      keyIndicatorsList.innerHTML = ai.key_indicators
        .map((txt) => `<li>${txt}</li>`)
        .join("");
    } else {
      keyIndicatorsList.innerHTML = "<li>No data.</li>";
    }

    // Safe handling advice
    if (
      ai &&
      Array.isArray(ai.safe_handling_advice) &&
      ai.safe_handling_advice.length
    ) {
      safeAdviceList.innerHTML = ai.safe_handling_advice
        .map((txt) => `<li>${txt}</li>`)
        .join("");
    } else {
      safeAdviceList.innerHTML = "<li>No data.</li>";
    }

    // Highlighted message (explainability)
    highlightedMessageDiv.innerHTML = highlightMessage(message);

    // Charts
    initOrUpdateAiFactorsChart(ai?.factor_scores || null);
    initOrUpdateRulesVsAiChart(
      Math.round(heuristics?.baseScore ?? 0),
      Math.round(ai?.overall_risk_score ?? 0),
    );

    // Refresh Mongo history
    refreshHistorySummary();

    setStatus(
      "Analysis complete. Risk signal blended from heuristics, Groq LLM, and MongoDB analytics.",
      "success",
    );
  } catch (err) {
    console.error(err);
    setStatus("Error: " + err.message, "error");
  } finally {
    analyzeBtn.disabled = false;
    sampleBtn.disabled = false;
  }
}

// --- Handle sample cycling ---
function loadNextSample() {
  const sample = samples[currentSampleIndex];
  channelSelect.value = sample.channel;
  actorRoleSelect.value = sample.actorRole;
  amountInput.value = sample.amount === "unspecified" ? "" : sample.amount;
  messageInput.value = sample.text;
  document.getElementById("inputHint").textContent =
    "Loaded sample: " + sample.label;

  currentSampleIndex = (currentSampleIndex + 1) % samples.length;
}

// --- Tabs handling ---
chartTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;

    chartTabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    chartViews.forEach((view) => {
      view.classList.toggle("active", view.id === target);
    });
  });
});

// --- Event listeners ---
analyzeBtn.addEventListener("click", runAnalysis);
sampleBtn.addEventListener("click", loadNextSample);

// Allow Cmd+Enter / Ctrl+Enter to trigger analysis from textarea
messageInput.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    runAnalysis();
  }
});

const cors = require("cors");
app.use(cors());

// Initial state
setStatus("Paste a payment instruction or load a sample to begin.", "info");
refreshHistorySummary();
