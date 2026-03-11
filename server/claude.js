import { GoogleGenAI } from "@google/genai";

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Model did not return valid JSON");
  }
}

function round1(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.round((x + Number.EPSILON) * 10) / 10;
}

function clampMinZero(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, x);
}

function confidenceLabel(value) {
  const v = String(value || "").toLowerCase();
  if (v === "high") return "High";
  if (v === "medium" || v === "med") return "Medium";
  return "Low";
}

function buildTruckFraction(likely, truckSize = 15) {
  const ratio = likely / Math.max(truckSize, 1);

  if (ratio <= 0.08) return "Minimum load";
  if (ratio <= 0.20) return "About 1/8 truck";
  if (ratio <= 0.33) return "About 1/4 truck";
  if (ratio <= 0.58) return "About 1/2 truck";
  if (ratio <= 0.83) return "About 3/4 truck";
  return "About a full truck";
}

function parseVendorClaimToNumber(vendorClaim, truckSize = 15) {
  if (!vendorClaim) return null;

  const s = String(vendorClaim).toLowerCase().trim();

  const cyMatch = s.match(/(\d+(\.\d+)?)\s*(cy|cubic yard|cubic yards|yard|yards)/i);
  if (cyMatch) return parseFloat(cyMatch[1]);

  const fracMatch = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]);
    const den = parseFloat(fracMatch[2]);
    if (den > 0) return (num / den) * truckSize;
  }

  if (s.includes("half")) return truckSize * 0.5;
  if (s.includes("quarter")) return truckSize * 0.25;
  if (s.includes("three quarter") || s.includes("3/4")) return truckSize * 0.75;
  if (s.includes("full")) return truckSize;

  const plainNum = s.match(/(\d+(\.\d+)?)/);
  if (plainNum) return parseFloat(plainNum[1]);

  return null;
}

function buildPrompt({
  jobType,
  dumpsterSize,
  truckSize,
  vendorClaim,
  notes,
  referenceObject,
}) {
  const common = `
You are estimating junk removal volume from photos.

General rules:
1. Return STRICT JSON only.
2. Give a realistic estimate, not a sales estimate.
3. If uncertain, widen the range instead of pretending precision.
4. Use visible scale cues such as doors, carts, curbs, cinder blocks, pallets, dumpsters, fences, and truck walls.
5. If a reference object is provided, use it.
6. Avoid double counting items shown in multiple photos.
7. Keep the reasoning short and practical.

Reference object: ${referenceObject || "None provided"}
Additional notes: ${notes || "None"}

Return JSON in this exact shape:
{
  "low": number,
  "likely": number,
  "high": number,
  "confidence": "High" | "Medium" | "Low",
  "truckFraction": string,
  "scaleReference": string,
  "reasoning": string,
  "itemsIdentified": [string],
  "notes": string,
  "truckBeforeFraction": number | null,
  "truckAfterFraction": number | null,
  "deltaFraction": number | null,
  "vendorReviewStatus": string | null
}
`.trim();

  if (jobType === "TRUCK_VERIFY") {
    return `
${common}

Job type: Verify Truck Load
Truck size: ${truckSize} cubic yards
Vendor claim: ${vendorClaim || "None provided"}

Truck verification rules:
1. Primary evidence must be the truck bed BEFORE and AFTER photos.
2. If the truck photo is unclear, use before-site photos as a secondary cross-check only.
3. The truck may already contain debris before the job started.
4. Estimate:
   - truck fill before
   - truck fill after
   - net added load for this job
5. Use the before-site and after-site photos only as supporting evidence.
6. If the photos are too unclear, still give your best estimate, widen the range, and lower confidence.
7. If the estimate is more than about 3 cubic yards away from the vendor claim, set vendorReviewStatus to "manager_review".
8. If critical truck photos are missing or unclear, set vendorReviewStatus to "manager_review".

Interpretation guidance:
- "low", "likely", and "high" should represent NET cubic yards added by this job.
- "truckBeforeFraction", "truckAfterFraction", and "deltaFraction" should be values from 0 to 1.
- "truckFraction" should describe the net added load relative to a ${truckSize}-yard truck.
- "vendorReviewStatus" should be either "ok" or "manager_review".
`.trim();
  }

  if (jobType === "DUMPSTER_CLEANOUT") {
    return `
${common}

Job type: Dumpster Cleanout
Dumpster size: ${dumpsterSize || "Unknown"} cubic yards

Rules for this mode:
1. Estimate debris around, on top of, and inside the dumpster.
2. For material inside the dumpster, count the visible removable portion.
3. Be practical and conservative if depth is unclear.
4. "truckFraction" should convert the likely estimate into a 15-yard truck equivalent.
`.trim();
  }

  if (jobType === "DUMPSTER_OVERFLOW") {
    return `
${common}

Job type: Dumpster Overflow
Dumpster size: ${dumpsterSize || "Unknown"} cubic yards

Rules for this mode:
1. Estimate debris around and on top of the dumpster.
2. Also include only an arms-length reasonable amount from inside if visible.
3. Be practical and conservative if inside depth is unclear.
4. "truckFraction" should convert the likely estimate into a 15-yard truck equivalent.
`.trim();
  }

  return `
${common}

Job type: Standard Junk Removal

Rules for this mode:
1. Estimate all debris and items shown that appear intended for removal.
2. Assume efficient loading into a junk truck.
3. If multiple photos show the same pile or items, count them once.
4. "truckFraction" should convert the likely estimate into a 15-yard truck equivalent.
`.trim();
}

