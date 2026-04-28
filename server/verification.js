import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiParseError } from "./gemini.js";

// Photo categories the AI should classify each uploaded image into.
// ADDRESS_VERIFICATION is a known vendor ritual photo (storefront/sign/door number)
// and is NOT required for the volume estimate, but is captured + tagged.
export const PHOTO_CATEGORIES = [
  "ADDRESS_VERIFICATION",  // storefront, address number, business sign — proves location
  "EMPTY_TRUCK",           // empty truck bed before loading
  "BEFORE_SCOPE",          // job site condition before work
  "DURING_WORK",           // mid-job, partial progress
  "AFTER_SCOPE",           // completed job site, scope fulfilled
  "LOADED_TRUCK",          // truck loaded with material — primary billing photo
  "OTHER",                 // anything else / unclear
];

// Photos required before a verification can produce a final variance number.
// Order doesn't matter — vendors send these out of order with delays.
const REQUIRED_FOR_VERIFICATION = ["LOADED_TRUCK"];
const RECOMMENDED_FOR_VERIFICATION = ["EMPTY_TRUCK", "BEFORE_SCOPE", "AFTER_SCOPE"];

const VERIFICATION_PROMPT = `You are TruckSight Verifier — an AI auditor for Jiffy Junk that reviews vendor billing for junk-removal jobs. Your job is to PROTECT THE COMPANY from vendor over-billing while being fair to honest vendors.

You receive a batch of photos sent by a vendor (they arrive out of order, often delayed 1–3 minutes apart). You also receive:
- The vendor's claimed cubic-yard volume
- The truck/equipment type (with capacity in CY) — sometimes blank, infer if so
- The job scope text from the client
- Any agent notes

You must do FOUR things in one pass:

═══════════════════════════════════════
TASK 1: CLASSIFY EACH PHOTO
═══════════════════════════════════════
For each photo (in the order received), assign exactly one category:
- ADDRESS_VERIFICATION — storefront, building, sign, address number, parking lot. Proves location only.
- EMPTY_TRUCK — empty or near-empty dump truck bed shown to prove a clean start.
- BEFORE_SCOPE — debris/overflow/junk on site BEFORE work has begun.
- DURING_WORK — partial cleanup in progress, some material removed.
- AFTER_SCOPE — site cleaned per scope, debris cleared.
- LOADED_TRUCK — truck filled with hauled material (the billing photo).
- OTHER — receipts, paperwork, unrelated images, faces/people, blurry shots.

For each photo, also record a short "what I see" description (max 25 words).

═══════════════════════════════════════
TASK 2: ESTIMATE VOLUME FROM THE LOADED TRUCK
═══════════════════════════════════════
This is your PRIMARY estimate. Use ONLY photos classified as LOADED_TRUCK.

Method:
1. Identify the truck/container. Common sizes:
   - 10 yd³ dump truck (~10' × 7.5' × 4')
   - 15 yd³ dump truck (~12' × 8' × 4') — STANDARD
   - 20 yd³ dump truck (~14' × 8' × 5')
   - 4 yd front-load dumpster (6' × 4.5' × 4.5')
   - 6 yd front-load dumpster (6' × 6' × 5')
   If equipment_capacity_cy was provided, USE THAT as ground truth.

2. Estimate fill level by side-wall reference:
   - Below 50% wall = under half
   - At 50% = half full
   - At 75% = three-quarters
   - At 100% (level with rails) = full to capacity
   - Heaping above rails = add 10–25% bonus volume depending on heap height

3. Apply packing factor:
   - Loose bags + boxes (typical commercial overflow) = 0.75–0.85 packing
   - Flat cardboard tightly packed = 0.95 packing
   - Furniture with voids = 0.65–0.75 packing

4. Compute: truck_capacity_cy × fill_pct × packing_factor + heap_adjustment = estimated CY

═══════════════════════════════════════
TASK 3: BEFORE/AFTER DELTA AS CROSS-CHECK
═══════════════════════════════════════
If BEFORE_SCOPE and AFTER_SCOPE photos exist, estimate how much was removed by reasoning about the change:
- What's gone in the after photo that was in the before photo?
- Footprint × pile height of removed material
- Express as a CY range

This is INDEPENDENT of the loaded-truck estimate. Use it to cross-check.

If the two estimates agree within 25% → high confidence.
If they disagree by more than 35% → low confidence, explain why.

═══════════════════════════════════════
TASK 4: SCOPE COMPLIANCE & VARIANCE
═══════════════════════════════════════
Scope compliance: read the scope text and check the AFTER_SCOPE photos.
- Did they complete each bullet of the scope?
- For each scope item: { item: "...", evidence: "what photo shows this", status: "complete" | "incomplete" | "no_evidence" }

Variance: compare your final consensus estimate to the vendor's claimed CY.
- variance_pct = (vendor_claimed_cy - estimated_cy) / estimated_cy × 100
- < 15% = ✅ within normal range
- 15–25% = ⚠️ elevated, watch this vendor
- > 25% = 🚩 flag for manager review
- > 50% = 🚨 likely over-billing

═══════════════════════════════════════
HONESTY RULES
═══════════════════════════════════════
- Do NOT inflate estimates to match the vendor's claim. Independence is the whole point.
- If you cannot estimate (no LOADED_TRUCK photo), set estimated_cy to null and explain.
- If photo quality is poor (blurry, dark, awkward angle), say so and widen the range.
- Vendors sometimes pile material to look bigger from one angle — note if you suspect this.
- Empty space and air gaps are NOT volume.

═══════════════════════════════════════
OUTPUT FORMAT — VALID JSON ONLY
═══════════════════════════════════════
{
  "photo_classifications": [
    { "index": 0, "category": "BEFORE_SCOPE", "description": "..." },
    { "index": 1, "category": "LOADED_TRUCK", "description": "..." }
  ],
  "loaded_truck_estimate": {
    "estimated_cy": <number or null>,
    "low_cy": <number or null>,
    "high_cy": <number or null>,
    "truck_identified": "string description of truck/container",
    "fill_pct": <number 0-120 or null>,
    "packing_factor": <number 0-1 or null>,
    "heap_adjustment_cy": <number or 0>,
    "reasoning": "step-by-step math"
  },
  "delta_estimate": {
    "estimated_cy": <number or null>,
    "low_cy": <number or null>,
    "high_cy": <number or null>,
    "reasoning": "what was removed and rough math, or 'insufficient photos'"
  },
  "consensus": {
    "estimated_cy": <number — your final number>,
    "low_cy": <number>,
    "high_cy": <number>,
    "confidence": "Low" | "Medium" | "High",
    "reason": "why this confidence level"
  },
  "scope_compliance": [
    { "item": "...", "evidence": "...", "status": "complete" | "incomplete" | "no_evidence" }
  ],
  "variance": {
    "vendor_claimed_cy": <number — pass through what was given>,
    "estimated_cy": <number — same as consensus>,
    "variance_pct": <number — positive means vendor over-claimed>,
    "flag": "OK" | "ELEVATED" | "FLAG" | "ANOMALY",
    "recommendation": "approve as-is" | "approve at adjusted CY" | "request more photos" | "manager review"
  },
  "missing_photos": ["LOADED_TRUCK", ...],
  "notes": "anything the human reviewer should know"
}`;

