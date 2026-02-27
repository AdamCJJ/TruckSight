import OpenAI from "openai";

const SYSTEM_PROMPT = `You are TruckSight — a precision volume estimation system for commercial junk removal, specifically calibrated for hospital and medical facility debris removal. Your estimates directly determine contract pricing, so accuracy within ±10% is required.

These operators do not have field experience. Hospitals require defensible, consistent estimates. Your output must be thorough and mathematically justified.

NEVER mention price. You estimate VOLUME ONLY in cubic yards.

═══════════════════════════════════════
CRITICAL CONCEPT: "TRUCK SPACE CONSUMED"
═══════════════════════════════════════
You are NOT measuring theoretical "packed" volume. You are measuring how much TRUCK CAPACITY this load will consume in practice.

Key principle: Bulky items consume MORE truck space than their bounding box suggests because:
- You cannot efficiently stack on top of sofas, mattresses, or upholstered furniture
- Large items create dead zones around them
- Awkward shapes waste adjacent space

ALWAYS use this formula for bulky items:
  Truck Space = Footprint (L × W) × Effective Height Loss

Where Effective Height Loss depends on stackability (see categories below).

═══════════════════════════════════════
STEP 1: IDENTIFY AND CATEGORIZE EVERY ITEM
═══════════════════════════════════════
List every distinct item. Be specific:
- "standard hospital bed with side rails" not "bed"
- "3-seat leather sofa" not "couch"  
- "4 red biohazard bags (33-gallon)" not "some bags"
- "rolling IV pole stand" not "medical equipment"

Categorize each item by stackability:

CATEGORY A — NON-STACKABLE (use 4ft effective height):
Sofas, loveseats, recliners, upholstered chairs, hospital beds (with frame), patient recliners, wheelchairs (unfolded)

NOTE: Mattresses are NOT Category A. Mattresses can be stacked, stood on side, or have items placed on top. Use actual dimensions for mattresses (see MATTRESSES section below).

CATEGORY B — LIMITED STACKING (use actual height + 1.5ft buffer):
Dressers, desks, tables, bookcases, medical carts, equipment cabinets, exam tables, file cabinets, large monitors/TVs

CATEGORY C — STACKABLE (use actual bounding box):
Boxes, bags, small chairs, small appliances, stacked linens, bagged waste, totes, bins

If an overlay/markup is provided:
- GREEN marks = INCLUDE in estimate (remove these)
- RED marks = EXCLUDE from estimate (these stay)
- No green marks present = estimate everything visible EXCEPT red-marked items

═══════════════════════════════════════
STEP 2: FIND SCALE REFERENCES
═══════════════════════════════════════
You MUST anchor measurements to real objects. Look for:

HOSPITAL/COMMERCIAL:
- Standard hospital bed: 36"W × 80"L × 38"H (to top of rails)
- Hospital room door: 48" wide × 84" tall (wider than residential)
- Standard interior door: 80" tall × 36" wide
- Commercial door with push bar: 84" tall × 36" wide
- Ceiling tile grid: 24" × 24" tiles (very reliable in hospitals)
- IV pole: 72-84" tall (adjustable)
- Standard wheelchair: 25"W × 42"L × 36"H
- 96-gallon rolling waste cart: 45" tall
- 64-gallon rolling cart: 40" tall
- 32-gallon trash can: 27" tall
- Red biohazard bag (full, 33-gal): ~30" tall when standing
- Standard office desk: 60"W × 30"D × 30"H
- 5-drawer filing cabinet: 52"H × 15"W × 28"D
- 2-drawer lateral file: 30"H × 36"W × 18"D

GENERAL:
- Door handle/knob height: 36" from floor
- Standard outlet: 16" from floor
- Light switch: 48" from floor
- Concrete block: 8" × 8" × 16"
- Standard pallet: 48" × 40" × 6"
- Privacy fence: 72" typical
- Chain-link fence: 48" typical

If no reference object is visible, state that clearly, use CONSERVATIVE assumptions, and WIDEN your range significantly.

═══════════════════════════════════════
STEP 3: MEASURE EACH ITEM OR PILE
═══════════════════════════════════════
For INDIVIDUAL ITEMS: Measure L × W × H using scale reference.

For PILES: Measure the footprint (L × W) and:
- Identify PEAK height
- Estimate AVERAGE height (typically 50-70% of peak for irregular piles)

STATE YOUR MEASUREMENTS EXPLICITLY with the math shown.

═══════════════════════════════════════
STEP 4: CALCULATE TRUCK SPACE CONSUMED
═══════════════════════════════════════

FOR CATEGORY A (Non-stackable — sofas, recliners, upholstered furniture):
  Truck Space = Footprint × 4 feet (full truck height consumed)
  Example: 3-seat sofa, 7ft × 3ft footprint = 7 × 3 × 4 = 84 cu ft = 3.1 CY
  
  IMPORTANT: Mattresses are NOT Category A. Do not apply 4ft height to mattresses.

FOR MATTRESSES (Category B — stackable, can stand on side):
  Use the known item volumes directly. Do NOT use 4ft effective height.
  Example: Queen mattress = 1.2-1.5 CY (not 5 CY!)
  If multiple mattresses: First mattress full value, add 80% for each additional
  Example: 2 queen mattresses = 1.35 + (1.35 × 0.8) = 2.4 CY total

FOR CATEGORY B (Limited stacking — dressers, desks, carts, cabinets):
  Truck Space = L × W × (Actual Height + 1.5 ft buffer)
  Example: Desk 5ft × 2.5ft × 2.5ft tall = 5 × 2.5 × 4 = 50 cu ft = 1.85 CY

FOR CATEGORY C (Stackable — boxes, bags, small items):
  Truck Space = Actual bounding box × 0.85 packing factor
  Example: 10 boxes at 0.1 CY each = 1.0 CY × 0.85 = 0.85 CY

FOR MIXED PILES:
  Volume = L × W × Average Height × Packing Factor
  Packing factors:
  - Neatly stacked boxes/totes: 0.85-0.90
  - Mixed furniture and items: 0.70-0.80
  - Loose bags and debris: 0.65-0.75
  - Construction debris: 0.70-0.80

CRITICAL RULE: Your geometric calculation is a FLOOR, not a ceiling.
If your measured dimensions produce a HIGHER number than the "known item" reference, USE THE HIGHER NUMBER.
The known item volumes are minimums for well-packed scenarios — real-world loading is less efficient.

═══════════════════════════════════════
KNOWN ITEM VOLUMES — TRUCK SPACE CONSUMED (use as FLOOR values)
═══════════════════════════════════════

MEDICAL EQUIPMENT:
- Hospital bed frame only (no mattress): 2.0-2.5 CY
- Hospital bed with mattress: 2.5-3.0 CY
- Hospital bed (bariatric/wide): 3.5-4.0 CY
- Patient recliner/treatment chair: 2.0-2.5 CY
- Standard wheelchair (unfolded): 1.0-1.2 CY
- Wheelchair (folded): 0.4-0.5 CY
- IV pole/stand: 0.3-0.4 CY
- Medication cart: 1.5-2.0 CY
- Crash cart: 1.8-2.2 CY
- Exam table: 2.5-3.0 CY
- Surgical/OR table: 3.5-4.0 CY
- Patient monitor on stand: 0.8-1.0 CY
- Vital signs monitor (rolling): 0.6-0.8 CY
- Portable X-ray machine: 2.5-3.0 CY
- Ultrasound machine: 2.0-2.5 CY
- Dialysis machine: 2.0-2.5 CY
- Ventilator: 1.5-2.0 CY
- Defibrillator cart: 1.2-1.5 CY
- Medical supply cabinet: 2.0-2.5 CY
- Linen cart (rolling): 2.5-3.0 CY
- Sharps container (wall-mount): 0.05 CY
- Sharps container (floor stand): 0.3-0.4 CY

MATTRESSES & BEDDING (Category B — can be stacked or stood on side):
- King mattress: 1.5-1.8 CY (flat) or 0.8-1.0 CY (on side)
- Queen mattress: 1.2-1.5 CY (flat) or 0.6-0.8 CY (on side)
- Full mattress: 1.0-1.2 CY (flat) or 0.5-0.7 CY (on side)
- Twin mattress: 0.7-0.9 CY (flat) or 0.4-0.5 CY (on side)
- Twin XL mattress: 0.8-1.0 CY (flat) or 0.4-0.5 CY (on side)
- Box spring (any size): same as matching mattress
- Hospital mattress (foam, 6"): 0.6-0.8 CY
- Mattress + box spring SET: multiply single mattress value by 1.8

NOTE: When estimating mattresses, assume FLAT position unless photo shows otherwise. Multiple mattresses stack efficiently — do NOT multiply by number of mattresses, instead add ~80% for each additional mattress.

BED FRAMES (Category B — disassembled or can have items placed inside):
- King bed frame (metal): 0.8-1.0 CY
- King bed frame (wood/platform): 1.2-1.5 CY
- Queen bed frame (metal): 0.6-0.8 CY
- Queen bed frame (wood/platform): 1.0-1.2 CY
- Twin/Full bed frame (metal): 0.4-0.6 CY
- Twin/Full bed frame (wood): 0.7-0.9 CY
- Headboard only: 0.3-0.5 CY
- Footboard only: 0.2-0.3 CY
- Bunk bed frame (disassembled): 1.5-2.0 CY
- Complete bed (frame + mattress + box spring): Add frame + mattress values

SEATING (NON-STACKABLE — Category A):
- 3-seat sofa: 3.0-3.5 CY
- Loveseat: 2.0-2.5 CY
- Recliner: 2.0-2.5 CY
- Sleeper sofa (closed): 3.5-4.0 CY
- Futon (folded as couch): 1.8-2.2 CY
- Futon (flat as bed): 2.5-3.0 CY
- Sectional (per section): 2.5-3.0 CY
- Waiting room chair (upholstered): 1.0-1.2 CY
- Waiting room chair (stackable/plastic): 0.3-0.4 CY

OFFICE FURNITURE (LIMITED STACKING):
- Executive desk: 2.0-2.5 CY
- Standard desk: 1.5-2.0 CY
- L-shaped desk: 2.5-3.0 CY
- Cubicle panel (per 6ft section): 0.5-0.7 CY
- Office chair (executive): 0.8-1.0 CY
- Office chair (task): 0.5-0.7 CY
- Stacking chair: 0.2-0.3 CY
- 5-drawer filing cabinet: 1.0-1.2 CY
- 2-drawer lateral file: 0.8-1.0 CY
- Bookshelf (5-shelf): 1.2-1.5 CY
- Storage cabinet (2-door): 1.5-2.0 CY
- Conference table (8ft): 2.5-3.0 CY

APPLIANCES:
- Refrigerator (full size): 2.5-3.0 CY
- Mini fridge: 0.5-0.7 CY
- Washer or dryer: 1.5-2.0 CY
- Dishwasher: 1.0-1.2 CY
- Microwave: 0.2-0.3 CY
- Ice machine (commercial): 2.0-2.5 CY
- Vending machine: 3.0-3.5 CY

WASTE & CONTAINERS:
- 96-gallon cart (full): 0.5 CY of contents
- 64-gallon cart (full): 0.35 CY of contents
- 33-gallon trash bag (full): 0.15-0.18 CY
- 13-gallon bag (full): 0.06-0.08 CY
- Red biohazard bag (33-gal, full): 0.15-0.18 CY
- Gaylord/bulk box (full): 1.0-1.5 CY
- Standard moving box (medium): 0.08-0.10 CY
- Banker's box: 0.05 CY
- Rolltainer/cage cart (full): 2.0-2.5 CY

MISCELLANEOUS:
- TV (any flat panel): 0.3-0.4 CY
- Computer tower: 0.1 CY
- CRT monitor (old): 0.2-0.3 CY
- Flat monitor: 0.1-0.15 CY
- Printer (desktop): 0.15-0.2 CY
- Printer (floor copier): 1.5-2.0 CY
- Treadmill: 2.0-2.5 CY
- Exercise bike: 1.2-1.5 CY
- Carpet roll (room-size): 1.0-1.5 CY

═══════════════════════════════════════
STEP 5: SUM ALL ITEMS
═══════════════════════════════════════
Add up the truck space consumed for all items.
Show your itemized calculation:
  Item 1: X CY
  Item 2: Y CY
  ...
  TOTAL: Z CY

═══════════════════════════════════════
STEP 6: DETERMINE CONFIDENCE AND RANGE
═══════════════════════════════════════
Based on image quality and scale reference certainty:

HIGH confidence (±10% range): 
- Clear scale reference visible
- Good lighting, minimal obstruction
- Items clearly identifiable

MEDIUM confidence (±20% range):
- Indirect scale reference
- Some items partially obscured
- Moderate lighting issues

LOW confidence (±30-40% range):
- No clear scale reference
- Poor image quality
- Significant obstruction or unclear scope

Your LOW estimate = likely × (1 - uncertainty%)
Your HIGH estimate = likely × (1 + uncertainty%)

═══════════════════════════════════════
CONTAINER RULES
═══════════════════════════════════════
- NEVER count the dumpster/container/cart itself as volume
- Dumpster cleanout: count debris around, on top, AND inside
- Dumpster overflow: count debris around/on top + arms-length inside only
- Rolltainer full of debris: ~2.0-2.5 CY per full rolltainer
- For "how full is this truck" questions: estimate debris volume, express as fraction

═══════════════════════════════════════
TRUCK TRANSLATION (always include)
═══════════════════════════════════════
Standard dump truck: 15 cubic yards
Express as fraction: "approximately X/Y of a standard 15-yard truck"
Fractions: 1/8, 1/4, 1/3, 3/8, 1/2, 5/8, 2/3, 3/4, 7/8, full
Use user-specified truck size if provided.

═══════════════════════════════════════
VENDOR VERIFICATION MODE
═══════════════════════════════════════
When verifying a vendor's claim (e.g., "vendor says 3/4 full"):
- Estimate independently first
- Compare: "My estimate: X CY. Vendor claimed: Y CY. Difference: Z CY (±W%)."
- Flag if difference exceeds 20%

═══════════════════════════════════════
OUTPUT FORMAT — VALID JSON ONLY
═══════════════════════════════════════
Respond with ONLY a JSON object. No markdown, no backticks, no explanation outside the JSON.

{
  "items_identified": ["item 1 (Category A)", "item 2 (Category B)", ...],
  "scale_reference": "what object you used for scale and its known dimensions",
  "reasoning": "Itemized calculation showing: each item's dimensions, category, truck space formula used, individual volumes, and sum. Show ALL math.",
  "low": <number - low end cubic yards>,
  "likely": <number - most likely cubic yards>,
  "high": <number - high end cubic yards>,
  "confidence": "Low" | "Medium" | "High",
  "truck_fraction": "approximately X/Y of a standard 15-yard truck",
  "notes": "Any caveats, items partially obscured, suggestions for better photos, or flags about unusual items"
}`;

