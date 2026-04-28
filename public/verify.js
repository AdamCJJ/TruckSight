// ═══════════════════════════════════════════════════
// TruckSight — Vendor Verification flow
// Photos arrive in any order; AI classifies each one.
// ═══════════════════════════════════════════════════

(function () {
  const $ = (id) => document.getElementById(id);

  const vendorId    = $("vfVendorId");
  const claimedCy   = $("vfClaimedCy");
  const equipType   = $("vfEquipmentType");
  const capOverride = $("vfCapacity");
  const scopeText   = $("vfScopeText");
  const notesEl     = $("vfNotes");
  const dropZone    = $("vfDropZone");
  const photoInput  = $("vfPhotoInput");
  const photoGrid   = $("vfPhotoGrid");
  const submitBtn   = $("vfSubmitBtn");
  const resetBtn    = $("vfResetBtn");
  const placeholder = $("vfPlaceholder");
  const resultArea  = $("vfResultArea");

  let photos = []; // { file, url }

  function refreshSubmitState() {
    const ok =
      vendorId.value.trim() &&
      parseFloat(claimedCy.value) > 0 &&
      photos.length > 0;
    submitBtn.disabled = !ok;
  }

  [vendorId, claimedCy].forEach((el) => el.addEventListener("input", refreshSubmitState));

  function renderGrid() {
    photoGrid.innerHTML = photos
      .map(
        (p, i) => `
        <div class="photo-thumb">
          <img src="${p.url}" alt="photo ${i + 1}" />
          <button class="photo-remove" data-idx="${i}" aria-label="Remove">×</button>
        </div>`
      )
      .join("");
    photoGrid.querySelectorAll(".photo-remove").forEach((btn) => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        URL.revokeObjectURL(photos[idx].url);
        photos.splice(idx, 1);
        renderGrid();
        refreshSubmitState();
      };
    });
  }

  function addFiles(files) {
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      photos.push({ file: f, url: URL.createObjectURL(f) });
    }
    renderGrid();
    refreshSubmitState();
  }

  photoInput.addEventListener("change", (e) => addFiles(e.target.files));
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    addFiles(e.dataTransfer.files);
  });

  // ─── Submission ───
  submitBtn.addEventListener("click", async () => {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span><span>Analyzing…</span>';
    placeholder.classList.add("hidden");
    resultArea.classList.remove("hidden");
    resultArea.innerHTML = `
      <div class="result-placeholder" style="padding:48px 24px;">
        <div class="placeholder-glow"><div class="spinner-large"></div></div>
        <h3>AI is verifying…</h3>
        <p class="text-secondary">Classifying photos, estimating from the loaded truck, cross-checking before/after.</p>
      </div>`;

    const fd = new FormData();
    fd.append("vendor_id", vendorId.value.trim());
    fd.append("vendor_claimed_cy", String(parseFloat(claimedCy.value)));
    fd.append("equipment_type", equipType.value);
    if (capOverride.value) fd.append("equipment_capacity_cy", String(parseFloat(capOverride.value)));
    if (scopeText.value.trim()) fd.append("scope_text", scopeText.value.trim());
    if (notesEl.value.trim()) fd.append("notes", notesEl.value.trim());
    photos.forEach((p) => fd.append("photos", p.file));

    try {
      const res = await fetch("/api/verify", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      renderResult(json.result);
    } catch (err) {
      resultArea.innerHTML = `
        <div class="form-card" style="border-color:#7f1d1d;">
          <h3 style="color:#fca5a5;margin:0 0 8px;">Verification failed</h3>
          <p class="text-secondary">${escapeHtml(err.message)}</p>
        </div>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg><span>Run Verification</span>';
      resetBtn.classList.remove("hidden");
    }
  });

  resetBtn.addEventListener("click", () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    photos = [];
    photoGrid.innerHTML = "";
    [vendorId, claimedCy, capOverride, scopeText, notesEl].forEach((el) => (el.value = ""));
    equipType.value = "UNKNOWN";
    resultArea.classList.add("hidden");
    resultArea.innerHTML = "";
    placeholder.classList.remove("hidden");
    resetBtn.classList.add("hidden");
    refreshSubmitState();
  });

  // ─── Result rendering ───
  function flagBadge(flag) {
    const map = {
      OK:       { color: "#16a34a", bg: "#052e1a", label: "✅ Within range" },
      ELEVATED: { color: "#fbbf24", bg: "#3a2a05", label: "⚠️ Elevated variance" },
      FLAG:     { color: "#fb923c", bg: "#3a1d05", label: "🚩 Flag for review" },
      ANOMALY:  { color: "#f87171", bg: "#3a0808", label: "🚨 Likely overbilling" },
    };
    const m = map[flag] || { color: "#94a3b8", bg: "#1e293b", label: flag || "Unknown" };
    return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:600;color:${m.color};background:${m.bg};">${m.label}</span>`;
  }

  function categoryColor(cat) {
    return {
      ADDRESS_VERIFICATION: "#64748b",
      EMPTY_TRUCK: "#0ea5e9",
      BEFORE_SCOPE: "#a855f7",
      DURING_WORK: "#eab308",
      AFTER_SCOPE: "#22c55e",
      LOADED_TRUCK: "#f59e0b",
      OTHER: "#475569",
    }[cat] || "#475569";
  }

  function renderResult(r) {
    if (!r) {
      resultArea.innerHTML = `<div class="form-card">No result returned.</div>`;
      return;
    }
    const c = r.consensus || {};
    const v = r.variance || {};
    const lt = r.loaded_truck_estimate || {};
    const dl = r.delta_estimate || {};
    const sc = r.scope_compliance || [];
    const pc = r.photo_classifications || [];
    const missing = r.missing_photos || [];

    const claimed = v.vendor_claimed_cy ?? parseFloat(claimedCy.value);
    const est = c.estimated_cy ?? v.estimated_cy ?? null;
    const variancePct = v.variance_pct;

    resultArea.innerHTML = `
      <div class="form-card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <div class="text-secondary" style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Verdict</div>
            <h2 style="margin:4px 0 0;font-size:22px;">${flagBadge(v.flag)}</h2>
          </div>
          <div style="text-align:right;">
            <div class="text-secondary" style="font-size:12px;">Recommended action</div>
            <div style="font-weight:600;">${escapeHtml(v.recommendation || "—")}</div>
          </div>
        </div>
      </div>

      <div class="form-card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:15px;">Volume comparison</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div>
            <div class="text-secondary" style="font-size:12px;">Vendor claim</div>
            <div style="font-size:24px;font-weight:700;">${claimed != null ? claimed.toFixed(1) : "—"} <span style="font-size:13px;color:#94a3b8;">CY</span></div>
          </div>
          <div>
            <div class="text-secondary" style="font-size:12px;">AI estimate</div>
            <div style="font-size:24px;font-weight:700;color:#f59e0b;">${est != null ? Number(est).toFixed(1) : "—"} <span style="font-size:13px;color:#94a3b8;">CY</span></div>
            <div class="text-muted" style="font-size:11px;">${c.low_cy != null ? `range ${Number(c.low_cy).toFixed(1)}–${Number(c.high_cy).toFixed(1)}` : ""}</div>
          </div>
          <div>
            <div class="text-secondary" style="font-size:12px;">Variance</div>
            <div style="font-size:24px;font-weight:700;color:${variancePct > 25 ? "#f87171" : variancePct > 15 ? "#fbbf24" : "#22c55e"};">${variancePct != null ? (variancePct > 0 ? "+" : "") + variancePct.toFixed(1) + "%" : "—"}</div>
            <div class="text-muted" style="font-size:11px;">Confidence: ${escapeHtml(c.confidence || "—")}</div>
          </div>
        </div>
      </div>

      ${missing.length > 0 ? `
      <div class="form-card" style="margin-bottom:16px;border-color:#7c2d12;">
        <h3 style="margin:0 0 8px;font-size:15px;color:#fb923c;">Missing photo categories</h3>
        <p class="text-secondary" style="margin:0 0 8px;">For best accuracy, request these from the vendor:</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${missing.map((m) => `<span style="padding:3px 9px;border-radius:6px;background:#1e293b;font-size:12px;">${m.replace(/_/g, " ")}</span>`).join("")}
        </div>
      </div>` : ""}

      <div class="form-card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 10px;font-size:15px;">Loaded truck estimate (primary)</h3>
        <div class="text-secondary" style="margin-bottom:8px;font-size:13px;">
          Truck: <b>${escapeHtml(lt.truck_identified || "not identified")}</b>
          ${lt.fill_pct != null ? ` · Fill: <b>${lt.fill_pct}%</b>` : ""}
          ${lt.packing_factor != null ? ` · Packing: <b>${lt.packing_factor}</b>` : ""}
          ${lt.heap_adjustment_cy ? ` · Heap: <b>+${lt.heap_adjustment_cy} CY</b>` : ""}
        </div>
        <details>
          <summary style="cursor:pointer;font-size:13px;color:#94a3b8;">Show reasoning</summary>
          <p style="white-space:pre-wrap;margin-top:8px;font-size:13px;">${escapeHtml(lt.reasoning || "—")}</p>
        </details>
      </div>

      <div class="form-card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 10px;font-size:15px;">Before/after delta (cross-check)</h3>
        <div class="text-secondary" style="margin-bottom:8px;font-size:13px;">
          ${dl.estimated_cy != null ? `Removed roughly <b>${Number(dl.estimated_cy).toFixed(1)} CY</b> (range ${dl.low_cy ?? "?"}–${dl.high_cy ?? "?"})` : "Insufficient before/after photos"}
        </div>
        <details>
          <summary style="cursor:pointer;font-size:13px;color:#94a3b8;">Show reasoning</summary>
          <p style="white-space:pre-wrap;margin-top:8px;font-size:13px;">${escapeHtml(dl.reasoning || "—")}</p>
        </details>
      </div>

      ${sc.length > 0 ? `
      <div class="form-card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 10px;font-size:15px;">Scope compliance</h3>
        <ul style="list-style:none;padding:0;margin:0;">
          ${sc.map((s) => {
            const icon = s.status === "complete" ? "✅" : s.status === "incomplete" ? "❌" : "❓";
            const color = s.status === "complete" ? "#22c55e" : s.status === "incomplete" ? "#f87171" : "#94a3b8";
            return `<li style="padding:8px 0;border-bottom:1px solid #1e293b;">
              <div style="color:${color};font-weight:600;">${icon} ${escapeHtml(s.item)}</div>
              <div class="text-secondary" style="font-size:12px;margin-top:2px;">${escapeHtml(s.evidence || "")}</div>
            </li>`;
          }).join("")}
        </ul>
      </div>` : ""}

      ${pc.length > 0 ? `
      <div class="form-card" style="margin-bottom:16px;">
        <h3 style="margin:0 0 10px;font-size:15px;">Photo classifications</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;">
          ${pc.map((p) => {
            const photo = photos[p.index];
            const url = photo ? photo.url : "";
            return `<div style="display:flex;flex-direction:column;gap:4px;">
              ${url ? `<img src="${url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;" alt=""/>` : ""}
              <span style="font-size:11px;font-weight:600;color:${categoryColor(p.category)};">${p.category.replace(/_/g, " ")}</span>
              <span class="text-muted" style="font-size:11px;line-height:1.3;">${escapeHtml(p.description || "")}</span>
            </div>`;
          }).join("")}
        </div>
      </div>` : ""}

      ${r.notes ? `<div class="form-card"><h3 style="margin:0 0 6px;font-size:14px;">Notes</h3><p style="margin:0;font-size:13px;">${escapeHtml(r.notes)}</p></div>` : ""}
    `;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
