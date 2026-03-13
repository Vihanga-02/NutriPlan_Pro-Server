import express from 'express';
import {
  create,
  getUserMealPlans,
  getById,
  track,
  logExternal,
  logMeasurement,
  getMeasurements,
  getTracking,
  createOrderFromMealPlan
} from '../controllers/mealPlanController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateUser, create);
router.get('/my-plans', authenticateUser, getUserMealPlans);
router.post('/track', authenticateUser, track);
router.post('/external', authenticateUser, logExternal);
router.post('/measurements', authenticateUser, logMeasurement);
router.get('/measurements/history', authenticateUser, getMeasurements);
router.get('/tracking/history', authenticateUser, getTracking);
router.post('/:id/order', authenticateUser, createOrderFromMealPlan);
router.get('/:id', authenticateUser, getById);

export default router;