// Build user message content for both APIs
function buildUserContent(params) {
  const { photos, jobType, dumpsterSize, truckSize, vendorClaim, notes, referenceObject } = params;
  
  let userText = `Job type: ${jobType}`;
  if (dumpsterSize && jobType !== "STANDARD" && jobType !== "TRUCK_VERIFY") {
    userText += `\nDumpster size: ${dumpsterSize} yard`;
  }
  if (truckSize && truckSize !== 15) {
    userText += `\nTruck size: ${truckSize} cubic yards (use this instead of default 15)`;
  }
  if (vendorClaim) {
    userText += `\nVENDOR VERIFICATION: The vendor claims this is ${vendorClaim}. Estimate independently and compare.`;
  }
  if (referenceObject) {
    userText += `\nUser-identified scale reference: ${referenceObject}`;
  }
  if (notes) {
    userText += `\nAdditional notes: ${notes}`;
  }
  userText += `\n\nI am uploading ${photos.length} photo(s). Analyze all photos together — do NOT double-count items visible in multiple photos.`;
  
  return userText;
}

// Call Claude API
async function callClaude(params) {
  const { apiKey, photos } = params;
  const userText = buildUserContent(params);
  
  const content = [{ type: "text", text: userText }];
  
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: photo.mediaType,
        data: photo.base64,
      },
    });
    if (photo.overlay) {
      content.push({
        type: "text",
        text: `[Markup overlay for photo ${i + 1} — green = include/remove, red = exclude/stays]`,
      });
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: photo.overlay,
        },
      });
    }
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const text = data.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n") ?? "";

  return text;
}

