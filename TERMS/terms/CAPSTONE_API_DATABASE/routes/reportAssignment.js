import express from 'express';
import { getReports, getReport, giveReport, deleteReport, patchReport, getReportsByUser, getReportsAssignedByUser, giveLAEMPLReport, giveLAEMPLMPSReport, giveLAEMPLMPSCoordinatorReport, getLAEMPLMPSAssignments, updateLAEMPLMPSAssignment, createOrUpdateLAEMPLMPSAssignment, getCoordinatorLAEMPLMPSGrade, getCoordinatorLAEMPLMPSGradeById } from '../controllers/reportAssignmentCon.js';
import { submitToPrincipal } from '../controllers/submissionController.js';
import { requireAuth, requireAdmin, requirePrincipal } from '../middleware/auth.js';

const router = express.Router();

// Routes 
router.get('/', getReports);         // GET /reports
router.post('/give', requireAuth, giveReport);      // POST /reports/give
router.post('/laempl', requireAuth, giveLAEMPLReport);      // POST /reports/laempl
router.post('/laempl-mps', requireAuth, giveLAEMPLMPSReport);      // POST /reports/laempl-mps
router.post('/laempl-mps-coordinator', requireAuth, giveLAEMPLMPSCoordinatorReport);      // POST /reports/laempl-mps-coordinator
// Allow principals (and admins) to read coordinator-grade assignments for SetReport auto-fill
router.get('/laempl-mps/assignments', requireAuth, requirePrincipal, getLAEMPLMPSAssignments); // GET /reports/laempl-mps/assignments
// Allow coordinators to get their own assigned grade level for LAEMPL & MPS
router.get('/laempl-mps/coordinator-grade', requireAuth, getCoordinatorLAEMPLMPSGrade); // GET /reports/laempl-mps/coordinator-grade
// Principal lookup of coordinator grade level by user ID (used by SetReport auto-fill)
router.get('/laempl-mps/coordinator-grade/:coordinatorId', requireAuth, requirePrincipal, getCoordinatorLAEMPLMPSGradeById);
router.post('/laempl-mps/assignments/create-or-update', requireAuth, requireAdmin, createOrUpdateLAEMPLMPSAssignment); // POST /reports/laempl-mps/assignments/create-or-update
router.patch('/laempl-mps/assignments/:id', requireAuth, requireAdmin, updateLAEMPLMPSAssignment); // PATCH /reports/laempl-mps/assignments/:id
router.post('/laempl-mps/:id/submit-to-principal', requireAuth, submitToPrincipal); // POST /reports/laempl-mps/:id/submit-to-principal
router.get('/:id', getReport);       // GET /reports/:id
router.delete('/:id', requireAuth, deleteReport); // DELETE /reports/:id
router.patch('/:id', requireAuth, patchReport);   // PATCH /reports/:id
router.get('/given_to/:id', getReportsByUser); // GET reports by user (for teachers)
router.get('/assigned_by/:id', getReportsAssignedByUser); // GET reports assigned by coordinator
export default router;
