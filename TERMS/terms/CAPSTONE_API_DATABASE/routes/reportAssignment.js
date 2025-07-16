import express from 'express';
import { getReports, getReport, giveReport, deleteReport, patchReport } from '../controllers/reportAssignmentCon.js';

const router = express.Router();

// Routes handled
router.get('/', getReports);         // GET /reports
router.get('/:id', getReport);       // GET /reports/:id
router.post('/', giveReport);      // POST /reports
router.delete('/:id', deleteReport); // DELETE /reports/:id
router.patch('/:id', patchReport);   // PATCH /reports/:id

export default router;
