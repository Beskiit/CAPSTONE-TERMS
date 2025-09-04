// routes/mpsRoutes.js
import express from "express";
import {
  giveMPSReport,
  getMPSSubmission,
  patchMPSSubmission
} from "../controllers/mpsController.js";

const router = express.Router();
router.get("/health", (_req, res) => res.json({ ok: true, scope: "mps" }));

// Admin/Coordinator creates the assignment + blank submissions
router.post('/give', giveMPSReport);

// Teacher loads one submission (by id shown in the UI)
router.get('/submissions/:id', getMPSSubmission);

// Teacher saves/submits table values
router.patch('/submissions/:id', patchMPSSubmission);

export default router;