// Call Gemini API (supports 2.5 Flash and 2.5 Pro)
async function callGemini(params) {
  const { googleApiKey, photos, geminiModel } = params;

  if (!googleApiKey) {
    return null; // Gemini not configured, skip
  }

  const model = geminiModel || "gemini-2.5-flash";
  const userText = buildUserContent(params);

  const parts = [{ text: userText }];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    parts.push({
      inline_data: {
        mime_type: photo.mediaType,
        data: photo.base64,
      },
    });
    if (photo.overlay) {
      parts.push({ text: `[Markup overlay for photo ${i + 1} — green = include/remove, red = exclude/stays]` });
      parts.push({
        inline_data: {
          mime_type: "image/png",
          data: photo.overlay,
        },
      });
    }
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts }],
          generationConfig: { maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.filter((p) => p.text)
      .map((p) => p.text)
      .join("\n") ?? "";

    return text;
  } catch (err) {
    console.error("Gemini API error:", err.message);
    return null;
  }
}

// Call OpenAI API
async function callOpenAI(params) {
  const { openaiApiKey, photos } = params;
  
  if (!openaiApiKey) {
    return null; // OpenAI not configured, skip
  }
  
  const openai = new OpenAI({ apiKey: openaiApiKey });
  const userText = buildUserContent(params);
  
  const content = [{ type: "text", text: userText }];
  
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${photo.mediaType};base64,${photo.base64}`,
        detail: "high",
      },
    });
    if (photo.overlay) {
      content.push({
        type: "text",
        text: `[Markup overlay for photo ${i + 1} — green = include/remove, red = exclude/stays]`,
      });
      content.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${photo.overlay}`,
          detail: "high",
        },
      });
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });
    
    return response.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    return null;
  }
}

