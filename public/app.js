// ─── DOM refs ───
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

const agentLabel = document.getElementById("agentLabel");
const dumpsterBox = document.getElementById("dumpsterBox");
const dumpsterSize = document.getElementById("dumpsterSize");
const truckVerifyBox = document.getElementById("truckVerifyBox");
const truckSize = document.getElementById("truckSize");
const vendorClaim = document.getElementById("vendorClaim");
const referenceObject = document.getElementById("referenceObject");
const photoInput = document.getElementById("photoInput");
const markupArea = document.getElementById("markupArea");
const notesInput = document.getElementById("notesInput");
const estimateBtn = document.getElementById("estimateBtn");
const resetBtn = document.getElementById("resetBtn");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const resultArea = document.getElementById("resultArea");
const statsBar = document.getElementById("statsBar");
const historyList = document.getElementById("historyList");

let editors = []; // { file, img, canvas, ctx, mode, drawing, lastX, lastY }
let expandedHistoryId = null;
let lastEstimateId = null; // Track current estimate for refine

// ─── API helper ───
async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ─── Auth ───
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

pinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") loginBtn.click(); });

logoutBtn.onclick = async () => {
  try { await api("/api/logout", { method: "POST" }); } catch {}
  await checkAuth();
};

// ─── Navigation ───
function showScreen(name) {
  navEstimate.classList.toggle("active", name === "estimate");
  navHistory.classList.toggle("active", name === "history");
  estimateScreen.classList.toggle("hidden", name !== "estimate");
  historyScreen.classList.toggle("hidden", name !== "history");
  if (name === "history") loadHistory();
}

navEstimate.onclick = () => showScreen("estimate");
navHistory.onclick = () => showScreen("history");

// ─── Job Type ───
function getJobType() {
  const r = document.querySelector("input[name='jobType']:checked");
  return r ? r.value : "STANDARD";
}

document.querySelectorAll("input[name='jobType']").forEach((el) => {
  el.addEventListener("change", () => {
    // Update radio card styling
    document.querySelectorAll(".radio-card").forEach((c) => c.classList.remove("selected"));
    el.closest(".radio-card").classList.add("selected");

    const jt = getJobType();
    dumpsterBox.classList.toggle("hidden", jt !== "DUMPSTER_CLEANOUT" && jt !== "DUMPSTER_OVERFLOW");
    truckVerifyBox.classList.toggle("hidden", jt !== "TRUCK_VERIFY");
  });
});

// ─── Photo Upload & Preview ───
photoInput.addEventListener("change", () => {
  rebuildPhotoPreviews();
});

function rebuildPhotoPreviews() {
  markupArea.innerHTML = "";
  editors = [];
  const files = photoInput.files ? Array.from(photoInput.files) : [];

  if (files.length > 0) {
    // Photo grid preview with remove buttons
    const grid = document.createElement("div");
    grid.className = "photo-grid";
    files.forEach((f, i) => {
      const thumb = document.createElement("div");
      thumb.className = "photo-thumb";
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      img.alt = f.name;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "photo-remove";
      removeBtn.textContent = "\u2715";
      removeBtn.onclick = () => removePhoto(i);
      thumb.append(img, removeBtn);
      grid.appendChild(thumb);
    });
    markupArea.appendChild(grid);

    const tip = document.createElement("div");
    tip.className = "markup-tip";
    tip.innerHTML = `<b>${files.length} photo${files.length > 1 ? "s" : ""} selected.</b> Expand below to draw markup (optional). Use <b style="color:#16a34a">green</b> = include, <b style="color:#dc2626">red</b> = exclude.`;
    markupArea.appendChild(tip);

    // Collapsible markup section
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "markup-toggle";
    toggle.textContent = "Show Markup Editor";
    const editorWrap = document.createElement("div");
    editorWrap.className = "markup-editors hidden";
    toggle.onclick = () => {
      const open = !editorWrap.classList.contains("hidden");
      editorWrap.classList.toggle("hidden", open);
      toggle.textContent = open ? "Show Markup Editor" : "Hide Markup Editor";
    };
    markupArea.appendChild(toggle);
    markupArea.appendChild(editorWrap);

    files.forEach((f, i) => editors.push(makeEditor(f, i, editorWrap)));
  }
  estimateBtn.disabled = files.length === 0;
}

function removePhoto(index) {
  const dt = new DataTransfer();
  const files = Array.from(photoInput.files);
  files.forEach((f, i) => { if (i !== index) dt.items.add(f); });
  photoInput.files = dt.files;
  rebuildPhotoPreviews();
}

