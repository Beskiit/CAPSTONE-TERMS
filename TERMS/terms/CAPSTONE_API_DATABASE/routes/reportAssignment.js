import express from 'express';
import { getReports, getReport, giveReport, deleteReport, patchReport, getReportsByUser } from '../controllers/reportAssignmentCon.js';

const router = express.Router();

// Routes 
router.get('/', getReports);         // GET /reports
router.get('/:id', getReport);       // GET /reports/:id
router.post('/', giveReport);      // POST /reports
router.delete('/:id', deleteReport); // DELETE /reports/:id
router.patch('/:id', patchReport);   // PATCH /reports/:id
router.get('/given_to/:id', getReportsByUser); // GET reports by user
export default router;