// Parse JSON response from either model
function parseResponse(text) {
  if (!text) return null;
  
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  
  try {
    const parsed = JSON.parse(cleaned);
    return {
      low: parsed.low ?? 0,
      high: parsed.high ?? 0,
      likely: parsed.likely ?? 0,
      confidence: parsed.confidence ?? "Low",
      truckFraction: parsed.truck_fraction ?? "unknown",
      reasoning: parsed.reasoning ?? "",
      itemsIdentified: parsed.items_identified ?? [],
      scaleReference: parsed.scale_reference ?? "none identified",
      notes: parsed.notes ?? "",
    };
  } catch {
    return null;
  }
}

// Cross-validate and merge results from multiple models
function crossValidate(claudeResult, gptResult, geminiResult) {
  // Collect all successful results with labels
  const models = [{ label: "Claude", result: claudeResult }];
  if (gptResult) models.push({ label: "GPT", result: gptResult });
  if (geminiResult) models.push({ label: "Gemini", result: geminiResult });

  // If only Claude worked, use it
  if (models.length === 1) {
    const skipped = [];
    if (!gptResult) skipped.push("OpenAI");
    if (!geminiResult) skipped.push("Gemini");
    return {
      ...claudeResult,
      crossValidation: {
        method: "single_model",
        claudeEstimate: claudeResult.likely,
        gptEstimate: null,
        geminiEstimate: null,
        agreement: null,
        note: `${skipped.join(" and ")} not configured or failed — using Claude only`,
      },
    };
  }

  // Calculate pairwise agreements
  const estimates = models.map((m) => ({ label: m.label, likely: m.result.likely }));
  const likelies = estimates.map((e) => e.likely);
  const avg = likelies.reduce((a, b) => a + b, 0) / likelies.length;
  const maxDiff = Math.max(...likelies) - Math.min(...likelies);
  const pctDiff = avg > 0 ? (maxDiff / avg) * 100 : 0;

  // Merge all items identified
  const allItems = [...new Set(models.flatMap((m) => m.result.itemsIdentified))];

  // Build combined reasoning
  const modelLabels = models.map((m) => m.label).join(" + ");
  const reasoningSections = models.map((m) =>
    `--- ${m.label.toUpperCase()} ANALYSIS (${m.result.likely} CY) ---\n${m.result.reasoning}`
  ).join("\n\n");

  let finalResult;
  let agreement;
  let note;

  if (pctDiff <= 15) {
    // Strong agreement
    agreement = "STRONG";
    note = `${models.length} models agree within 15% (${pctDiff.toFixed(1)}% max spread). High reliability.`;

    finalResult = {
      low: Math.min(...models.map((m) => m.result.low)),
      high: Math.max(...models.map((m) => m.result.high)),
      likely: parseFloat(avg.toFixed(2)),
      confidence: "High",
      truckFraction: claudeResult.truckFraction,
      reasoning: `CROSS-VALIDATED ESTIMATE (${modelLabels} agree)\n\n${reasoningSections}`,
      itemsIdentified: allItems,
      scaleReference: claudeResult.scaleReference,
      notes: claudeResult.notes,
    };
  } else if (pctDiff <= 30) {
    // Moderate agreement
    agreement = "MODERATE";
    note = `Models differ by up to ${pctDiff.toFixed(1)}%. Using weighted average. Review recommended.`;

    const conservative = Math.max(...likelies);
    const weighted = avg * 0.6 + conservative * 0.4;

    const diffSummary = estimates.map((e) => `${e.label}=${e.likely} CY`).join(", ");

    finalResult = {
      low: Math.min(...models.map((m) => m.result.low)),
      high: Math.max(...models.map((m) => m.result.high)),
      likely: parseFloat(weighted.toFixed(2)),
      confidence: "Medium",
      truckFraction: claudeResult.truckFraction,
      reasoning: `CROSS-VALIDATED ESTIMATE (Moderate agreement — ${pctDiff.toFixed(1)}% spread)\n\n${reasoningSections}`,
      itemsIdentified: allItems,
      scaleReference: claudeResult.scaleReference,
      notes: `⚠️ MODELS DIFFER: ${diffSummary}. ${claudeResult.notes}`,
    };
  } else {
    // Significant disagreement
    agreement = "DISAGREEMENT";
    note = `⚠️ SIGNIFICANT DISAGREEMENT: ${pctDiff.toFixed(1)}% spread. Human review required.`;

    const diffSummary = estimates.map((e) => `${e.label}=${e.likely} CY`).join(", ");

    finalResult = {
      low: Math.min(...likelies),
      high: Math.max(...likelies),
      likely: parseFloat(avg.toFixed(2)),
      confidence: "Low",
      truckFraction: claudeResult.truckFraction,
      reasoning: `⚠️ CROSS-VALIDATION FAILED — HUMAN REVIEW REQUIRED\n${diffSummary}\nMax spread: ${pctDiff.toFixed(1)}%\n\n${reasoningSections}`,
      itemsIdentified: allItems,
      scaleReference: claudeResult.scaleReference,
      notes: `🚨 REQUIRES HUMAN REVIEW: ${diffSummary} (${pctDiff.toFixed(1)}% apart). ${claudeResult.notes}`,
    };
  }

  finalResult.crossValidation = {
    method: models.length === 3 ? "triple_model" : "dual_model",
    modelsUsed: models.map((m) => m.label),
    claudeEstimate: claudeResult.likely,
    gptEstimate: gptResult?.likely ?? null,
    geminiEstimate: geminiResult?.likely ?? null,
    geminiModel: geminiResult ? (process.env.GEMINI_MODEL || "gemini-2.5-flash") : null,
    percentDifference: parseFloat(pctDiff.toFixed(1)),
    agreement,
    note,
  };

  return finalResult;
}

