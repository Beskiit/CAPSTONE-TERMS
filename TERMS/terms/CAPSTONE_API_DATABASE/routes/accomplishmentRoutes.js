// routes/accomplishmentRoutes.js
import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  giveAccomplishmentReport,
  getAccomplishmentSubmission,
  patchAccomplishmentSubmission,
  getAccomplishmentPeers,
  consolidateAccomplishmentByTitle,
  linkParentAssignment,
} from "../controllers/accomplishmentController.js";

const router = express.Router();

/* ---------- Ensure upload dir exists ---------- */
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "accomplishments");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- Multer config ---------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // keep original extension
    const ext = path.extname(file.originalname || "");
    const base = Date.now() + "-" + Math.random().toString(16).slice(2);
    cb(null, `${base}${ext}`);
  },
});
const upload = multer({ storage });

/* ---------- Routes (mounted at /reports/accomplishment) ---------- */

// Seed blank submissions for recipients
router.post("/give", giveAccomplishmentReport);

// Read a single submission (fields parsed)
router.get("/:id", getAccomplishmentSubmission);

// Update narrative + (optionally) add/remove images
router.patch("/:id", upload.array("images"), patchAccomplishmentSubmission);

// Peers list grouped by title (for Consolidate modal)
router.get("/:id/peers", getAccomplishmentPeers);

// Consolidate images by title
router.post("/:id/consolidate", consolidateAccomplishmentByTitle);

// Link parent assignment (for coordinator-teacher hierarchy)
router.post("/link-parent", linkParentAssignment);

export default router;
