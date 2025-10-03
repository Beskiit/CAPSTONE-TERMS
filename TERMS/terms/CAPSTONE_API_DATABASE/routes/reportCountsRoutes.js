// routes/reportCounts.js
import express from 'express';
import {
  getStatusCountsByUser,
  getStatusCountsByUserInRange
} from '../controllers/reportCounts.js';

const router = express.Router();

// Example:
// GET /reports/status/count/user/961
router.get('/user/:id/', getStatusCountsByUser);

// Optional (date-windowed counts):
// GET /reports/status/count/user/961/range?from=2025-10-01&to=2025-10-31
router.get('/user/:id/range', getStatusCountsByUserInRange);

export default router;
