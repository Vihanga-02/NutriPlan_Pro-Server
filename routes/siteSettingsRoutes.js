import express from 'express';
import {
  get,
  update,
  updateRestaurant,
  updateNotifications
} from '../controllers/siteSettingsController.js';
import { authenticateUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public endpoint - anyone can view site settings
router.get('/', get);

// Admin-only endpoints
router.put('/', authenticateUser, requireAdmin, update);
router.put('/restaurant', authenticateUser, requireAdmin, updateRestaurant);
router.put('/notifications', authenticateUser, requireAdmin, updateNotifications);

export default router;
