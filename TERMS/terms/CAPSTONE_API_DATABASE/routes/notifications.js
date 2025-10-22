import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationsController.js';

const router = express.Router();

// GET /notifications (current user)
router.get('/', requireAuth, getMyNotifications);

// POST /notifications/read-all
router.post('/read-all', requireAuth, markAllNotificationsRead);

// PATCH /notifications/:id/read
router.patch('/:id/read', requireAuth, markNotificationRead);

export default router;















