import {
  chatWithBot,
  getQuickAnswer,
  analyzeHealthMetrics,
  suggestMealsByGoal
} from '../services/aiChatbot.js';

export const chat = async (req, res, next) => {
  try {
    const { message, conversationHistory = [], language = 'en' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required and must be a string'
      });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message is too long (max 1000 characters)'
      });
    }

    if (!Array.isArray(conversationHistory)) {
      return res.status(400).json({
        success: false,
        message: 'Conversation history must be an array'
      });
    }

    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, conversationHistory.length - 20);
    }

    if (!['en', 'si'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Language must be "en" or "si"'
      });
    }

    const response = await chatWithBot(message, conversationHistory, language);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const quickAnswer = async (req, res, next) => {
  try {
    const { question, language = 'en' } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Question is required and must be a string'
      });
    }

    if (question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Question cannot be empty'
      });
    }

    if (!['en', 'si'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Language must be "en" or "si"'
      });
    }

    const response = await getQuickAnswer(question, language);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const analyzeHealth = async (req, res, next) => {
  try {
    const { bmi, bmr, tdee, bodyFat, age, gender, goal, language = 'en' } = req.body;

    if (!bmi || !bmr || !tdee || !age || !gender || !goal) {
      return res.status(400).json({
        success: false,
        message: 'Missing required health metrics'
      });
    }

    const metrics = {
      bmi: parseFloat(bmi),
      bmr: parseFloat(bmr),
      tdee: parseFloat(tdee),
      bodyFat: bodyFat ? parseFloat(bodyFat) : null,
      age: parseInt(age),
      gender,
      goal
    };

    if (isNaN(metrics.bmi) || isNaN(metrics.bmr) || isNaN(metrics.tdee) || isNaN(metrics.age)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid numeric values for health metrics'
      });
    }

    if (!['male', 'female'].includes(metrics.gender)) {
      return res.status(400).json({
        success: false,
        message: 'Gender must be male or female'
      });
    }

    const validGoals = ['lose_weight', 'gain_weight', 'maintain_weight', 'build_muscle', 'improve_health'];
    if (!validGoals.includes(metrics.goal)) {
      return res.status(400).json({
        success: false,
        message: `Goal must be one of: ${validGoals.join(', ')}`
      });
    }

    if (!['en', 'si'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Language must be "en" or "si"'
      });
    }

    const response = await analyzeHealthMetrics(metrics, language);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const mealSuggestions = async (req, res, next) => {
  try {
    const { goal, dietaryRestrictions = [], preferredCuisine = 'any', language = 'en' } = req.body;

    if (!goal || typeof goal !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Goal is required and must be a string'
      });
    }

    if (!Array.isArray(dietaryRestrictions)) {
      return res.status(400).json({
        success: false,
        message: 'Dietary restrictions must be an array'
      });
    }

    if (!['en', 'si'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Language must be "en" or "si"'
      });
    }

    const response = await suggestMealsByGoal(goal, dietaryRestrictions, preferredCuisine, language);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

export default {
  chat,
  quickAnswer,
  analyzeHealth,
  mealSuggestions
};
