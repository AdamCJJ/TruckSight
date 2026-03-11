const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const pinInput = document.getElementById("pinInput");
const loginBtn = document.getElementById("loginBtn");
const loginErr = document.getElementById("loginErr");
const logoutBtn = document.getElementById("logoutBtn");

const navEstimate = document.getElementById("navEstimate");
const navHistory = document.getElementById("navHistory");
const estimateScreen = document.getElementById("estimateScreen");
const historyScreen = document.getElementById("historyScreen");

const photoInput = document.getElementById("photoInput");
const dropZone = document.getElementById("dropZone");
const thumbStrip = document.getElementById("thumbStrip");

const agentLabel = document.getElementById("agentLabel");
const jobTypeSelect = document.getElementById("jobTypeSelect");
const dumpsterBox = document.getElementById("dumpsterBox");
const dumpsterSize = document.getElementById("dumpsterSize");
const truckVerifyBox = document.getElementById("truckVerifyBox");
const vendorClaimBox = document.getElementById("vendorClaimBox");
const truckSize = document.getElementById("truckSize");
const vendorClaim = document.getElementById("vendorClaim");
const referenceObject = document.getElementById("referenceObject");
const notesInput = document.getElementById("notesInput");

const estimateBtn = document.getElementById("estimateBtn");
const resetBtn = document.getElementById("resetBtn");

const resultPlaceholder = document.getElementById("resultPlaceholder");
const resultArea = document.getElementById("resultArea");
const statsBar = document.getElementById("statsBar");
const historyList = document.getElementById("historyList");

let selectedFiles = [];
let expandedHistoryId = null;

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function checkAuth() {
  try {
    await api("/api/ping");
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    return true;
  } catch {
    loginScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    return false;
  }
}

loginBtn.onclick = async () => {
  loginErr.textContent = "";
  try {
    await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinInput.value }),
    });
    pinInput.value = "";
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
  } catch (e) {
    loginErr.textContent = e.message;
  }
};

pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

logoutBtn.onclick = async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch {}
  await checkAuth();
};

function showScreen(name) {
  navEstimate.classList.toggle("active", name === "estimate");
  navHistory.classList.toggle("active", name === "history");
  estimateScreen.classList.toggle("hidden", name !== "estimate");
  historyScreen.classList.toggle("hidden", name !== "history");
  if (name === "history") loadHistory();
}

navEstimate.onclick = () => showScreen("estimate");
navHistory.onclick = () => showScreen("history");

function updateConditionalFields() {
  const jt = jobTypeSelect.value;
  dumpsterBox.classList.toggle("hidden", jt !== "DUMPSTER_CLEANOUT" && jt !== "DUMPSTER_OVERFLOW");
  const showTruck = jt === "TRUCK_VERIFY";
  truckVerifyBox.classList.toggle("hidden", !showTruck);
  vendorClaimBox.classList.toggle("hidden", !showTruck);
}

jobTypeSelect.addEventListener("change", updateConditionalFields);
updateConditionalFields();

function syncPhotoState() {
  estimateBtn.disabled = selectedFiles.length === 0;
  thumbStrip.classList.toggle("hidden", selectedFiles.length === 0);

  thumbStrip.innerHTML = selectedFiles
    .map((file, index) => {
      const url = URL.createObjectURL(file);
      return `
        <div class="thumb-card">
          <button type="button" class="thumb-remove" data-index="${index}">×</button>
          <img src="${url}" alt="${escapeHtml(file.name)}" />
          <div class="thumb-meta">${escapeHtml(file.name)}</div>
        </div>
      `;
    })
    .join("");

  thumbStrip.querySelectorAll(".thumb-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      selectedFiles.splice(index, 1);
      syncPhotoState();
    });
  });
}

function addFiles(files) {
  const incoming = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
  if (!incoming.length) return;

  const room = 12 - selectedFiles.length;
  selectedFiles = selectedFiles.concat(incoming.slice(0, room));
  syncPhotoState();
}

