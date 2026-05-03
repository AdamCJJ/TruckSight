import "dotenv/config";
import express from "express";
import session from "express-session";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDb, insertEstimate, listEstimates, getEstimate, updateEstimate, getVendorStats } from "./db.js";
import { estimateVolume, GeminiParseError } from "./gemini.js";
import { verifyJob } from "./verification.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const PIN = process.env.APP_PIN || "1234";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY environment variable is required");
  console.error("Get your key at: https://aistudio.google.com/app/apikey");
  process.exit(1);
}

if (!SESSION_SECRET || SESSION_SECRET === "change-me-in-production" || SESSION_SECRET === "trucksight-secret-change-me") {
  if (process.env.NODE_ENV === "production") {
    console.error("SESSION_SECRET must be set to a strong random value in production");
    process.exit(1);
  } else {
    console.warn("WARNING: SESSION_SECRET is not set or is using a default value — set it before deploying");
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET || "trucksight-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production" && process.env.RENDER === "true",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    },
  })
);

// Trust proxy on Render
if (process.env.RENDER) {
  app.set("trust proxy", 1);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many login attempts — try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Static files
app.use(express.static(join(__dirname, "..", "public")));

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// File upload — 15 photos + 15 overlays = 30 total
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 30 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, HEIC`));
    }
  },
});

// ─── Validation schemas ───

const JOB_TYPES = ["RESIDENTIAL", "COMMERCIAL", "DUMPSTER_CLEANOUT", "CONSTRUCTION", "ESTATE_CLEANOUT", "APPLIANCE_FURNITURE", "OTHER"];

const estimateSchema = z.object({
  job_type: z.enum(JOB_TYPES).default("RESIDENTIAL"),
  truck_size: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 15))
    .pipe(z.number().int().min(1).max(100)),
  notes: z.string().max(2000).optional(),
  agent_label: z.string().max(100).optional(),
  markup_descriptions: z.string().max(5000).optional(),
});

const EQUIPMENT_TYPES = [
  "DUMP_TRUCK_10YD", "DUMP_TRUCK_15YD", "DUMP_TRUCK_20YD",
  "DUMPSTER_2YD", "DUMPSTER_4YD", "DUMPSTER_6YD",
  "ROLLOFF_10YD", "ROLLOFF_20YD", "ROLLOFF_30YD", "ROLLOFF_40YD",
  "OTHER", "UNKNOWN",
];

const verifySchema = z.object({
  vendor_id: z.string().min(1).max(100),
  vendor_claimed_cy: z
    .string()
    .transform((v) => parseFloat(v))
    .pipe(z.number().min(0).max(200)),
  equipment_type: z.enum(EQUIPMENT_TYPES).default("UNKNOWN"),
  equipment_capacity_cy: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined))
    .pipe(z.number().min(0).max(200).optional()),
  scope_text: z.string().max(5000).optional(),
  notes: z.string().max(2000).optional(),
  agent_label: z.string().max(100).optional(),
  job_id_external: z.string().max(100).optional(),
});

const historyQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(500)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0))
    .pipe(z.number().int().min(0)),
});

const actualVolumeSchema = z.object({
  actual_volume: z
    .union([z.string().trim().min(1), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().min(0).max(200)),
});

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.status(401).json({ error: "Not authenticated" });
}

// ─── Auth routes ───

app.post("/api/login", loginLimiter, (req, res) => {
  const { pin } = req.body;
  if (pin === PIN) {
    req.session.authed = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Invalid PIN" });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/ping", requireAuth, (req, res) => {
  res.json({ ok: true });
});

// ─── Estimate route ───

app.post(
  "/api/estimate",
  requireAuth,
  upload.fields([
    { name: "photos", maxCount: 15 },
    { name: "overlays", maxCount: 15 },
  ]),
  async (req, res) => {
    try {
      const photos = req.files?.photos || [];
      const overlays = req.files?.overlays || [];

      if (photos.length === 0) {
        return res.status(400).json({ error: "At least one photo is required" });
      }

      // Validate and coerce body fields
      const bodyParse = estimateSchema.safeParse(req.body);
      if (!bodyParse.success) {
        return res.status(400).json({ error: "Invalid request", details: bodyParse.error.flatten().fieldErrors });
      }
      const { job_type, truck_size, notes, agent_label, markup_descriptions } = bodyParse.data;

      const overlayIndexesRaw = req.body.overlay_indexes;
      const overlayIndexes = Array.isArray(overlayIndexesRaw)
        ? overlayIndexesRaw
        : overlayIndexesRaw !== undefined
          ? [overlayIndexesRaw]
          : [];
      const overlaysByPhotoIndex = new Map();
      overlays.forEach((overlay, i) => {
        const parsedIndex = Number.parseInt(overlayIndexes[i], 10);
        const photoIndex = Number.isInteger(parsedIndex) ? parsedIndex : i;
        if (photoIndex >= 0 && photoIndex < photos.length) {
          overlaysByPhotoIndex.set(photoIndex, overlay);
        }
      });

      // Build photo data for Gemini
      const photoData = photos.map((photo, i) => {
        const base64 = photo.buffer.toString("base64");
        const mediaType = photo.mimetype || "image/jpeg";
        const overlay = overlaysByPhotoIndex.get(i);
        return {
          base64,
          mediaType,
          overlay: overlay ? overlay.buffer.toString("base64") : undefined,
        };
      });

      const result = await estimateVolume({
        apiKey: GEMINI_API_KEY,
        photos: photoData,
        jobType: job_type,
        truckSize: truck_size,
        notes,
        markupDescriptions: markup_descriptions || "",
      });

      // Save to DB
      let dbRecord = null;
      try {
        dbRecord = await insertEstimate({
          user_id: null,
          agent_label: agent_label || null,
          job_type,
          dumpster_size: null,
          truck_size: truck_size,
          vendor_claim: null,
          notes: notes || null,
          photo_count: photos.length,
          reference_object: null,
          result_json: JSON.stringify(result),
          confidence: result.confidence,
          low_cy: result.low,
          likely_cy: result.likely,
          high_cy: result.high,
        });
      } catch (dbErr) {
        console.error("DB insert error (non-fatal):", dbErr.message);
      }

      return res.json({
        id: dbRecord?.id ?? null,
        result,
      });
    } catch (err) {
      if (err instanceof GeminiParseError) {
        console.error("Gemini parse error:", err.message);
        return res.status(422).json({ error: "AI response could not be parsed — please retry or simplify your photos", details: err.message });
      }
      console.error("Estimate error:", err);
      return res.status(500).json({ error: err.message || "Estimation failed" });
    }
  }
);

// ─── Vendor verification route ───

app.post(
  "/api/verify",
  requireAuth,
  upload.fields([{ name: "photos", maxCount: 25 }]),
  async (req, res) => {
    try {
      const photos = req.files?.photos || [];
      if (photos.length === 0) {
        return res.status(400).json({ error: "At least one photo is required" });
      }

      const bodyParse = verifySchema.safeParse(req.body);
      if (!bodyParse.success) {
        return res.status(400).json({ error: "Invalid request", details: bodyParse.error.flatten().fieldErrors });
      }
      const {
        vendor_id, vendor_claimed_cy, equipment_type, equipment_capacity_cy,
        scope_text, notes, agent_label,
      } = bodyParse.data;

      const photoData = photos.map((p) => ({
        base64: p.buffer.toString("base64"),
        mediaType: p.mimetype || "image/jpeg",
      }));

      const result = await verifyJob({
        apiKey: GEMINI_API_KEY,
        photos: photoData,
        vendorClaimedCy: vendor_claimed_cy,
        equipmentType: equipment_type,
        equipmentCapacityCy: equipment_capacity_cy,
        scopeText: scope_text,
        notes,
      });

      // Persist to DB
      let dbRecord = null;
      try {
        const consensus = result.consensus || {};
        const variance = result.variance || {};
        dbRecord = await insertEstimate({
          user_id: null,
          agent_label: agent_label || null,
          job_type: "VERIFICATION",
          dumpster_size: null,
          truck_size: equipment_capacity_cy ?? null,
          vendor_claim: String(vendor_claimed_cy),
          notes: notes || null,
          photo_count: photos.length,
          reference_object: equipment_type,
          result_json: JSON.stringify(result),
          confidence: consensus.confidence ?? null,
          low_cy: consensus.low_cy ?? null,
          likely_cy: consensus.estimated_cy ?? null,
          high_cy: consensus.high_cy ?? null,
          submission_type: "VENDOR_VERIFICATION",
          vendor_id,
          vendor_claimed_cy,
          equipment_type,
          equipment_capacity_cy: equipment_capacity_cy ?? null,
          variance_pct: variance.variance_pct ?? null,
          photo_classifications: result.photo_classifications ?? null,
          scope_text: scope_text || null,
          scope_compliance: result.scope_compliance ?? null,
        });
      } catch (dbErr) {
        console.error("DB insert error (non-fatal):", dbErr.message);
      }

      return res.json({ id: dbRecord?.id ?? null, result });
    } catch (err) {
      if (err instanceof GeminiParseError) {
        console.error("Verification parse error:", err.message);
        return res.status(422).json({ error: "AI response could not be parsed — please retry", details: err.message });
      }
      console.error("Verify error:", err);
      return res.status(500).json({ error: err.message || "Verification failed" });
    }
  }
);

app.get("/api/vendor-stats", requireAuth, async (req, res) => {
  try {
    const vendorId = req.query.vendor_id ? String(req.query.vendor_id) : null;
    const rows = await getVendorStats(vendorId);
    return res.json({ vendors: rows });
  } catch (err) {
    console.error("Vendor stats error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── History routes ───

app.get("/api/history", requireAuth, async (req, res) => {
  const queryParse = historyQuerySchema.safeParse(req.query);
  if (!queryParse.success) {
    return res.status(400).json({ error: "Invalid query params", details: queryParse.error.flatten().fieldErrors });
  }
  const { limit, offset } = queryParse.data;
  try {
    const rows = await listEstimates(limit, offset);
    return res.json({ estimates: rows, limit, offset, hasMore: rows.length === limit });
  } catch (err) {
    console.error("History error:", err);
    return res.json({ estimates: [], limit, offset, hasMore: false });
  }
});

app.get("/api/history/:id", requireAuth, async (req, res) => {
  try {
    const row = await getEstimate(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/history/:id/actual", requireAuth, async (req, res) => {
  try {
    const bodyParse = actualVolumeSchema.safeParse(req.body);
    if (!bodyParse.success) {
      return res.status(400).json({ error: "Invalid request", details: bodyParse.error.flatten().fieldErrors });
    }
    const { actual_volume } = bodyParse.data;
    const row = await updateEstimate(req.params.id, { actual_volume });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Stats route ───

app.get("/api/stats", requireAuth, async (req, res) => {
  try {
    const { getStats } = await import("./db.js");
    const stats = await getStats();
    return res.json(stats);
  } catch (err) {
    return res.json({ total: 0, calibrated: 0, avg_error: null });
  }
});

// ─── SPA fallback ───

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "..", "public", "index.html"));
});

// ─── Start ───

async function start() {
  await initDb();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TruckSight running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});
