import express from 'express';
import { summarize } from '../controllers/aiController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/summarize', requireAuth, summarize);

export default router;