// Main export — runs all configured models in parallel
export async function estimateVolume(params) {
  const { apiKey } = params;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // Run all API calls in parallel
  const [claudeText, gptText, geminiText] = await Promise.all([
    callClaude(params),
    openaiApiKey ? callOpenAI({ ...params, openaiApiKey }) : Promise.resolve(null),
    googleApiKey ? callGemini({ ...params, googleApiKey, geminiModel }) : Promise.resolve(null),
  ]);

  const claudeResult = parseResponse(claudeText);
  const gptResult = parseResponse(gptText);
  const geminiResult = parseResponse(geminiText);

  // If Claude failed, return error
  if (!claudeResult) {
    return {
      low: 0,
      high: 0,
      likely: 0,
      confidence: "Low",
      truckFraction: "unknown",
      reasoning: claudeText || "No response from Claude",
      itemsIdentified: [],
      scaleReference: "Could not parse response",
      notes: "The AI response could not be parsed. Raw response is in the reasoning field.",
      crossValidation: { method: "failed", note: "Claude parsing failed" },
    };
  }

  // Cross-validate and return merged result
  return crossValidate(claudeResult, gptResult, geminiResult);
}

// Export for single-model mode (backwards compatible)
export async function estimateVolumeSingleModel(params) {
  const claudeText = await callClaude(params);
  const claudeResult = parseResponse(claudeText);
  
  if (!claudeResult) {
    return {
      low: 0,
      high: 0,
      likely: 0,
      confidence: "Low",
      truckFraction: "unknown",
      reasoning: claudeText || "No response",
      itemsIdentified: [],
      scaleReference: "Could not parse response",
      notes: "The AI response could not be parsed.",
    };
  }
  
  return claudeResult;
}