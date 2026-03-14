 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/server/claude.js b/server/claude.js
index 19de1fa2b48508058f1aad7bb9bc42b5a08fdfd3..2d345bc1676c10047c74df5cf36639b4f9f4cbed 100644
--- a/server/claude.js
+++ b/server/claude.js
@@ -28,72 +28,86 @@ function round1(n) {
 
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
   if (ratio <= 0.2) return "About 1/8 truck";
   if (ratio <= 0.33) return "About 1/4 truck";
   if (ratio <= 0.58) return "About 1/2 truck";
   if (ratio <= 0.83) return "About 3/4 truck";
   return "About a full truck";
 }
 
-function parseVendorClaimToNumber(vendorClaim, truckSize = 15) {
+export function parseVendorClaimToNumber(vendorClaim, truckSize = 15) {
   if (!vendorClaim) return null;
 
   const s = String(vendorClaim).toLowerCase().trim();
 
-  const cyMatch = s.match(/(\d+(\.\d+)?)\s*(cy|cubic yard|cubic yards|yard|yards)/i);
-  if (cyMatch) return parseFloat(cyMatch[1]);
+  const plausibleUpperBound = Math.max(truckSize * 2, 25);
+  const isPlausibleCy = (n) => Number.isFinite(n) && n >= 0 && n <= plausibleUpperBound;
+
+  // Prefer explicit cubic-yard style values and ranges (e.g. "3-5 yards", "4 to 6 cy").
+  const rangeMatches = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(cy|yd\^?3|yds?|yards?|cubic\s*yards?)/gi)];
+  for (const match of rangeMatches) {
+    const high = parseFloat(match[2]);
+    if (isPlausibleCy(high)) return high;
+  }
+
+  const cyMatches = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(cy|yd\^?3|yds?|yards?|cubic\s*yards?)/gi)];
+  for (const match of cyMatches) {
+    const value = parseFloat(match[1]);
+    if (isPlausibleCy(value)) return value;
+  }
 
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
 
-  const plainNum = s.match(/(\d+(\.\d+)?)/);
-  if (plainNum) return parseFloat(plainNum[1]);
+  const plainNums = [...s.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
+  const plausibleNum = plainNums.find((n) => isPlausibleCy(n));
+  if (plausibleNum != null) return plausibleNum;
 
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
 
EOF
)
