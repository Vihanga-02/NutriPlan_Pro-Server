import {
  createFood,
  getAllFoods,
  getFoodById,
  updateFood,
  deleteFood,
  addFoodMealType,
  removeFoodMealType,
  getFoodsByMealType
} from '../models/foodModel.js';
import { getCurrentMealType, suggestFoodsForHealthScreening } from '../services/aiService.js';

export const create = async (req, res) => {
  try {
    const foodData = req.body;
    const mealTypes = foodData.meal_types || [];
    delete foodData.meal_types;

    const food = await createFood(foodData);

    for (const mealType of mealTypes) {
      await addFoodMealType(food.id, mealType);
    }

    res.status(201).json(food);
  } catch (error) {
    console.error('Create food error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const { category, is_active } = req.query;
    const foods = await getAllFoods(
      category || null,
      is_active !== undefined ? is_active === 'true' : true
    );
    res.json(foods);
  } catch (error) {
    console.error('Get all foods error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const food = await getFoodById(parseInt(id));

    if (!food) {
      return res.status(404).json({ error: 'Food not found' });
    }

    res.json(food);
  } catch (error) {
    console.error('Get food by id error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const mealTypes = updates.meal_types;
    delete updates.meal_types;

    const food = await updateFood(parseInt(id), updates);

    if (mealTypes) {
      const currentFood = await getFoodById(parseInt(id));
      const currentMealTypes = currentFood.food_meal_types?.map(fmt => fmt.meal_type) || [];

      const toAdd = mealTypes.filter(mt => !currentMealTypes.includes(mt));
      const toRemove = currentMealTypes.filter(mt => !mealTypes.includes(mt));

      for (const mealType of toAdd) {
        await addFoodMealType(parseInt(id), mealType);
      }
      for (const mealType of toRemove) {
        await removeFoodMealType(parseInt(id), mealType);
      }
    }

    res.json(food);
  } catch (error) {
    console.error('Update food error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteFood(parseInt(id));
    res.json({ message: 'Food deleted successfully' });
  } catch (error) {
    console.error('Delete food error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getByMealType = async (req, res) => {
  try {
    const { mealType } = req.params;
    const foods = await getFoodsByMealType(mealType);
    res.json(foods);
  } catch (error) {
    console.error('Get foods by meal type error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const suggestFoods = async (req, res) => {
  try {
    const { bmi, tdee, body_fat_pct, meal_type } = req.query;
    
    if (!bmi || !tdee) {
      return res.status(400).json({ error: 'BMI and TDEE are required' });
    }

    // Use meal_type from client if provided, otherwise determine from server time
    let mealType = meal_type || getCurrentMealType();
    
    // Validate meal type
    const validMealTypes = ['breakfast', 'lunch', 'teatime', 'dinner'];
    if (mealType && !validMealTypes.includes(mealType)) {
      return res.status(400).json({ error: 'Invalid meal type' });
    }
    
    if (!mealType) {
      return res.json({
        mealType: null,
        message: 'No meal suggestions available outside meal hours (6 AM - 11 PM)',
        foods: []
      });
    }

    // Get all available foods
    const availableFoods = await getAllFoods();
    
    // Suggest foods based on health metrics
    const suggestedFoods = await suggestFoodsForHealthScreening(
      parseFloat(bmi),
      parseFloat(tdee),
      body_fat_pct ? parseFloat(body_fat_pct) : null,
      availableFoods,
      mealType
    );

    if (suggestedFoods.length === 0) {
      const expectedCategory = mealType === 'teatime' ? 'bakery' : 'restaurant';
      return res.json({
        mealType,
        message: `No ${expectedCategory} food suggestions available for ${mealType}. Please ensure ${expectedCategory} foods are available in the menu.`,
        foods: []
      });
    }

    res.json({
      mealType,
      message: `Suggested ${mealType} options based on your health metrics`,
      foods: suggestedFoods
    });
  } catch (error) {
    console.error('Suggest foods error:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  create,
  getAll,
  getById,
  update,
  remove,
  getByMealType,
  suggestFoods
};
