import express from 'express';
import { getReports, getReport, giveReport, deleteReport, patchReport, getReportsByUser, getReportsAssignedByUser, giveLAEMPLReport } from '../controllers/reportAssignmentCon.js';

const router = express.Router();

// Routes 
router.get('/', getReports);         // GET /reports
router.get('/:id', getReport);       // GET /reports/:id
router.post('/give', giveReport);      // POST /reports/give
router.post('/laempl', giveLAEMPLReport);      // POST /reports/laempl
router.delete('/:id', deleteReport); // DELETE /reports/:id
router.patch('/:id', patchReport);   // PATCH /reports/:id
router.get('/given_to/:id', getReportsByUser); // GET reports by user (for teachers)
router.get('/assigned_by/:id', getReportsAssignedByUser); // GET reports assigned by coordinator
export default router;
