import express from 'express';
import { 
  getPendingReportsByUser, 
  getCompletedReportsByUser 
} from '../controllers/reportStatus.js';

const router = express.Router();

router.get('/user/:id/pending', getPendingReportsByUser);
router.get('/user/:id/completed', getCompletedReportsByUser);

export default router;
