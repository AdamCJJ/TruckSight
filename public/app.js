// ═══════════════════════════════════════════════════
// TruckSight — Client Application
// ═══════════════════════════════════════════════════

// ─── DOM Refs ───
const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const pinInput = document.getElementById("pinInput");
const loginBtn = document.getElementById("loginBtn");
const loginErr = document.getElementById("loginErr");
const logoutBtn = document.getElementById("logoutBtn");

const navEstimate = document.getElementById("navEstimate");
const navVerify = document.getElementById("navVerify");
const navHistory = document.getElementById("navHistory");
const estimateScreen = document.getElementById("estimateScreen");
const verifyScreen = document.getElementById("verifyScreen");
const historyScreen = document.getElementById("historyScreen");

const agentLabel = document.getElementById("agentLabel");
const jobType = document.getElementById("jobType");
const truckSize = document.getElementById("truckSize");
const notesInput = document.getElementById("notesInput");

const dropZone = document.getElementById("dropZone");
const photoInput = document.getElementById("photoInput");
const photoGrid = document.getElementById("photoGrid");
const markupSection = document.getElementById("markupSection");
const markupArea = document.getElementById("markupArea");

const estimateBtn = document.getElementById("estimateBtn");
const resetBtn = document.getElementById("resetBtn");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const resultArea = document.getElementById("resultArea");
const statsBar = document.getElementById("statsBar");
const historyList = document.getElementById("historyList");

// ─── State ───
let uploadedFiles = [];
let editors = [];
let expandedHistoryId = null;

// ─── API Helper ───
async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ═══════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════

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
  loginBtn.disabled = true;
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
  } finally {
    loginBtn.disabled = false;
  }
};

pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

logoutBtn.onclick = async () => {
  try { await api("/api/logout", { method: "POST" }); } catch {}
  await checkAuth();
};

// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════

function showScreen(name) {
  navEstimate.classList.toggle("active", name === "estimate");
  navVerify.classList.toggle("active", name === "verify");
  navHistory.classList.toggle("active", name === "history");
  estimateScreen.classList.toggle("hidden", name !== "estimate");
  verifyScreen.classList.toggle("hidden", name !== "verify");
  historyScreen.classList.toggle("hidden", name !== "history");
  if (name === "history") loadHistory();
}

navEstimate.onclick = () => showScreen("estimate");
navVerify.onclick = () => showScreen("verify");
navHistory.onclick = () => showScreen("history");
// Expose for verify.js to use the same auth/screen helpers
window.__trucksight = { showScreen };

// ═══════════════════════════════════════════════════
// DRAG & DROP PHOTO UPLOAD
// ═══════════════════════════════════════════════════

dropZone.addEventListener("click", (e) => {
  if (e.target === photoInput) return;
  photoInput.click();
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});

photoInput.addEventListener("change", () => {
  handleFiles(photoInput.files);
  photoInput.value = "";
});

function handleFiles(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
  const remaining = 15 - uploadedFiles.length;
  if (remaining <= 0) return;
  const toAdd = files.slice(0, remaining);
  uploadedFiles.push(...toAdd);
  renderPhotoGrid();
  rebuildMarkupEditors();
  updateEstimateBtn();
}

function removePhoto(index) {
  uploadedFiles.splice(index, 1);
  renderPhotoGrid();
  rebuildMarkupEditors();
  updateEstimateBtn();
}

function renderPhotoGrid() {
  photoGrid.innerHTML = "";
  uploadedFiles.forEach((file, i) => {
    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = `Photo ${i + 1}`;

    const badge = document.createElement("span");
    badge.className = "photo-thumb-badge";
    badge.textContent = i + 1;

    const removeBtn = document.createElement("button");
    removeBtn.className = "photo-thumb-remove";
    removeBtn.innerHTML = "✕";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removePhoto(i);
    };

    thumb.append(img, badge, removeBtn);
    photoGrid.appendChild(thumb);
  });

  // File count
  const existing = photoGrid.querySelector(".file-count");
  if (existing) existing.remove();
  if (uploadedFiles.length > 0) {
    const count = document.createElement("div");
    count.className = "file-count";
    count.style.gridColumn = "1 / -1";
    count.textContent = `${uploadedFiles.length} photo${uploadedFiles.length !== 1 ? "s" : ""} attached`;
    photoGrid.appendChild(count);
  }
}

function updateEstimateBtn() {
  estimateBtn.disabled = uploadedFiles.length === 0;
}