dropZone.addEventListener("click", () => photoInput.click());
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    photoInput.click();
  }
});

photoInput.addEventListener("change", () => {
  addFiles(photoInput.files);
  photoInput.value = "";
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (e) => {
  addFiles(e.dataTransfer.files);
});

function buildDisplayedType(result, selectedType) {
  if (result.detectedType) return result.detectedType;
  if (selectedType === "AUTO_DETECT") return "Auto detected";
  if (selectedType === "TRUCK_VERIFY") return "Verify truck load";
  if (selectedType === "DUMPSTER_CLEANOUT") return "Dumpster cleanout";
  if (selectedType === "DUMPSTER_OVERFLOW") return "Dumpster overflow";
  return "Standard junk removal";
}

function confidenceClass(conf) {
  if (conf === "High") return "badge-high";
  if (conf === "Medium") return "badge-medium";
  return "badge-low";
}

function renderResult(result, selectedType) {
  const detectedType = buildDisplayedType(result, selectedType);
  const managerReview =
    result.vendorReviewStatus === "manager_review" ||
    /manager review/i.test(result.notes || "") ||
    /manager review/i.test(result.reasoning || "");

  const items = (result.itemsIdentified || [])
    .map((item) => `<span class="item-tag">${escapeHtml(item)}</span>`)
    .join("");

  const truckFillHtml =
    result.truckBeforeFraction != null || result.truckAfterFraction != null || result.deltaFraction != null
      ? `
        <div class="detail-card">
          <div class="detail-label">Truck fill analysis</div>
          <div class="detail-text">
            ${
              result.truckBeforeFraction != null
                ? `Before fill: ${(result.truckBeforeFraction * 100).toFixed(0)}%<br>`
                : ""
            }
            ${
              result.truckAfterFraction != null
                ? `After fill: ${(result.truckAfterFraction * 100).toFixed(0)}%<br>`
                : ""
            }
            ${
              result.deltaFraction != null
                ? `Net added load: ${(result.deltaFraction * 100).toFixed(0)}%`
                : ""
            }
          </div>
        </div>
      `
      : "";

  resultArea.innerHTML = `
    <div class="result-card">
      <div class="result-top">
        <div>
          <div class="result-eyebrow">Estimated volume</div>
          <div class="result-volume">${escapeHtml(result.low)}–${escapeHtml(result.high)} <span class="result-unit">yd³</span></div>
          <div class="result-likely">Most likely: ${escapeHtml(result.likely)} cubic yards</div>
        </div>
        <span class="badge ${confidenceClass(result.confidence)}">${escapeHtml(result.confidence)}</span>
      </div>

      ${managerReview ? `<div class="review-flag">Manager review recommended</div>` : ""}

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Detected type</div>
          <div class="summary-value">${escapeHtml(detectedType)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Equivalent</div>
          <div class="summary-value">${escapeHtml(result.truckFraction || "Not available")}</div>
        </div>
      </div>

      ${
        items
          ? `
            <div class="detail-card">
              <div class="detail-label">Items identified</div>
              <div class="items-list">${items}</div>
            </div>
          `
          : ""
      }

      ${truckFillHtml}

      <div class="detail-card">
        <div class="detail-label">Scale reference</div>
        <div class="detail-text">${escapeHtml(result.scaleReference || "Visual scale cues from the photos")}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">Reasoning</div>
        <div class="detail-text">${escapeHtml(result.reasoning || "No reasoning returned.")}</div>
      </div>

      ${
        result.notes
          ? `
            <div class="notes-card">
              <div class="detail-label">Notes</div>
              <div class="detail-text">${escapeHtml(result.notes)}</div>
            </div>
          `
          : ""
      }
    </div>
  `;

  resultPlaceholder.classList.add("hidden");
  resultArea.classList.remove("hidden");
}

estimateBtn.onclick = async () => {
  if (!selectedFiles.length) return;

  estimateBtn.disabled = true;
  estimateBtn.innerHTML = `<span class="spinner"></span>Analyzing`;

  resultPlaceholder.classList.add("hidden");
  resultArea.classList.remove("hidden");
  resultArea.innerHTML = `
    <div class="result-card loading-card">
      <div>
        <div class="spinner"></div>
        <div><strong>Analyzing ${selectedFiles.length} photo${selectedFiles.length > 1 ? "s" : ""}...</strong></div>
        <div style="margin-top:6px;color:#64748b;">This usually takes 10 to 30 seconds</div>
      </div>
    </div>
  `;

  const selectedType = jobTypeSelect.value;
  const form = new FormData();
  form.append("job_type", selectedType);
  form.append("agent_label", agentLabel.value || "");
  form.append("notes", notesInput.value || "");
  form.append("reference_object", referenceObject.value || "");

  if (selectedType === "DUMPSTER_CLEANOUT" || selectedType === "DUMPSTER_OVERFLOW") {
    form.append("dumpster_size", dumpsterSize.value);
  }

  if (selectedType === "TRUCK_VERIFY") {
    form.append("truck_size", truckSize.value || "15");
    form.append("vendor_claim", vendorClaim.value || "");
  }

  selectedFiles.forEach((file) => form.append("photos", file));

  try {
    const data = await api("/api/estimate", {
      method: "POST",
      body: form,
    });
    renderResult(data.result, selectedType);
    resetBtn.classList.remove("hidden");
  } catch (e) {
    resultArea.innerHTML = `
      <div class="result-card">
        <div class="review-flag">Error: ${escapeHtml(e.message)}</div>
      </div>
    `;
  } finally {
    estimateBtn.disabled = false;
    estimateBtn.textContent = "Estimate Volume";
  }
};

resetBtn.onclick = () => {
  selectedFiles = [];
  syncPhotoState();
  agentLabel.value = "";
  jobTypeSelect.value = "AUTO_DETECT";
  dumpsterSize.value = "UNKNOWN";
  truckSize.value = "15";
  vendorClaim.value = "";
  referenceObject.value = "";
  notesInput.value = "";
  updateConditionalFields();

  resultArea.classList.add("hidden");
  resultArea.innerHTML = "";
  resultPlaceholder.classList.remove("hidden");
  resetBtn.classList.add("hidden");
};

async function loadHistory() {
  try {
    const data = await api("/api/history?limit=100");
    const stats = await api("/api/stats").catch(() => ({
      total: 0,
      calibrated: 0,
      avg_error: null,
    }));

    renderStats(stats);
    renderHistory(data.estimates || []);
  } catch (e) {
    historyList.innerHTML = `<div class="result-card">Failed to load history: ${escapeHtml(e.message)}</div>`;
  }
}

function renderStats(s) {
  const errDisplay = s.avg_error != null ? `${parseFloat(s.avg_error).toFixed(0)}%` : "—";
  const errClass =
    s.avg_error != null && s.avg_error > 30
      ? "text-red"
      : s.avg_error != null && s.avg_error > 15
        ? "text-amber"
        : "text-green";

  statsBar.innerHTML =
    s.total > 0
      ? `
        <div class="stats-bar">
          <div><div class="stat-num">${s.total}</div><div class="stat-label">Total estimates</div></div>
          <div><div class="stat-num">${s.calibrated}</div><div class="stat-label">With actual volume</div></div>
          <div><div class="stat-num ${errClass}">${errDisplay}</div><div class="stat-label">Avg error</div></div>
        </div>
      `
      : "";
}

function renderHistory(estimates) {
  if (!estimates.length) {
    historyList.innerHTML = `
      <div class="result-card">
        <div class="detail-text">No estimates yet.</div>
      </div>
    `;
    return;
  }

  historyList.innerHTML = estimates
    .map((e) => {
      const dt = new Date(e.created_at);
      const date = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const confClass =
        e.confidence === "High"
          ? "badge-high"
          : e.confidence === "Medium"
            ? "badge-medium"
            : "badge-low";

      let actualBadge = "";
      if (e.actual_volume != null) {
        const err =
          (Math.abs(parseFloat(e.likely_cy) - parseFloat(e.actual_volume)) /
            Math.max(parseFloat(e.actual_volume), 0.1)) *
          100;
        const cls = err <= 15 ? "badge-high" : err <= 30 ? "badge-medium" : "badge-low";
        actualBadge = `<span class="actual-badge ${cls}">Actual: ${escapeHtml(e.actual_volume)} yd³</span>`;
      }

      return `
        <div class="history-item">
          <button class="history-summary" onclick="toggleHistory(${e.id})">
            <div>
              <div class="hs-top">
                <span class="hs-volume">${escapeHtml(e.low_cy)}–${escapeHtml(e.high_cy)} yd³</span>
                <span class="badge ${confClass}">${escapeHtml(e.confidence)}</span>
                ${actualBadge}
              </div>
              <div class="hs-meta">
                ${escapeHtml(e.job_type)} · ${escapeHtml(e.photo_count)} photo${e.photo_count !== 1 ? "s" : ""}${e.agent_label ? ` · ${escapeHtml(e.agent_label)}` : ""} · ${date} ${time}
              </div>
            </div>
          </button>
          <div class="${expandedHistoryId === e.id ? "" : "hidden"} history-detail" id="hist-detail-${e.id}">
            ${renderHistoryDetail(e)}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderHistoryDetail(e) {
  let result = {};
  try {
    result = JSON.parse(e.result_json);
  } catch {}

  const items = (result.itemsIdentified || [])
    .map((item) => `<span class="item-tag">${escapeHtml(item)}</span>`)
    .join("");

  return `
    ${
      items
        ? `
          <div class="detail-card">
            <div class="detail-label">Items identified</div>
            <div class="items-list">${items}</div>
          </div>
        `
        : ""
    }
    ${
      result.scaleReference
        ? `
          <div class="detail-card">
            <div class="detail-label">Scale reference</div>
            <div class="detail-text">${escapeHtml(result.scaleReference)}</div>
          </div>
        `
        : ""
    }
    ${
      result.reasoning
        ? `
          <div class="detail-card">
            <div class="detail-label">Reasoning</div>
            <div class="detail-text">${escapeHtml(result.reasoning)}</div>
          </div>
        `
        : ""
    }
    ${
      result.notes
        ? `
          <div class="notes-card">
            <div class="detail-label">Notes</div>
            <div class="detail-text">${escapeHtml(result.notes)}</div>
          </div>
        `
        : ""
    }
    <div class="detail-card">
      <div class="detail-label">Log actual volume</div>
      <div class="detail-text" style="margin-bottom:10px;">Use this later to track estimator accuracy.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <input type="number" step="0.5" min="0" placeholder="${e.actual_volume != null ? e.actual_volume : "e.g. 8.5"}" id="actual-input-${e.id}" />
        <button class="btn btn-secondary" onclick="logActual(${e.id})">${e.actual_volume != null ? "Update" : "Log"}</button>
      </div>
    </div>
  `;
}

window.toggleHistory = function (id) {
  expandedHistoryId = expandedHistoryId === id ? null : id;
  loadHistory();
};

window.logActual = async function (id) {
  const input = document.getElementById(`actual-input-${id}`);
  const val = parseFloat(input?.value);
  if (isNaN(val) || val < 0) {
    alert("Enter a valid cubic yard number");
    return;
  }

  try {
    await api(`/api/history/${id}/actual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual_volume: val }),
    });
    loadHistory();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
};

function escapeHtml(value) {
  if (value == null) return "";
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

checkAuth();