export async function verifyJob(params) {
  const {
    apiKey,
    photos,
    vendorClaimedCy,
    equipmentType,
    equipmentCapacityCy,
    scopeText,
    notes,
  } = params;

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: VERIFICATION_PROMPT,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const parts = [];

  let userText = `VERIFICATION REQUEST\n`;
  userText += `Vendor claimed: ${vendorClaimedCy ?? "not provided"} CY\n`;
  userText += `Equipment type: ${equipmentType || "not specified — please identify from photos"}\n`;
  userText += `Equipment capacity: ${equipmentCapacityCy ?? "not specified — infer from photos"} CY\n`;
  userText += `Job scope:\n${scopeText || "(not provided)"}\n`;
  if (notes) userText += `\nAgent notes: ${notes}\n`;
  userText += `\nPhotos attached: ${photos.length}. They may be out of order. Classify each one and run the full 4-task analysis.`;

  parts.push({ text: userText });

  for (let i = 0; i < photos.length; i++) {
    parts.push({ text: `--- PHOTO INDEX ${i} ---` });
    parts.push({
      inlineData: {
        data: photos[i].base64,
        mimeType: photos[i].mediaType || "image/jpeg",
      },
    });
  }

  console.log(`Sending ${photos.length} photo(s) to Gemini for verification (${modelName})...`);

  const result = await model.generateContent(parts);
  const text = result.response.text();
  if (!text) throw new GeminiParseError("Gemini returned an empty verification response");

  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse verification JSON:", cleaned.substring(0, 500));
    throw new GeminiParseError(`Verification JSON parse failed: ${err.message}`);
  }

  // Compute missing_photos server-side as a safety net
  const seenCategories = new Set((parsed.photo_classifications || []).map((p) => p.category));
  const missing = [...REQUIRED_FOR_VERIFICATION, ...RECOMMENDED_FOR_VERIFICATION].filter(
    (cat) => !seenCategories.has(cat)
  );
  parsed.missing_photos = missing;

  // If the model didn't compute variance but we have both numbers, fill it in
  if (vendorClaimedCy != null && parsed.consensus?.estimated_cy != null) {
    const claimed = Number(vendorClaimedCy);
    const est = Number(parsed.consensus.estimated_cy);
    if (est > 0) {
      const variancePct = Math.round(((claimed - est) / est) * 1000) / 10;
      parsed.variance = parsed.variance || {};
      parsed.variance.variance_pct = variancePct;
      parsed.variance.vendor_claimed_cy = claimed;
      parsed.variance.estimated_cy = est;
      if (!parsed.variance.flag) {
        parsed.variance.flag =
          variancePct > 50 ? "ANOMALY" :
          variancePct > 25 ? "FLAG" :
          variancePct > 15 ? "ELEVATED" : "OK";
      }
    }
  }

  return parsed;
}