// ═══════════════════════════════════════════════════
// PHOTO MARKUP EDITOR
// ═══════════════════════════════════════════════════

function rebuildMarkupEditors() {
  markupArea.innerHTML = "";
  editors = [];

  if (uploadedFiles.length === 0) {
    markupSection.classList.add("hidden");
    return;
  }

  markupSection.classList.remove("hidden");
  uploadedFiles.forEach((file, i) => {
    editors.push(createEditor(file, i));
  });
}

function createEditor(file, index) {
  const card = document.createElement("div");
  card.className = "markup-card animate-in";
  card.style.animationDelay = `${index * 0.05}s`;

  // ─── Toolbar ───
  const toolbar = document.createElement("div");
  toolbar.className = "markup-toolbar";

  const left = document.createElement("div");
  left.className = "toolbar-left";

  const label = document.createElement("span");
  label.className = "photo-label";
  label.textContent = `Photo ${index + 1}`;

  // Tool group
  const toolGroup = document.createElement("div");
  toolGroup.className = "tool-group";

  const brushBtn = makeToolBtn("Brush", true);
  const circleBtn = makeToolBtn("Circle", false);
  const pinBtn = makeToolBtn("Pin", false);

  toolGroup.append(brushBtn, circleBtn, pinBtn);

  // Brush size
  const brushSizeWrap = document.createElement("div");
  brushSizeWrap.className = "brush-size-wrap";
  const brushLabel = document.createElement("span");
  brushLabel.className = "brush-size-label";
  brushLabel.textContent = "Size";
  const brushSlider = document.createElement("input");
  brushSlider.type = "range";
  brushSlider.className = "brush-size-slider";
  brushSlider.min = "4";
  brushSlider.max = "40";
  brushSlider.value = "16";
  brushSizeWrap.append(brushLabel, brushSlider);

  left.append(label, toolGroup, brushSizeWrap);

  const right = document.createElement("div");
  right.className = "toolbar-right";

  // Mode group
  const modeGroup = document.createElement("div");
  modeGroup.className = "mode-group";

  const removeBtn = document.createElement("button");
  removeBtn.className = "mode-btn mode-remove active";
  removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Remove`;

  const keepBtn = document.createElement("button");
  keepBtn.className = "mode-btn mode-keep";
  keepBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Keep`;

  modeGroup.append(removeBtn, keepBtn);

  // Action group
  const actionGroup = document.createElement("div");
  actionGroup.className = "action-group";

  const undoBtn = document.createElement("button");
  undoBtn.className = "action-btn";
  undoBtn.title = "Undo";
  undoBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-8.36L1 10"/></svg>`;

  const clearBtn = document.createElement("button");
  clearBtn.className = "action-btn";
  clearBtn.title = "Clear all";
  clearBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;

  actionGroup.append(undoBtn, clearBtn);
  right.append(modeGroup, actionGroup);
  toolbar.append(left, right);

  // ─── Canvas ───
  const canvasContainer = document.createElement("div");
  canvasContainer.className = "canvas-container";

  const img = document.createElement("img");
  img.alt = `Photo ${index + 1}`;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvasContainer.append(img, canvas);

  // ─── Status bar ───
  const status = document.createElement("div");
  status.className = "markup-status";
  status.innerHTML = `<span>Draw on photo to mark items</span><span id="mark-count-${index}">0 marks</span>`;

  card.append(toolbar, canvasContainer, status);
  markupArea.appendChild(card);

  // ─── Editor state ───
  const editor = {
    file,
    img,
    canvas,
    ctx,
    tool: "brush",       // brush | circle | pin
    mode: "remove",      // remove | keep
    brushSize: 16,
    drawing: false,
    actions: [],         // undo stack
    currentAction: null,
    circleStart: null,
    pinCounter: 0,
    lastX: 0,
    lastY: 0,
  };

  // ─── Tool buttons ───
  function setTool(t) {
    editor.tool = t;
    brushBtn.classList.toggle("active", t === "brush");
    circleBtn.classList.toggle("active", t === "circle");
    pinBtn.classList.toggle("active", t === "pin");
    brushSizeWrap.style.display = t === "brush" ? "flex" : "none";
    canvas.className = t === "pin" ? "cursor-pin" : t === "circle" ? "cursor-circle" : "";
  }

  brushBtn.onclick = () => setTool("brush");
  circleBtn.onclick = () => setTool("circle");
  pinBtn.onclick = () => setTool("pin");

  brushSlider.oninput = () => { editor.brushSize = parseInt(brushSlider.value); };

  // ─── Mode buttons ───
  function setMode(m) {
    editor.mode = m;
    removeBtn.classList.toggle("active", m === "remove");
    keepBtn.classList.toggle("active", m === "keep");
  }

  removeBtn.onclick = () => setMode("remove");
  keepBtn.onclick = () => setMode("keep");

  // ─── Undo & Clear ───
  undoBtn.onclick = () => {
    if (editor.actions.length === 0) return;
    const removed = editor.actions.pop();
    if (removed.type === "pin") editor.pinCounter--;
    renderAllActions(editor);
    updateMarkCount(index, editor.actions.length);
  };

  clearBtn.onclick = () => {
    editor.actions = [];
    editor.pinCounter = 0;
    editor.ctx.clearRect(0, 0, editor.canvas.width, editor.canvas.height);
    updateMarkCount(index, 0);
  };

  // ─── Load image ───
  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
  };
  img.src = URL.createObjectURL(file);

  // ─── Drawing events ───
  function getXY(ev) {
    const rect = canvas.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function getColor(mode, alpha) {
    return mode === "remove"
      ? `rgba(34, 197, 94, ${alpha})`
      : `rgba(239, 68, 68, ${alpha})`;
  }

  function onStart(ev) {
    ev.preventDefault();
    const p = getXY(ev);

    if (editor.tool === "brush") {
      editor.drawing = true;
      editor.currentAction = { type: "brush", mode: editor.mode, size: editor.brushSize, points: [p] };
      editor.lastX = p.x;
      editor.lastY = p.y;
    } else if (editor.tool === "circle") {
      editor.drawing = true;
      editor.circleStart = p;
    } else if (editor.tool === "pin") {
      editor.pinCounter++;
      const action = { type: "pin", mode: editor.mode, x: p.x, y: p.y, label: String(editor.pinCounter) };
      editor.actions.push(action);
      renderAllActions(editor);
      updateMarkCount(index, editor.actions.length);
    }
  }

  function onMove(ev) {
    if (!editor.drawing) return;
    ev.preventDefault();
    const p = getXY(ev);

    if (editor.tool === "brush") {
      const action = editor.currentAction;
      action.points.push(p);
      // Draw just this segment
      const c = editor.ctx;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.lineWidth = Math.max(action.size, canvas.width * 0.008);
      c.strokeStyle = getColor(action.mode, 0.6);
      c.beginPath();
      c.moveTo(editor.lastX, editor.lastY);
      c.lineTo(p.x, p.y);
      c.stroke();
      editor.lastX = p.x;
      editor.lastY = p.y;
    } else if (editor.tool === "circle") {
      // Preview circle
      renderAllActions(editor);
      const c = editor.ctx;
      const s = editor.circleStart;
      const rx = Math.abs(p.x - s.x);
      const ry = Math.abs(p.y - s.y);
      const cx = (p.x + s.x) / 2;
      const cy = (p.y + s.y) / 2;
      c.beginPath();
      c.ellipse(cx, cy, rx / 2, ry / 2, 0, 0, Math.PI * 2);
      c.fillStyle = getColor(editor.mode, 0.15);
      c.fill();
      c.strokeStyle = getColor(editor.mode, 0.8);
      c.lineWidth = Math.max(4, canvas.width * 0.004);
      c.setLineDash([12, 6]);
      c.stroke();
      c.setLineDash([]);
    }
  }

  function onEnd(ev) {
    if (!editor.drawing) return;
    if (ev) ev.preventDefault();
    editor.drawing = false;

    if (editor.tool === "brush" && editor.currentAction) {
      editor.actions.push(editor.currentAction);
      editor.currentAction = null;
      updateMarkCount(index, editor.actions.length);
    } else if (editor.tool === "circle" && editor.circleStart) {
      const p = ev ? getXY(ev) : editor.circleStart;
      const s = editor.circleStart;
      const rx = Math.abs(p.x - s.x) / 2;
      const ry = Math.abs(p.y - s.y) / 2;
      if (rx > 5 && ry > 5) {
        const action = {
          type: "circle",
          mode: editor.mode,
          cx: (p.x + s.x) / 2,
          cy: (p.y + s.y) / 2,
          rx,
          ry,
        };
        editor.actions.push(action);
        updateMarkCount(index, editor.actions.length);
      }
      editor.circleStart = null;
      renderAllActions(editor);
    }
  }

  canvas.addEventListener("mousedown", onStart);
  canvas.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);
  canvas.addEventListener("touchstart", onStart, { passive: false });
  canvas.addEventListener("touchmove", onMove, { passive: false });
  canvas.addEventListener("touchend", onEnd, { passive: false });

  return editor;
}