export async function estimateVolume({
  photos,
  jobType = "STANDARD",
  dumpsterSize,
  truckSize = 15,
  vendorClaim,
  notes,
  referenceObject,
}) {
  if (!Array.isArray(photos) || photos.length === 0) {
    throw new Error("At least one photo is required");
  }

  const ai = getClient();
  const model = "gemini-2.5-flash";

  const prompt = buildPrompt({
    jobType,
    dumpsterSize,
    truckSize,
    vendorClaim,
    notes,
    referenceObject,
  });

  const parts = [
    { text: prompt },
    ...photos.map((p) => ({
      inlineData: {
        mimeType: p.mediaType || "image/jpeg",
        data: p.base64,
      },
    })),
  ];

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.15,
    },
  });

  const parsed = safeJsonParse(response.text);

  let low = clampMinZero(parsed.low);
  let likely = clampMinZero(parsed.likely);
  let high = clampMinZero(parsed.high);

  if (low > likely) [low, likely] = [likely, low];
  if (likely > high) [likely, high] = [high, likely];
  if (low > high) [low, high] = [high, low];

  low = round1(low);
  likely = round1(likely);
  high = round1(high);

  const beforeFrac =
    parsed.truckBeforeFraction === null || parsed.truckBeforeFraction === undefined
      ? null
      : round1(parsed.truckBeforeFraction);

  const afterFrac =
    parsed.truckAfterFraction === null || parsed.truckAfterFraction === undefined
      ? null
      : round1(parsed.truckAfterFraction);

  const deltaFrac =
    parsed.deltaFraction === null || parsed.deltaFraction === undefined
      ? null
      : round1(parsed.deltaFraction);

  let vendorReviewStatus = parsed.vendorReviewStatus || null;

  if (jobType === "TRUCK_VERIFY") {
    const claim = parseVendorClaimToNumber(vendorClaim, truckSize);
    if (claim != null) {
      const gap = Math.abs(likely - claim);
      if (gap > 3) vendorReviewStatus = "manager_review";
      else if (!vendorReviewStatus) vendorReviewStatus = "ok";
    }
  }

  const finalTruckSize = jobType === "TRUCK_VERIFY" ? truckSize : 15;

  return {
    low,
    likely,
    high,
    confidence: confidenceLabel(parsed.confidence),
    truckFraction:
      typeof parsed.truckFraction === "string" && parsed.truckFraction.trim()
        ? parsed.truckFraction.trim()
        : buildTruckFraction(likely, finalTruckSize),
    scaleReference:
      typeof parsed.scaleReference === "string" && parsed.scaleReference.trim()
        ? parsed.scaleReference.trim()
        : (referenceObject || "Visual scale cues from the photos"),
    reasoning:
      typeof parsed.reasoning === "string" && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : "Estimate based on visible volume, scale cues, and overall pile or load size.",
    itemsIdentified: Array.isArray(parsed.itemsIdentified) ? parsed.itemsIdentified : [],
    notes:
      typeof parsed.notes === "string"
        ? parsed.notes
        : (notes || ""),
    truckBeforeFraction: beforeFrac,
    truckAfterFraction: afterFrac,
    deltaFraction: deltaFrac,
    vendorReviewStatus,
  };
}
