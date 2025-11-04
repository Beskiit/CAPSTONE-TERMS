// routes/reportStatus.js
import express from 'express';
import {
  getUpcomingDeadlinesByUser,
  getPendingReportsByUser,
  getCompletedReportsByUser,
  getPrincipalAccomplishmentAssignments,
} from '../controllers/reportStatus.js';

const router = express.Router();

// e.g. GET /reports/status/user/961/upcoming
router.get('/user/:id/upcoming', getUpcomingDeadlinesByUser);

// (optional) keep your other endpoints
// e.g. GET /reports/status/user/961/pending
router.get('/user/:id/pending', getPendingReportsByUser);

// Principal-created Accomplishment assignments
// e.g. GET /reports/status/principal/53096/assignments/accomplishment
router.get('/principal/:id/assignments/accomplishment', getPrincipalAccomplishmentAssignments);

// e.g. GET /reports/status/user/961/completed
router.get('/user/:id/completed', getCompletedReportsByUser);

export default router;