function makeToolBtn(label, active) {
  const btn = document.createElement("button");
  btn.className = `tool-btn${active ? " active" : ""}`;
  const icons = {
    Brush: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    Circle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`,
    Pin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  };
  btn.innerHTML = `${icons[label] || ""} ${label}`;
  return btn;
}

function renderAllActions(editor) {
  const c = editor.ctx;
  c.clearRect(0, 0, editor.canvas.width, editor.canvas.height);

  for (const action of editor.actions) {
    if (action.type === "brush") {
      drawBrush(c, action, editor.canvas.width);
    } else if (action.type === "circle") {
      drawCircle(c, action, editor.canvas.width);
    } else if (action.type === "pin") {
      drawPin(c, action, editor.canvas.width);
    }
  }
}

function drawBrush(c, action, canvasWidth) {
  if (action.points.length < 2) return;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.lineWidth = Math.max(action.size, canvasWidth * 0.008);
  c.strokeStyle = action.mode === "remove" ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)";
  c.beginPath();
  c.moveTo(action.points[0].x, action.points[0].y);
  for (let i = 1; i < action.points.length; i++) {
    c.lineTo(action.points[i].x, action.points[i].y);
  }
  c.stroke();
}

function drawCircle(c, action, canvasWidth) {
  c.beginPath();
  c.ellipse(action.cx, action.cy, action.rx, action.ry, 0, 0, Math.PI * 2);
  c.fillStyle = action.mode === "remove" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
  c.fill();
  c.strokeStyle = action.mode === "remove" ? "rgba(34,197,94,0.8)" : "rgba(239,68,68,0.8)";
  c.lineWidth = Math.max(3, canvasWidth * 0.003);
  c.setLineDash([10, 5]);
  c.stroke();
  c.setLineDash([]);

  // Label
  const labelText = action.mode === "remove" ? "REMOVE" : "KEEP";
  const fontSize = Math.max(14, canvasWidth * 0.018);
  c.font = `bold ${fontSize}px Inter, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = action.mode === "remove" ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)";
  c.fillText(labelText, action.cx, action.cy);
}

