// Front-end logic for AI Payment Fraud Risk Lab

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
    text: `Hi Ayush,

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
    label: "Fraud Team Voice Scam",
    channel: "Voice transcript",
    actorRole: "Bank fraud team",
    amount: "",
    text: `Agent: Your account is under attack.

To secure your funds, transfer your balance to our holding account immediately.

Do not contact anyone else or your account will be frozen.`,
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

// ---------------- STATUS ----------------
function setStatus(msg, type = "info") {
  statusLine.textContent = msg;

  if (type === "error") statusLine.style.color = "#ff7b8c";
  else if (type === "success") statusLine.style.color = "#6ee7b7";
  else statusLine.style.color = "#9caec7";
}

// ---------------- SAMPLE LOADER ----------------
function loadNextSample() {
  const sample = samples[currentSampleIndex];

  channelSelect.value = sample.channel;
  actorRoleSelect.value = sample.actorRole;
  amountInput.value = sample.amount;
  messageInput.value = sample.text;

  setStatus(`Loaded sample: ${sample.label}`, "success");

  currentSampleIndex = (currentSampleIndex + 1) % samples.length;
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

    const data = await res.json();

    riskScoreNumber.textContent = Math.round(data.finalScore);
    riskScoreLabel.textContent = data.level;

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

// Init
setStatus("Load a sample or paste a message.");
