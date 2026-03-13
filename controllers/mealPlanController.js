import {
  createMealPlan,
  createMealPlanDay,
  createMealPlanMeal,
  getMealPlansByUserId,
  getMealPlanById,
  trackMeal,
  logExternalFood,
  logBodyMeasurement,
  getBodyMeasurements,
  getMealTracking,
  calculateMealPlanTotalPrice
} from '../models/mealPlanModel.js';
import { getHealthProfileByUserId, calculateTDEE } from '../models/healthProfileModel.js';
import { getAllFoods } from '../models/foodModel.js';
import { generateMealPlan } from '../services/aiService.js';

export const create = async (req, res) => {
  try {
    const userId = req.user.id;
    const { goal_type, target_weight_change, start_date } = req.body;

    if (!goal_type || !target_weight_change || !start_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (target_weight_change < 0.5 || target_weight_change > 2) {
      return res.status(400).json({ error: 'Weight change must be between 0.5 and 2.0 kg' });
    }

    const profile = await getHealthProfileByUserId(userId);
    if (!profile) {
      return res.status(400).json({ error: 'Health profile required to create meal plan' });
    }

    const calorieAdjustment = (target_weight_change * 7700) / 14;
    let dailyCalorieTarget = profile.tdee;

    if (goal_type === 'lose') {
      dailyCalorieTarget -= calorieAdjustment;
    } else {
      dailyCalorieTarget += calorieAdjustment;
    }

    const endDate = new Date(start_date);
    endDate.setDate(endDate.getDate() + 13);

    const mealPlanData = {
      user_id: userId,
      goal_type,
      target_weight_change,
      start_date,
      end_date: endDate.toISOString().split('T')[0],
      daily_calorie_target: Math.round(dailyCalorieTarget)
    };

    const mealPlan = await createMealPlan(mealPlanData);

    const availableFoods = await getAllFoods();
    const aiMealPlan = await generateMealPlan(profile, availableFoods, dailyCalorieTarget);

    for (let dayIndex = 0; dayIndex < 14; dayIndex++) {
      const dayDate = new Date(start_date);
      dayDate.setDate(dayDate.getDate() + dayIndex);

      const mealPlanDay = await createMealPlanDay({
        meal_plan_id: mealPlan.id,
        plan_date: dayDate.toISOString().split('T')[0]
      });

      const dayMeals = aiMealPlan[dayIndex]?.meals || {};
      const mealTypes = ['breakfast', 'lunch', 'teatime', 'dinner'];

      for (const mealType of mealTypes) {
        const meals = dayMeals[mealType] || [];

        for (const meal of meals) {
          const food = availableFoods.find(f => f.id === meal.food_id);
          if (!food) continue;

          await createMealPlanMeal({
            meal_plan_day_id: mealPlanDay.id,
            meal_type: mealType,
            food_id: meal.food_id,
            portion_size: meal.portion_size,
            calories: food.calories * meal.portion_size,
            protein_g: food.protein_g * meal.portion_size,
            carbs_g: food.carbs_g * meal.portion_size,
            fat_g: food.fat_g * meal.portion_size
          });
        }
      }
    }

    const completeMealPlan = await getMealPlanById(mealPlan.id);
    res.status(201).json(completeMealPlan);
  } catch (error) {
    console.error('Create meal plan error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getUserMealPlans = async (req, res) => {
  try {
    const userId = req.user.id;
    const mealPlans = await getMealPlansByUserId(userId);
    res.json(mealPlans);
  } catch (error) {
    console.error('Get user meal plans error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const mealPlan = await getMealPlanById(parseInt(id));

    if (!mealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    if (mealPlan.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(mealPlan);
  } catch (error) {
    console.error('Get meal plan by id error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const track = async (req, res) => {
  try {
    const userId = req.user.id;
    const { meal_plan_meal_id, log_date, status } = req.body;

    if (!meal_plan_meal_id || !log_date || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const tracking = await trackMeal({
      user_id: userId,
      meal_plan_meal_id,
      log_date,
      status
    });

    res.json(tracking);
  } catch (error) {
    console.error('Track meal error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const logExternal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { log_date, meal_type, food_name, calories } = req.body;

    if (!log_date || !food_name || !calories) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const log = await logExternalFood({
      user_id: userId,
      log_date,
      meal_type,
      food_name,
      calories
    });

    res.json(log);
  } catch (error) {
    console.error('Log external food error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const logMeasurement = async (req, res) => {
  try {
    const userId = req.user.id;
    const measurementData = { ...req.body, user_id: userId };

    const measurement = await logBodyMeasurement(measurementData);
    res.json(measurement);
  } catch (error) {
    console.error('Log body measurement error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getMeasurements = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date } = req.query;

    const measurements = await getBodyMeasurements(userId, start_date, end_date);
    res.json(measurements);
  } catch (error) {
    console.error('Get body measurements error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getTracking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date } = req.query;

    const tracking = await getMealTracking(userId, start_date, end_date);
    res.json(tracking);
  } catch (error) {
    console.error('Get meal tracking error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createOrderFromMealPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params; // meal_plan_id from route
    const { contact_number, delivery_address } = req.body;

    if (!contact_number || !delivery_address) {
      return res.status(400).json({ error: 'Missing required fields: contact_number, delivery_address' });
    }

    // Get meal plan
    const mealPlan = await getMealPlanById(parseInt(id));
    if (!mealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    // Verify meal plan belongs to user
    if (mealPlan.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user details
    const { getUserById } = await import('../models/userModel.js');
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate total price based on all meals and portion sizes
    const totalAmount = await calculateMealPlanTotalPrice(mealPlan.id);

    // Create order from meal plan
    const { createOrder } = await import('../models/orderModel.js');
    const orderData = {
      user_id: userId,
      customer_name: user.full_name,
      contact_number,
      delivery_address: delivery_address || user.delivery_address,
      total_amount: totalAmount,
      order_status: 'pending',
      order_type: 'diet_plan',
      meal_plan_id: mealPlan.id
    };

    const order = await createOrder(orderData, []); // No items for diet plan orders

    res.status(201).json({
      message: 'Diet plan order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order from meal plan error:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  create,
  getUserMealPlans,
  getById,
  track,
  logExternal,
  logMeasurement,
  getMeasurements,
  getTracking,
  createOrderFromMealPlan
};
