import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-3-flash-preview";

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
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

export async function verifyVendorLoad({
  images,
  claimedCy,
  truckCapacityCy = 15,
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("At least one image is required.");
  }

  const prompt = `
You are verifying a junk removal vendor's claimed cubic yard volume from job photos.

Primary goal:
Estimate the NET cubic yards removed for this job.

Important rules:
1. Primary evidence must be the truck bed BEFORE and AFTER photos.
2. If the truck photo is unclear, use before-site photos as a secondary cross-check only.
3. Do not rely primarily on the vendor's claimed volume.
4. The truck may already contain debris before the job started. You must estimate:
   - truck fill before
   - truck fill after
   - delta fill added by this job
5. The after-truck overhead photo is especially important for estimating load size.
6. Use the before-site and after-site photos to cross-check whether the delta truck load is reasonable.
7. If the photos are unclear, still return your best estimate, but widen the range and lower confidence.
8. If the estimate differs from the vendor's claim by more than 3 cubic yards, set decision to "manager_review".
9. If key required photos are missing or unclear, set decision to "manager_review".
10. Required photo categories to check for:
   - before_truck
   - before_site
   - address_verification
   - after_truck
   - overhead_after_truck
   - after_site

Truck capacity for this job: ${truckCapacityCy} cubic yards
Vendor claimed volume: ${claimedCy} cubic yards
Tolerance before manager review: 3 cubic yards

Return STRICT JSON only in this exact shape:
{
  "truck_capacity_cy": number,
  "claimed_cy": number,
  "truck_before_fraction": number,
  "truck_after_fraction": number,
  "delta_fraction": number,
  "estimated_delta_cy_low": number,
  "estimated_delta_cy_high": number,
  "decision": "ok" | "manager_review",
  "confidence": "low" | "med" | "high",
  "photo_compliance": {
    "before_truck_found": boolean,
    "before_site_found": boolean,
    "address_verification_found": boolean,
    "after_truck_found": boolean,
    "overhead_after_truck_found": boolean,
    "after_site_found": boolean
  },
  "reasons": [string],
  "manager_notes": string
}
`.trim();

  const parts = [
    { text: prompt },
    ...images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType || "image/jpeg",
        data: img.base64,
      },
    })),
  ];

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const rawText = response.text;
  const parsed = safeJsonParse(rawText);

  const truckBeforeFraction = clamp01(Number(parsed.truck_before_fraction ?? 0));
  const truckAfterFraction = clamp01(Number(parsed.truck_after_fraction ?? 0));
  const deltaFraction = clamp01(
    Number(parsed.delta_fraction ?? Math.max(0, truckAfterFraction - truckBeforeFraction))
  );

  let estimatedLow = Number(parsed.estimated_delta_cy_low ?? deltaFraction * truckCapacityCy);
  let estimatedHigh = Number(parsed.estimated_delta_cy_high ?? deltaFraction * truckCapacityCy);

  if (Number.isNaN(estimatedLow)) estimatedLow = 0;
  if (Number.isNaN(estimatedHigh)) estimatedHigh = 0;

  if (estimatedLow > estimatedHigh) {
    const temp = estimatedLow;
    estimatedLow = estimatedHigh;
    estimatedHigh = temp;
  }

  estimatedLow = round1(estimatedLow);
  estimatedHigh = round1(estimatedHigh);

  const photoCompliance = {
    before_truck_found: Boolean(parsed?.photo_compliance?.before_truck_found),
    before_site_found: Boolean(parsed?.photo_compliance?.before_site_found),
    address_verification_found: Boolean(parsed?.photo_compliance?.address_verification_found),
    after_truck_found: Boolean(parsed?.photo_compliance?.after_truck_found),
    overhead_after_truck_found: Boolean(parsed?.photo_compliance?.overhead_after_truck_found),
    after_site_found: Boolean(parsed?.photo_compliance?.after_site_found),
  };

  const toleranceCy = 3;
  const estimateMid = (estimatedLow + estimatedHigh) / 2;
  const claimGap = Math.abs(estimateMid - claimedCy);
  const estimateRangeWidth = estimatedHigh - estimatedLow;

  const missingCriticalPhotos =
    !photoCompliance.before_truck_found ||
    !photoCompliance.after_truck_found ||
    !photoCompliance.before_site_found ||
    !photoCompliance.after_site_found;

  const unclearPhotos = !photoCompliance.overhead_after_truck_found;
  const lowConfidence = (parsed.confidence || "").toLowerCase() === "low";

  let decision = "ok";
  if (
    claimGap > toleranceCy ||
    estimateRangeWidth > 3 ||
    missingCriticalPhotos ||
    lowConfidence ||
    unclearPhotos
  ) {
    decision = "manager_review";
  }

  return {
    truck_capacity_cy: truckCapacityCy,
    claimed_cy: claimedCy,
    truck_before_fraction: round1(truckBeforeFraction),
    truck_after_fraction: round1(truckAfterFraction),
    delta_fraction: round1(deltaFraction),
    estimated_delta_cy_low: estimatedLow,
    estimated_delta_cy_high: estimatedHigh,
    decision,
    confidence: ["low", "med", "high"].includes((parsed.confidence || "").toLowerCase())
      ? parsed.confidence.toLowerCase()
      : "med",
    photo_compliance: photoCompliance,
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
    manager_notes:
      typeof parsed.manager_notes === "string" && parsed.manager_notes.trim()
        ? parsed.manager_notes.trim()
        : decision === "manager_review"
          ? "Verify with management team."
          : "",
    raw_model_output: parsed,
  };
}