function drawPin(c, action, canvasWidth) {
  const radius = Math.max(16, canvasWidth * 0.02);
  const color = action.mode === "remove" ? "#22c55e" : "#ef4444";
  const textColor = "#fff";

  // Drop shadow
  c.shadowColor = "rgba(0,0,0,0.4)";
  c.shadowBlur = 6;
  c.shadowOffsetX = 0;
  c.shadowOffsetY = 2;

  // Pin circle
  c.beginPath();
  c.arc(action.x, action.y, radius, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = "#fff";
  c.lineWidth = Math.max(2, canvasWidth * 0.002);
  c.stroke();

  // Reset shadow
  c.shadowColor = "transparent";
  c.shadowBlur = 0;

  // Number label
  const fontSize = Math.max(12, radius * 0.8);
  c.font = `bold ${fontSize}px Inter, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = textColor;
  c.fillText(action.label, action.x, action.y);
}

function updateMarkCount(index, count) {
  const el = document.getElementById(`mark-count-${index}`);
  if (el) el.textContent = `${count} mark${count !== 1 ? "s" : ""}`;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// ═══════════════════════════════════════════════════
// ESTIMATE
// ═══════════════════════════════════════════════════

estimateBtn.onclick = async () => {
  if (uploadedFiles.length === 0) return;

  estimateBtn.disabled = true;
  estimateBtn.innerHTML = `<span class="spinner"></span> Analyzing photos...`;
  resultPlaceholder.classList.add("hidden");
  resultArea.classList.remove("hidden");
  resultArea.innerHTML = `
    <div class="loading-card">
      <span class="spinner"></span>
      <p style="margin-top:8px"><strong>Analyzing ${uploadedFiles.length} photo${uploadedFiles.length > 1 ? "s" : ""}...</strong></p>
      <p class="text-secondary" style="margin-top:4px">This usually takes 10–30 seconds</p>
    </div>`;

  const form = new FormData();
  form.append("job_type", jobType.value);
  form.append("agent_label", agentLabel.value || "");
  form.append("notes", notesInput.value || "");
  form.append("truck_size", truckSize.value || "15");

  for (const f of uploadedFiles) form.append("photos", f);

  // Build markup descriptions for the AI
  const markupDescriptions = [];

  for (let i = 0; i < editors.length; i++) {
    const ed = editors[i];
    if (ed.actions.length === 0) continue;

    const blob = await canvasToBlob(ed.canvas);
    if (blob) {
      form.append("overlays", blob, `overlay_${i + 1}.png`);
      form.append("overlay_indexes", String(i));
    }

    // Build text description of pin placements
    const pins = ed.actions.filter((a) => a.type === "pin");
    if (pins.length > 0) {
      const desc = pins.map((p) => `Pin ${p.label}: ${p.mode === "remove" ? "REMOVE" : "KEEP"}`).join(", ");
      markupDescriptions.push(`Photo ${i + 1} pins: ${desc}`);
    }
  }

  if (markupDescriptions.length > 0) {
    form.append("markup_descriptions", markupDescriptions.join("; "));
  }

  try {
    const data = await api("/api/estimate", { method: "POST", body: form });
    renderResult(data.result);
    resetBtn.classList.remove("hidden");
  } catch (e) {
    resultArea.innerHTML = `
      <div class="detail-card">
        <p class="error-text">Error: ${esc(e.message)}</p>
        <p class="text-secondary mt-8">Check your API key and try again.</p>
      </div>`;
  } finally {
    estimateBtn.disabled = false;
    estimateBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <span>Calculate Estimate</span>`;
    updateEstimateBtn();
  }
};

