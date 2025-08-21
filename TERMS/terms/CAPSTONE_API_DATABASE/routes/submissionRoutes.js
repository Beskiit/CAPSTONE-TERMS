import express from 'express';
import {
  getSubmissions,
  getSubmissionsByUser,
  getSubmission,
  createSubmission,
  submitAnswers,
  deleteSubmission,
  patchLAEMPLBySubmissionId,
} from '../controllers/submissionController.js';

const router = express.Router();

// GET /api/submissions
router.get('/', getSubmissions);

// GET /api/submissions/user/:id
router.get('/user/:id', getSubmissionsByUser);

// GET /api/submissions/:id
router.get('/:id', getSubmission);

// POST /api/submissions
router.post('/', createSubmission);

// PATCH /api/submissions/:id
router.patch('/:id', submitAnswers);

// PATCH /api/submissions/laempl/:id
router.patch('/laempl/:id', patchLAEMPLBySubmissionId);

// DELETE /api/submissions/:id
router.delete('/:id', deleteSubmission);

export default router;
