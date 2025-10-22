import express from 'express';
import { getReports, getReport, giveReport, deleteReport, patchReport, getReportsByUser, getReportsAssignedByUser, giveLAEMPLReport, giveLAEMPLMPSReport, giveLAEMPLMPSCoordinatorReport } from '../controllers/reportAssignmentCon.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Routes 
router.get('/', getReports);         // GET /reports
router.get('/:id', getReport);       // GET /reports/:id
router.post('/give', requireAuth, giveReport);      // POST /reports/give
router.post('/laempl', requireAuth, giveLAEMPLReport);      // POST /reports/laempl
router.post('/laempl-mps', requireAuth, giveLAEMPLMPSReport);      // POST /reports/laempl-mps
router.post('/laempl-mps-coordinator', requireAuth, giveLAEMPLMPSCoordinatorReport);      // POST /reports/laempl-mps-coordinator
router.delete('/:id', requireAuth, deleteReport); // DELETE /reports/:id
router.patch('/:id', requireAuth, patchReport);   // PATCH /reports/:id
router.get('/given_to/:id', getReportsByUser); // GET reports by user (for teachers)
router.get('/assigned_by/:id', getReportsAssignedByUser); // GET reports assigned by coordinator
export default router;