// ─── Reset ───
resetBtn.onclick = () => {
  uploadedFiles = [];
  editors = [];
  notesInput.value = "";
  photoGrid.innerHTML = "";
  markupArea.innerHTML = "";
  markupSection.classList.add("hidden");
  resultPlaceholder.classList.remove("hidden");
  resultArea.classList.add("hidden");
  resultArea.innerHTML = "";
  resetBtn.classList.add("hidden");
  estimateBtn.disabled = true;
};

// ═══════════════════════════════════════════════════
// RENDER RESULT
// ═══════════════════════════════════════════════════

function renderResult(r) {
  const confClass = r.confidence === "High" ? "conf-high" : r.confidence === "Medium" ? "conf-medium" : "conf-low";
  const items = (r.itemsIdentified || []).map((i) => `<span class="item-tag">${esc(i)}</span>`).join("");

  let weightHtml = "";
  if (r.estimatedWeight) {
    weightHtml = `<div class="result-truck" style="margin-top:8px">⚖️ <strong>Estimated weight: ${esc(r.estimatedWeight)}</strong></div>`;
  }

  let densityHtml = "";
  if (r.loadDensity) {
    const di = r.loadDensity === "Very Heavy" ? "🔴" : r.loadDensity === "Heavy" ? "🟠" : r.loadDensity === "Medium" ? "🟡" : "🟢";
    densityHtml = `<div class="result-truck" style="margin-top:8px">${di} <strong>Load density: ${esc(r.loadDensity)}</strong></div>`;
  }

  let laborHtml = "";
  if (r.laborEstimate) {
    const li = r.laborEstimate === "Heavy" ? "💪" : r.laborEstimate === "Moderate" ? "🔧" : "✅";
    laborHtml = `<div class="result-truck" style="margin-top:8px">${li} <strong>Labor: ${esc(r.laborEstimate)}</strong>${r.laborReason ? " — " + esc(r.laborReason) : ""}</div>`;
  }

  let specialHtml = "";
  if (r.specialHandling && r.specialHandling.length > 0) {
    const flags = r.specialHandling.map((f) => `<span class="item-tag" style="background:rgba(239,68,68,0.15);color:#f87171;border-color:rgba(239,68,68,0.3)">⚠ ${esc(f)}</span>`).join("");
    specialHtml = `<div class="detail-card"><div class="detail-label">⚠️ Special Handling</div><div class="items-list">${flags}</div></div>`;
  }

  let hiddenHtml = "";
  if (r.hiddenVolume) {
    hiddenHtml = `<div class="detail-card" style="border-color:rgba(245,158,11,0.3)"><div class="detail-label" style="color:var(--accent)">🔍 Hidden / Inferred Volume</div><div class="detail-text">${esc(r.hiddenVolume)}</div></div>`;
  }

  let confReasonHtml = "";
  if (r.confidenceReason) {
    confReasonHtml = `<div style="font-size:0.8rem;margin-top:4px;opacity:0.7">${esc(r.confidenceReason)}</div>`;
  }

  resultArea.innerHTML = `
    <div class="results-sticky animate-in">
      <div class="result-hero">
        <div class="result-header">
          <div>
            <div class="result-label">Estimated Volume</div>
            <div class="result-volume">${r.low}–${r.high} <span class="unit">cubic yards</span></div>
            <div class="result-likely">Most likely: ${r.likely} CY</div>
          </div>
          <span class="confidence-badge ${confClass}">${r.confidence}</span>
        </div>
        ${confReasonHtml}
        <div class="result-truck">🚛 <strong>${esc(r.truckFraction)}</strong></div>
        ${weightHtml}
        ${densityHtml}
        ${laborHtml}
      </div>

      ${items ? `<div class="detail-card"><div class="detail-label">Items Identified</div><div class="items-list">${items}</div></div>` : ""}

      ${specialHtml}

      ${r.scene ? `<div class="detail-card"><div class="detail-label">📍 Scene</div><div class="detail-text">${esc(r.scene)}</div></div>` : ""}

      <div class="detail-card">
        <div class="detail-label">🔗 Scale Reference</div>
        <div class="detail-text">${esc(r.scaleReference)}</div>
      </div>

      <div class="detail-card">
        <div class="detail-label">🧮 Measurement Reasoning</div>
        <div class="detail-text">${esc(r.reasoning)}</div>
      </div>

      ${hiddenHtml}

      ${r.photoQuality ? `<div class="detail-card"><div class="detail-label">📸 Photo Quality</div><div class="detail-text">${esc(r.photoQuality)}</div></div>` : ""}

      ${r.overlapsIdentified ? `<div class="detail-card"><div class="detail-label">🔗 Photo Overlaps</div><div class="detail-text">${esc(r.overlapsIdentified)}</div></div>` : ""}

      ${r.notes ? `<div class="notes-card"><div class="detail-label">Notes</div><div class="detail-text">${esc(r.notes)}</div></div>` : ""}
    </div>`;
}

