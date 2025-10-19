import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getSubmissions,
  getSubmissionsByUser,
  getSubmission,
  getLAEMPLBySubmissionId,
  patchLAEMPLBySubmissionId,
  createSubmission,
  submitAnswers,
  deleteSubmission,
  getMySubmissions,
  patchMPSBySubmissionId,          // ⬅️ NEW
  submitToPrincipal,               // ⬅️ NEW
  getSubmissionsForPrincipalApproval, // ⬅️ NEW
  getMySubmissionForAssignment,
  patchSubmission,                 // ⬅️ NEW - Generic PATCH endpoint
  patchSubmissionFormData,         // ⬅️ NEW - FormData PATCH endpoint
} from "../controllers/submissionController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Multer configuration for file uploads
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "accomplishments");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, `${base}${ext}`);
  },
});
const upload = multer({ storage });

// List + by user
router.get("/", getSubmissions);
router.get("/user/:id", getSubmissionsByUser);

// Principal approval queue
router.get("/for-principal-approval", requireAuth, getSubmissionsForPrincipalApproval);
router.get("/by-assignment/:id/mine", requireAuth, getMySubmissionForAssignment);

// --- SPECIFIC ROUTES MUST COME BEFORE "/:id" ---
// LAEMPL
router.get("/laempl/:id", getLAEMPLBySubmissionId);
router.patch("/laempl/:id", patchLAEMPLBySubmissionId);

// MPS (match your front-end calls)
router.get("/mps/submissions/:id", getSubmission);          // reuse generic getter
router.patch("/mps/submissions/:id", patchMPSBySubmissionId);

// Generic
router.get("/:id", getSubmission);
router.patch("/:id", patchSubmission);              // ⬅️ NEW - Generic PATCH endpoint
router.patch("/:id/formdata", upload.array("images"), patchSubmissionFormData); // ⬅️ NEW - FormData PATCH endpoint with file upload
router.patch("/:id/answers", submitAnswers);
router.post("/", createSubmission);
router.delete("/:id", deleteSubmission);
router.get("/my/:id", getMySubmissions);

// Coordinator submit to principal
router.post("/:id/submit-to-principal", submitToPrincipal);

export default router;
