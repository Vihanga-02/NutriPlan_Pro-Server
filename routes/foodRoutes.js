import express from 'express';
import {
  create,
  getAll,
  getById,
  update,
  remove,
  getByMealType,
  suggestFoods
} from '../controllers/foodController.js';
import { authenticateUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getAll);
router.get('/suggest', suggestFoods);
router.get('/meal-type/:mealType', getByMealType);
router.get('/:id', getById);
router.post('/', authenticateUser, requireAdmin, create);
router.put('/:id', authenticateUser, requireAdmin, update);
router.delete('/:id', authenticateUser, requireAdmin, remove);

export default router;