// ═══════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════

async function loadHistory() {
  try {
    const data = await api("/api/history?limit=100");
    const stats = await api("/api/stats").catch(() => ({ total: 0, calibrated: 0, avg_error: null }));
    renderStats(stats);
    renderHistory(data.estimates || []);
  } catch (e) {
    historyList.innerHTML = `<div class="detail-card"><p class="error-text">Failed to load history: ${esc(e.message)}</p></div>`;
  }
}

function renderStats(s) {
  const errDisplay = s.avg_error != null ? `${parseFloat(s.avg_error).toFixed(0)}%` : "—";
  const errClass = s.avg_error != null && s.avg_error > 30 ? "text-red" : s.avg_error != null && s.avg_error > 15 ? "text-amber" : "text-green";

  statsBar.innerHTML = s.total > 0 ? `
    <div class="stats-bar">
      <div class="stat-card"><div class="stat-num">${s.total}</div><div class="stat-label">Total Estimates</div></div>
      <div class="stat-card"><div class="stat-num">${s.calibrated}</div><div class="stat-label">With Actual Volume</div></div>
      <div class="stat-card"><div class="stat-num ${errClass}">${errDisplay}</div><div class="stat-label">Avg Error</div></div>
    </div>` : "";
}

function renderHistory(estimates) {
  if (!estimates.length) {
    historyList.innerHTML = `
      <div class="result-placeholder" style="min-height:200px">
        <h3>No estimates yet</h3>
        <p class="text-secondary">Run your first estimate and it will appear here</p>
      </div>`;
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
    ${items ? `<div class="detail-card"><div class="detail-label">Items Identified</div><div class="items-list">${items}</div></div>` : ""}
    ${result.scaleReference ? `<div class="detail-card"><div class="detail-label">Scale Reference</div><div class="detail-text">${esc(result.scaleReference)}</div></div>` : ""}
    ${result.reasoning ? `<div class="detail-card"><div class="detail-label">Reasoning</div><div class="detail-text">${esc(result.reasoning)}</div></div>` : ""}
    ${result.notes ? `<div class="notes-card"><div class="detail-label">Notes</div><div class="detail-text">${esc(result.notes)}</div></div>` : ""}
    <div class="actual-volume-row">
      <div class="form-label">Log Actual Volume (Calibration)</div>
      <p class="text-muted mb-16">After the job is done, log actual cubic yards to track accuracy.</p>
      <div class="av-input-row">
        <input type="number" step="0.5" min="0" class="form-input" placeholder="${e.actual_volume != null ? e.actual_volume : "e.g., 8.5"}" id="actual-input-${e.id}" />
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

// ═══════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════

function esc(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

// ─── Init ───
checkAuth();
