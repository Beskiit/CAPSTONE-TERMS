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
  getApprovedSubmissionsByPrincipal, // ⬅️ NEW
  getRejectedSubmissionsByPrincipal, // ⬅️ NEW
  patchSubmissionFormData,          // ⬅️ NEW
  patchSubmission,                 // ⬅️ NEW - Generic PATCH endpoint
} from "../controllers/submissionController.js";
import { requireAuth } from "../middleware/auth.js";

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads', 'accomplishments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const router = express.Router();

// List + by user
router.get("/", getSubmissions);
router.get("/user/:id", getSubmissionsByUser);

// Principal approval queue
router.get("/for-principal-approval", requireAuth, getSubmissionsForPrincipalApproval);

// Principal approved submissions
router.get("/approved-by-principal", requireAuth, getApprovedSubmissionsByPrincipal);

// Principal rejected submissions
router.get("/rejected-by-principal", requireAuth, getRejectedSubmissionsByPrincipal);

// --- SPECIFIC ROUTES MUST COME BEFORE "/:id" ---
// LAEMPL
router.get("/laempl/:id", getLAEMPLBySubmissionId);
router.patch("/laempl/:id", patchLAEMPLBySubmissionId);

// MPS (match your front-end calls)
router.get("/mps/submissions/:id", getSubmission);          // reuse generic getter
router.patch("/mps/submissions/:id", patchMPSBySubmissionId);

// Generic
router.get("/:id", getSubmission);
router.patch("/:id", patchSubmission);  // ⬅️ NEW - Generic PATCH for status updates
router.patch("/:id/answers", submitAnswers);
router.patch("/:id/formdata", upload.array('images', 10), patchSubmissionFormData);  // ⬅️ NEW with multer
router.post("/", createSubmission);
router.delete("/:id", deleteSubmission);
router.get("/my/:id", getMySubmissions);

// Coordinator submit to principal
router.post("/:id/submit-to-principal", submitToPrincipal);

export default router;
