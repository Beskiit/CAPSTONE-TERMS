import express from "express";
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
} from "../controllers/submissionController.js";

const router = express.Router();

// List + by user
router.get("/", getSubmissions);
router.get("/user/:id", getSubmissionsByUser);

// --- SPECIFIC ROUTES MUST COME BEFORE "/:id" ---
// LAEMPL
router.get("/laempl/:id", getLAEMPLBySubmissionId);
router.patch("/laempl/:id", patchLAEMPLBySubmissionId);

// MPS (match your front-end calls)
router.get("/mps/submissions/:id", getSubmission);          // reuse generic getter
router.patch("/mps/submissions/:id", patchMPSBySubmissionId);

// Generic
router.get("/:id", getSubmission);
router.patch("/:id/answers", submitAnswers);
router.post("/", createSubmission);
router.delete("/:id", deleteSubmission);
router.get("/my/:id", getMySubmissions);

export default router;
