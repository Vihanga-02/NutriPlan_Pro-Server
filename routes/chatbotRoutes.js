import express from 'express';
import {
  chat,
  quickAnswer,
  analyzeHealth,
  mealSuggestions
} from '../controllers/chatbotController.js';

const router = express.Router();

router.post('/chat', chat);

router.post('/quick-answer', quickAnswer);

router.post('/analyze-health', analyzeHealth);

router.post('/meal-suggestions', mealSuggestions);

export default router;
