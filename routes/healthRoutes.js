import express from 'express';
import {
  createProfile,
  getProfile,
  updateProfile,
  calculateHealthMetrics
} from '../controllers/healthController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

router.post('/profile', authenticateUser, createProfile);
router.get('/profile', authenticateUser, getProfile);
router.put('/profile', authenticateUser, updateProfile);
router.post('/calculate', calculateHealthMetrics);

export default router;
