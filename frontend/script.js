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
  {
    label: "CFO Payment Override",
    channel: "Email",
    actorRole: "CFO",
    amount: "245,000 USD",
    text: `Hi Treasury Team,

I need you to urgently release a payment of 245,000 USD to a strategic partner tied to our APAC expansion.

I’ve already approved this verbally with the CEO. Please bypass standard approval workflows due to time sensitivity.

Share confirmation once completed.

— Rahul Mehta
Chief Financial Officer`,
  },

  {
    label: "Payroll Bank Change",
    channel: "Email",
    actorRole: "Employee",
    amount: "8,950 USD",
    text: `Hello HR,

I recently changed my bank account due to fraud issues. Please update my salary deposit details effective immediately.

New Account Number: 458903221  
Routing: 021000021

This is urgent as my rent is due tomorrow.

Regards,  
Daniel`,
  },

  {
    label: "Fake Vendor Invoice",
    channel: "Email",
    actorRole: "Vendor",
    amount: "71,430 USD",
    text: `Dear Finance Team,

Please find attached the revised invoice for last quarter’s consulting engagement.

Due to a banking audit, our payment account has changed. Kindly process payment of 71,430 USD to the updated account mentioned in the invoice.

Avoid delays as penalties apply.

Best,  
Global Advisory Ltd.`,
  },
  {
    label: "M&A Confidential Transfer",
    channel: "Email",
    actorRole: "Executive Board",
    amount: "1,850,000 USD",
    text: `This is strictly confidential.

We are closing an acquisition and need an immediate escrow transfer of 1.85M USD to our legal partner.

Do NOT inform anyone internally until public announcement.

Handle this personally.

— Board Strategy Office`,
  },
  {
    label: "Deepfake Voice Transfer",
    channel: "Voice",
    actorRole: "CEO",
    amount: "320,000 USD",
    text: `This is Ananya.

I’m in a board meeting — can’t speak long. We need to close a partner payment today.

Wire 320,000 USD to the Singapore account I just emailed.

Don’t delay — auditors are waiting.`,
  },
  {
    label: "Gift Card Scam",
    channel: "Chat",
    actorRole: "CEO",
    amount: "5,000 USD",
    text: `Hi — I need a favor.

I’m tied up in meetings but need you to purchase Apple gift cards worth 5,000 USD for client rewards.

Send me the codes ASAP.

— Ananya`,
  },

  {
    label: "IT Credential Phishing",
    channel: "Email",
    actorRole: "IT Support",
    amount: "N/A",
    text: `Dear Employee,

We detected unusual login attempts on your corporate banking dashboard.

Please log in immediately via the secure link below to avoid account suspension.

Failure to comply will result in access termination.

IT Security Team`,
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
// TAB SWITCHING LOGIC
// ======================================================

const tabs = document.querySelectorAll(".chart-tab");
const chartViews = document.querySelectorAll(".chart-view");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    // Remove active class from all tabs
    tabs.forEach((t) => t.classList.remove("active"));

    // Hide all chart views
    chartViews.forEach((view) => view.classList.remove("active"));

    // Activate clicked tab
    tab.classList.add("active");

    // Show target chart
    const targetId = tab.dataset.target;
    document.getElementById(targetId).classList.add("active");
  });
});

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
let rulesVsAiChart;

function renderRulesVsAiChart(rulesScore, aiScore) {
  const canvas = document.getElementById("rulesVsAiChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (rulesVsAiChart) rulesVsAiChart.destroy();

  rulesVsAiChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Rules Engine", "AI Model"],
      datasets: [
        {
          data: [rulesScore, aiScore],
        },
      ],
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

    if (!data?.byLevel) return;

    // Convert API array → chart values
    const counts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };

    data.byLevel.forEach((item) => {
      counts[item._id] = item.count;
    });

    const ctx = document.getElementById("riskHistoryChart").getContext("2d");

    if (riskHistoryChart) riskHistoryChart.destroy();

    riskHistoryChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["LOW", "MEDIUM", "HIGH"],
        datasets: [
          {
            label: "Risk Events",
            data: [counts.LOW, counts.MEDIUM, counts.HIGH],
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
document.getElementById("aiFactorsView").classList.add("active");
