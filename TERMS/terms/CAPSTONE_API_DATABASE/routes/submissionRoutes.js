import express from "express";
import {
  getSubmissions,
  getSubmissionsByUser,
  getSubmission,
  getLAEMPLBySubmissionId,   // <-- will add below
  patchLAEMPLBySubmissionId,
  createSubmission,
  submitAnswers,
  deleteSubmission,
} from "../controllers/submissionController.js";  // <-- FIXED path


const router = express.Router();
// routes/submissionRoutes.js

router.get("/", getSubmissions);
router.get("/user/:id", getSubmissionsByUser);

// ORDER MATTERS:
router.get("/laempl/:id", getLAEMPLBySubmissionId);   // <-- put before
router.patch("/laempl/:id", patchLAEMPLBySubmissionId);

router.get("/:id", getSubmission);
router.patch("/:id/answers", submitAnswers);
router.post("/", createSubmission);
router.delete("/:id", deleteSubmission);

export default router;