function makeEditor(file, index, parentEl) {
  const card = document.createElement("div");
  card.className = "markup-card";

  // Top bar
  const top = document.createElement("div");
  top.className = "markup-top";
  top.innerHTML = `<span class="label">Photo ${index + 1}<span class="fname">${file.name || ""}</span></span>`;

  const btns = document.createElement("div");
  btns.className = "mode-btns";

  const greenBtn = document.createElement("button");
  greenBtn.type = "button";
  greenBtn.className = "mode-btn green active-green";
  greenBtn.textContent = "✓ Include";

  const redBtn = document.createElement("button");
  redBtn.type = "button";
  redBtn.className = "mode-btn red";
  redBtn.textContent = "✗ Exclude";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "mode-btn";
  clearBtn.textContent = "Clear";
  clearBtn.style.display = "none";

  btns.append(greenBtn, redBtn, clearBtn);
  top.appendChild(btns);

  // Canvas wrap
  const wrap = document.createElement("div");
  wrap.className = "canvas-wrap";

  const img = document.createElement("img");
  img.alt = `Photo ${index + 1}`;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  wrap.append(img, canvas);

  // Hint
  const hint = document.createElement("div");
  hint.className = "markup-hint";
  hint.textContent = "Draw on photo to mark items. Optional.";

  card.append(top, wrap, hint);
  (parentEl || markupArea).appendChild(card);

  const editor = { file, img, canvas, ctx, mode: "include", drawing: false, lastX: 0, lastY: 0, hasMarks: false };

  // Mode buttons
  function setMode(m) {
    editor.mode = m;
    greenBtn.className = m === "include" ? "mode-btn green active-green" : "mode-btn green";
    redBtn.className = m === "exclude" ? "mode-btn red active-red" : "mode-btn red";
  }

  greenBtn.onclick = () => setMode("include");
  redBtn.onclick = () => setMode("exclude");
  clearBtn.onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    editor.hasMarks = false;
    clearBtn.style.display = "none";
    hint.textContent = "Draw on photo to mark items. Optional.";
  };

  // Load image
  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
  };
  img.src = URL.createObjectURL(file);

  // Drawing
  function getXY(ev) {
    const rect = canvas.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function start(ev) {
    ev.preventDefault();
    editor.drawing = true;
    const p = getXY(ev);
    editor.lastX = p.x;
    editor.lastY = p.y;
  }

  function move(ev) {
    if (!editor.drawing) return;
    ev.preventDefault();
    const p = getXY(ev);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(18, canvas.width * 0.02);
    ctx.strokeStyle = editor.mode === "include" ? "rgba(0,180,0,0.75)" : "rgba(220,0,0,0.75)";
    ctx.beginPath();
    ctx.moveTo(editor.lastX, editor.lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    editor.lastX = p.x;
    editor.lastY = p.y;
    editor.hasMarks = true;
    clearBtn.style.display = "";
    hint.textContent = "Markup applied";
  }

  function end() { editor.drawing = false; }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", (e) => { e.preventDefault(); end(); }, { passive: false });

  return editor;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// ─── Estimate ───
estimateBtn.onclick = async () => {
  const files = photoInput.files ? Array.from(photoInput.files) : [];
  if (!files.length) return;

  estimateBtn.disabled = true;
  resultPlaceholder.classList.add("hidden");
  resultArea.classList.remove("hidden");

  // Step 1 progress
  estimateBtn.innerHTML = `<span class="spinner"></span> Step 1: Analyzing photos...`;
  resultArea.innerHTML = `<div class="placeholder-box">
    <div class="step-progress">
      <div class="step-item active"><span class="spinner"></span> Step 1: AI analyzing ${files.length} photo${files.length > 1 ? "s" : ""}...</div>
      <div class="step-item pending">Step 2: Verifying scale & math...</div>
    </div>
    <p class="muted" style="margin-top:12px">This usually takes 15-40 seconds</p>
  </div>`;

  const jt = getJobType();
  const form = new FormData();
  form.append("job_type", jt);
  form.append("agent_label", agentLabel.value || "");
  form.append("notes", notesInput.value || "");
  form.append("reference_object", referenceObject.value || "");

  if (jt === "DUMPSTER_CLEANOUT" || jt === "DUMPSTER_OVERFLOW") {
    form.append("dumpster_size", dumpsterSize.value);
  }
  if (jt === "TRUCK_VERIFY") {
    form.append("truck_size", truckSize.value || "15");
    form.append("vendor_claim", vendorClaim.value || "");
  }

  for (const f of files) form.append("photos", f);

  for (let i = 0; i < editors.length; i++) {
    const ed = editors[i];
    const blob = await canvasToBlob(ed.canvas);
    form.append("overlays", blob, `overlay_${i + 1}.png`);
  }

  try {
    // Update progress to step 2 after a delay (the server handles both steps)
    const stepTimer = setTimeout(() => {
      estimateBtn.innerHTML = `<span class="spinner"></span> Step 2: Verifying...`;
      resultArea.innerHTML = `<div class="placeholder-box">
        <div class="step-progress">
          <div class="step-item done">Step 1: AI analysis complete</div>
          <div class="step-item active"><span class="spinner"></span> Step 2: Verifying scale & math...</div>
        </div>
        <p class="muted" style="margin-top:12px">Almost done...</p>
      </div>`;
    }, 12000);

    const data = await api("/api/estimate", { method: "POST", body: form });
    clearTimeout(stepTimer);
    lastEstimateId = data.id;
    renderResult(data.result, jt === "TRUCK_VERIFY" ? vendorClaim.value : null);
    resetBtn.classList.remove("hidden");
  } catch (e) {
    resultArea.innerHTML = `<div class="card"><p class="err">Error: ${e.message}</p><p class="muted mt-8">Check your API key and try again.</p></div>`;
  } finally {
    estimateBtn.disabled = false;
    estimateBtn.textContent = "Estimate Volume";
  }
};

// ─── Reset ───
resetBtn.onclick = () => {
  photoInput.value = "";
  markupArea.innerHTML = "";
  editors = [];
  notesInput.value = "";
  vendorClaim.value = "";
  referenceObject.value = "";
  resultPlaceholder.classList.remove("hidden");
  resultArea.classList.add("hidden");
  resultArea.innerHTML = "";
  resetBtn.classList.add("hidden");
  estimateBtn.disabled = true;
};

// ─── Render Result ───
function renderResult(r, vc) {
  const confClass = r.confidence === "High" ? "conf-high" : r.confidence === "Medium" ? "conf-medium" : "conf-low";

  let vendorHtml = "";
  if (vc) {
    const parsed = parseVendorClaim(vc);
    if (parsed > 0) {
      const diff = parsed - r.likely;
      const pctDiff = Math.abs(diff / parsed) * 100;
      const cls = pctDiff > 20 ? "mismatch" : "ok";
      const icon = pctDiff > 20 ? "⚠️ Vendor Claim Mismatch" : "✓ Vendor Claim Reasonable";
      const diffColor = diff > 0 ? "text-red" : "text-green";
      vendorHtml = `
        <div class="vendor-compare ${cls}">
          <strong>${icon}</strong>
          <div class="vendor-grid">
            <div><div class="vg-label">Your Estimate</div><div class="vg-value">${r.likely} CY</div></div>
            <div><div class="vg-label">Vendor Claims</div><div class="vg-value">${parsed} CY</div></div>
            <div><div class="vg-label">Difference</div><div class="vg-value ${diffColor}">${diff > 0 ? "+" : ""}${diff.toFixed(1)} CY (${pctDiff.toFixed(0)}%)</div></div>
          </div>
        </div>`;
    }
  }

  const items = (r.itemsIdentified || []).map((i) => `<span class="item-tag">${esc(i)}</span>`).join("");

  resultArea.innerHTML = `
    <div class="sticky">
      <div class="result-main">
        <div class="result-header">
          <div>
            <div class="result-label">Estimated Volume</div>
            <div class="result-volume">${r.low}–${r.high} <span class="unit">cubic yards</span></div>
            <div class="result-likely">Most likely: ${r.likely} CY</div>
          </div>
          <span class="confidence-badge ${confClass}">${r.confidence}</span>
        </div>
        <div class="result-truck">🚛 <strong>${esc(r.truckFraction)}</strong></div>
      </div>

      ${vendorHtml}

      ${renderCrossValidation(r.crossValidation)}

      ${items ? `<div class="detail-card"><div class="detail-label">Items Identified</div><div class="items-list">${items}</div></div>` : ""}

      <div class="detail-card">
        <div class="detail-label">Scale Reference</div>
        <div class="detail-text">${esc(r.scaleReference)}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">Measurement Reasoning</div>
        <div class="detail-text">${esc(r.reasoning)}</div>
      </div>

      ${r.notes ? `<div class="notes-card"><div class="detail-label">Notes</div><div class="detail-text">${esc(r.notes)}</div></div>` : ""}

      ${renderSelfReview(r.selfReview)}

      ${lastEstimateId ? `<button class="btn-outline full refine-btn" onclick="refineEstimate(${lastEstimateId})">Refine Estimate Again</button>` : ""}
    </div>`;
}

function renderSelfReview(sr) {
  if (!sr || !sr.ran) return "";
  if (sr.corrected) {
    return `<div class="detail-card" style="border-color:#c4b5fd;background:#f5f3ff">
      <div class="detail-label" style="color:#7c3aed">Self-Review (Step 2)</div>
      <div class="detail-text">Estimate was <strong>corrected</strong> during verification: ${sr.originalLikely} CY → ${sr.reviewedLikely} CY</div>
    </div>`;
  }
  return `<div class="detail-card" style="border-color:#86efac;background:#f0fdf4">
    <div class="detail-label" style="color:#16a34a">Self-Review (Step 2)</div>
    <div class="detail-text">Math and scale references verified — estimate confirmed.</div>
  </div>`;
}

window.refineEstimate = async function (id) {
  const btn = document.querySelector(".refine-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Refining...`;
  }

  try {
    const data = await api(`/api/estimate/${id}/refine`, { method: "POST" });
    lastEstimateId = id;
    renderResult(data.result, null);
  } catch (e) {
    alert(`Refine error: ${e.message}`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Refine Estimate Again";
    }
  }
};

function renderCrossValidation(cv) {
  if (!cv || cv.method === "failed") return "";

  if (cv.method === "single_model") {
    return `<div class="detail-card"><div class="detail-label">Models Used</div><div class="detail-text">Claude only${cv.note ? " — " + esc(cv.note) : ""}</div></div>`;
  }

  const agreeClass = cv.agreement === "STRONG" ? "conf-high" : cv.agreement === "MODERATE" ? "conf-medium" : "conf-low";
  const models = cv.modelsUsed || ["Claude", cv.gptEstimate != null ? "GPT" : null].filter(Boolean);

  const estimates = [];
  if (cv.claudeEstimate != null) estimates.push(`Claude: ${cv.claudeEstimate} CY`);
  if (cv.gptEstimate != null) estimates.push(`GPT-4o: ${cv.gptEstimate} CY`);
  if (cv.geminiEstimate != null) {
    let geminiLabel = "Gemini";
    if (cv.geminiModel) geminiLabel += ` (${cv.geminiModel.replace("gemini-", "")})`;
    estimates.push(`${geminiLabel}: ${cv.geminiEstimate} CY`);
  }

  let escalationHtml = "";
  if (cv.geminiEscalated && cv.geminiModel === "gemini-2.5-pro") {
    escalationHtml = `<div style="margin-top:6px;font-size:12px;color:#7c3aed">⬆ Flash was uncertain${cv.geminiEscalationReason ? " (" + esc(cv.geminiEscalationReason) + ")" : ""} — auto-escalated to Pro</div>`;
  } else if (cv.geminiModel === "gemini-2.5-flash") {
    escalationHtml = `<div style="margin-top:6px;font-size:12px;color:#059669">⚡ Flash was confident — Pro not needed</div>`;
  }

  return `
    <div class="detail-card">
      <div class="detail-label">Cross-Validation <span class="confidence-badge ${agreeClass}" style="font-size:11px;margin-left:8px">${cv.agreement}</span></div>
      <div class="detail-text">
        <strong>${models.length}-model validation</strong> — ${esc(cv.note)}<br>
        ${estimates.map((e) => `<span class="item-tag">${esc(e)}</span>`).join(" ")}
        ${escalationHtml}
      </div>
    </div>`;
}

function parseVendorClaim(vc) {
  if (!vc) return 0;
  const cyMatch = vc.match(/(\d+\.?\d*)\s*(cy|cubic yard|yard)/i);
  if (cyMatch) return parseFloat(cyMatch[1]);
  const fracMatch = vc.match(/(\d)\/(\d)\s*full/i);
  const truckMatch = vc.match(/(\d+)\s*(yard|cy)/i);
  if (fracMatch) {
    const base = truckMatch ? parseInt(truckMatch[1]) : parseInt(truckSize.value) || 15;
    return (parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * base;
  }
  return 0;
}

// ─── History ───
async function loadHistory() {
  try {
    const data = await api("/api/history?limit=100");
    const stats = await api("/api/stats").catch(() => ({ total: 0, calibrated: 0, avg_error: null }));

    renderStats(stats);
    renderHistory(data.estimates || []);
  } catch (e) {
    historyList.innerHTML = `<div class="card"><p class="err">Failed to load history: ${e.message}</p></div>`;
  }
}

function renderStats(s) {
  const errDisplay = s.avg_error != null ? `${parseFloat(s.avg_error).toFixed(0)}%` : "—";
  const errClass = s.avg_error != null && s.avg_error > 30 ? "text-red" : s.avg_error != null && s.avg_error > 15 ? "text-amber" : "text-green";

  statsBar.innerHTML = s.total > 0 ? `
    <div class="stats-bar">
      <div><div class="stat-num">${s.total}</div><div class="stat-label">Total Estimates</div></div>
      <div><div class="stat-num">${s.calibrated}</div><div class="stat-label">With Actual Volume</div></div>
      <div><div class="stat-num ${errClass}">${errDisplay}</div><div class="stat-label">Avg Error</div></div>
    </div>` : "";
}

function renderHistory(estimates) {
  if (!estimates.length) {
    historyList.innerHTML = `<div class="placeholder-box"><p><strong>No estimates yet</strong></p><p class="muted">Run your first estimate and it will appear here</p></div>`;
    return;
  }

  historyList.innerHTML = estimates.map((e) => {
    const dt = new Date(e.created_at);
    const date = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const confClass = e.confidence === "High" ? "conf-high" : e.confidence === "Medium" ? "conf-medium" : "conf-low";

    let actualBadge = "";
    if (e.actual_volume != null) {
      const err = Math.abs(parseFloat(e.likely_cy) - parseFloat(e.actual_volume)) / Math.max(parseFloat(e.actual_volume), 0.1) * 100;
      const cls = err <= 15 ? "conf-high" : err <= 30 ? "conf-medium" : "conf-low";
      actualBadge = `<span class="actual-badge ${cls}">Actual: ${e.actual_volume} CY (${err.toFixed(0)}% off)</span>`;
    }

    return `
      <div class="history-item" id="hist-${e.id}">
        <button class="history-summary" onclick="toggleHistory(${e.id})">
          <div class="hs-main">
            <div class="hs-top">
              <span class="hs-volume">${e.low_cy}–${e.high_cy} CY</span>
              <span class="confidence-badge ${confClass}">${e.confidence}</span>
              ${actualBadge}
            </div>
            <div class="hs-meta">${e.job_type} · ${e.photo_count} photo${e.photo_count !== 1 ? "s" : ""}${e.agent_label ? ` · ${esc(e.agent_label)}` : ""} · ${date} ${time}</div>
          </div>
          <svg class="hs-chevron ${expandedHistoryId === e.id ? "open" : ""}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="history-detail ${expandedHistoryId === e.id ? "" : "hidden"}" id="hist-detail-${e.id}">
          ${renderHistoryDetail(e)}
        </div>
      </div>`;
  }).join("");
}

function renderHistoryDetail(e) {
  let result;
  try { result = JSON.parse(e.result_json); } catch { result = {}; }

  const items = (result.itemsIdentified || []).map((i) => `<span class="item-tag">${esc(i)}</span>`).join("");

  return `
    ${renderCrossValidation(result.crossValidation)}
    ${items ? `<div class="detail-card"><div class="detail-label">Items Identified</div><div class="items-list">${items}</div></div>` : ""}
    ${result.scaleReference ? `<div class="detail-card"><div class="detail-label">Scale Reference</div><div class="detail-text">${esc(result.scaleReference)}</div></div>` : ""}
    ${result.reasoning ? `<div class="detail-card"><div class="detail-label">Reasoning</div><div class="detail-text">${esc(result.reasoning)}</div></div>` : ""}
    ${result.notes ? `<div class="notes-card"><div class="detail-label">Notes</div><div class="detail-text">${esc(result.notes)}</div></div>` : ""}
    <div class="actual-volume-row">
      <div class="field-label">Log Actual Volume (Calibration)</div>
      <div class="hint mb-16">After the job is done, log actual cubic yards to track accuracy.</div>
      <div class="av-input-row">
        <input type="number" step="0.5" min="0" placeholder="${e.actual_volume != null ? e.actual_volume : "e.g., 8.5"}" id="actual-input-${e.id}" />
        <button class="btn-sm" onclick="logActual(${e.id})">${e.actual_volume != null ? "Update" : "Log"}</button>
      </div>
    </div>`;
}

window.toggleHistory = function (id) {
  expandedHistoryId = expandedHistoryId === id ? null : id;
  loadHistory();
};

window.logActual = async function (id) {
  const input = document.getElementById(`actual-input-${id}`);
  const val = parseFloat(input?.value);
  if (isNaN(val) || val < 0) return alert("Enter a valid cubic yard number");

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

// ─── Utils ───
function esc(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

// ─── Init ───
checkAuth();
