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

  if (jobType === "AUTO_DETECT") {
    return `
${common}

Job type: Auto Detect

Rules for this mode:
1. First infer whether the photos are mainly:
   - standard junk removal
   - dumpster cleanout
   - dumpster overflow
   - truck load verification
2. Base your estimate on the photo type you infer.
3. If truck photos appear central to the job, use truck before/after logic when possible.
4. Put the inferred job type into the "notes" field at the start, like:
   "Detected type: Truck verification"
5. "truckFraction" should convert the likely estimate into a 15-yard truck equivalent unless truck verification clearly uses a different stated truck size.
`.trim();
  }

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
