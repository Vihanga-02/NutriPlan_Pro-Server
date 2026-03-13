import express from 'express';
import {
  create,
  getById,
  getUserOrders,
  getAll,
  updateStatus,
  getStats
} from '../controllers/orderController.js';
import { authenticateUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateUser, create); // authenticateUser allows guests (req.user can be null)
router.get('/my-orders', authenticateUser, getUserOrders);
router.get('/stats', authenticateUser, requireAdmin, getStats);
router.get('/:id', authenticateUser, getById);
router.get('/', authenticateUser, requireAdmin, getAll);
router.put('/:id/status', authenticateUser, requireAdmin, updateStatus);

export default router;
