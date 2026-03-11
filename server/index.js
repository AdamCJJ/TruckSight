import "dotenv/config";
import express from "express";
import session from "express-session";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDb, insertEstimate, listEstimates, getEstimate, updateEstimate } from "./db.js";
import { estimateVolume } from "./claude.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const PIN = process.env.APP_PIN || "1234";

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "trucksight-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production" && process.env.RENDER === "true",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: "lax",
    },
  })
);

if (process.env.RENDER) {
  app.set("trust proxy", 1);
}

app.use(express.static(join(__dirname, "..", "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 24 },
});

function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.status(401).json({ error: "Not authenticated" });
}

app.post("/api/login", (req, res) => {
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

app.post(
  "/api/estimate",
  requireAuth,
  upload.fields([
    { name: "photos", maxCount: 12 },
    { name: "overlays", maxCount: 12 },
  ]),
  async (req, res) => {
    try {
      const photos = req.files?.photos || [];
      const overlays = req.files?.overlays || [];

      if (photos.length === 0) {
        return res.status(400).json({ error: "At least one photo is required" });
      }

      const {
        job_type = "STANDARD",
        dumpster_size,
        truck_size,
        vendor_claim,
        reference_object,
        notes,
        agent_label,
      } = req.body;

      const photoData = photos.map((photo, i) => {
        const base64 = photo.buffer.toString("base64");
        const mediaType = photo.mimetype || "image/jpeg";
        const overlay = overlays[i];
        return {
          base64,
          mediaType,
          overlay: overlay ? overlay.buffer.toString("base64") : undefined,
        };
      });

      const result = await estimateVolume({
        photos: photoData,
        jobType: job_type,
        dumpsterSize: dumpster_size,
        truckSize: truck_size ? parseInt(truck_size, 10) : 15,
        vendorClaim: vendor_claim,
        notes,
        referenceObject: reference_object,
      });

      let dbRecord = null;
      try {
        dbRecord = await insertEstimate({
          user_id: null,
          agent_label: agent_label || null,
          job_type,
          dumpster_size: dumpster_size && dumpster_size !== "UNKNOWN" ? parseInt(dumpster_size, 10) : null,
          truck_size: truck_size ? parseInt(truck_size, 10) : 15,
          vendor_claim: vendor_claim || null,
          notes: notes || null,
          photo_count: photos.length,
          reference_object: reference_object || null,
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
      console.error("Estimate error:", err);
      return res.status(500).json({ error: err.message || "Estimation failed" });
    }
  }
);

app.get("/api/history", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const rows = await listEstimates(limit);
    return res.json({ estimates: rows });
  } catch (err) {
    console.error("History error:", err);
    return res.json({ estimates: [] });
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
    const { actual_volume } = req.body;
    if (actual_volume === undefined || actual_volume === null) {
      return res.status(400).json({ error: "actual_volume is required" });
    }
    const row = await updateEstimate(req.params.id, { actual_volume: parseFloat(actual_volume) });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/stats", requireAuth, async (req, res) => {
  try {
    const { getStats } = await import("./db.js");
    const stats = await getStats();
    return res.json(stats);
  } catch (err) {
    return res.json({ total: 0, calibrated: 0, avgError: null });
  }
});

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "..", "public", "index.html"));
});

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
