import { GoogleGenerativeAI } from '@google/generative-ai';
import geminiConfig from '../config/gemini.js';

let genAI = null;
let model = null;

if (geminiConfig.apiKey) {
  genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
  model = genAI.getGenerativeModel({ model: geminiConfig.model });
}

export const generateMealPlan = async (userProfile, availableFoods, dailyCalorieTarget, preferences = {}) => {
  if (!model) {
    return generateFallbackMealPlan(availableFoods, dailyCalorieTarget);
  }

  const prompt = `You are a nutrition expert AI. Generate a diverse 14-day meal plan based on the following criteria:

User Profile:
- Age: ${userProfile.age}
- Gender: ${userProfile.gender}
- Weight: ${userProfile.weight_kg}kg
- Height: ${userProfile.height_cm}cm
- Activity Level: ${userProfile.activity_level}
- Daily Calorie Target: ${dailyCalorieTarget} calories

Available Foods (with nutritional info):
${JSON.stringify(availableFoods, null, 2)}

Requirements:
1. Each day should have 4 meals: breakfast, lunch, teatime, dinner
2. Daily total calories should be within ±100 calories of the target (${dailyCalorieTarget})
3. Maximize variety across the 14 days
4. Consider meal types (some foods are better for breakfast, others for dinner)
5. Balance macronutrients (protein, carbs, fats)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "day": 1,
    "meals": {
      "breakfast": [{"food_id": 1, "portion_size": 1.0}],
      "lunch": [{"food_id": 2, "portion_size": 1.5}],
      "teatime": [{"food_id": 3, "portion_size": 1.0}],
      "dinner": [{"food_id": 4, "portion_size": 1.0}]
    }
  }
]

Do not include any explanations, just the JSON array.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const mealPlan = JSON.parse(jsonMatch[0]);
      return mealPlan;
    }

    return generateFallbackMealPlan(availableFoods, dailyCalorieTarget);
  } catch (error) {
    console.error('AI meal plan generation error:', error);
    return generateFallbackMealPlan(availableFoods, dailyCalorieTarget);
  }
};

const generateFallbackMealPlan = (availableFoods, dailyCalorieTarget) => {
  const mealPlan = [];
  const mealTypes = ['breakfast', 'lunch', 'teatime', 'dinner'];
  const caloriesPerMeal = dailyCalorieTarget / 4;

  const foodsByMealType = {};
  mealTypes.forEach(type => {
    foodsByMealType[type] = availableFoods.filter(food => {
      // Handle both array format (from PostgreSQL) and object format
      if (Array.isArray(food.meal_types)) {
        return food.meal_types.includes(type);
      }
      if (food.food_meal_types) {
        return food.food_meal_types.some(fmt => fmt.meal_type === type);
      }
      return false;
    });
  });

  for (let day = 1; day <= 14; day++) {
    const dayMeals = { breakfast: [], lunch: [], teatime: [], dinner: [] };

    mealTypes.forEach(mealType => {
      const availableForMeal = foodsByMealType[mealType];
      if (availableForMeal.length === 0) return;

      let remainingCalories = caloriesPerMeal;
      const selectedFoods = [];

      while (remainingCalories > 100 && selectedFoods.length < 3) {
        const randomFood = availableForMeal[Math.floor(Math.random() * availableForMeal.length)];
        const portionSize = Math.max(0.5, Math.min(2, remainingCalories / randomFood.calories));

        selectedFoods.push({
          food_id: randomFood.id,
          portion_size: Math.round(portionSize * 10) / 10
        });

        remainingCalories -= randomFood.calories * portionSize;
      }

      dayMeals[mealType] = selectedFoods;
    });

    mealPlan.push({ day, meals: dayMeals });
  }

  return mealPlan;
};

export const suggestSafeMeals = async (bmi, tdee, bodyFatPct, availableFoods) => {
  const maxCaloriesPerMeal = tdee * 0.3;

  const safeFoods = availableFoods.filter(food => {
    const isCalorieSafe = food.calories <= maxCaloriesPerMeal;
    const hasBalancedMacros = food.protein_g >= 5 && food.carbs_g <= 60;
    return isCalorieSafe && hasBalancedMacros;
  });

  return safeFoods.sort((a, b) => {
    const scoreA = (a.protein_g * 2) - (a.fat_g * 0.5) + (a.calories / 100);
    const scoreB = (b.protein_g * 2) - (b.fat_g * 0.5) + (b.calories / 100);
    return scoreB - scoreA;
  }).slice(0, 20);
};

export const getCurrentMealType = () => {
  const now = new Date();
  const hour = now.getHours();
  
  // Breakfast: 6-11 AM
  if (hour >= 6 && hour < 11) {
    return 'breakfast';
  }
  // Lunch: 11 AM - 3 PM
  if (hour >= 11 && hour < 15) {
    return 'lunch';
  }
  // Tea time: 3-6 PM
  if (hour >= 15 && hour < 18) {
    return 'teatime';
  }
  // Dinner: 6-11 PM
  if (hour >= 18 && hour < 23) {
    return 'dinner';
  }
  // After 11 PM to 6 AM: no suggestions
  return null;
};

export const suggestFoodsForHealthScreening = async (bmi, tdee, bodyFatPct, availableFoods, mealType) => {
  if (!mealType) {
    return []; // No suggestions outside meal hours
  }

  // Filter foods by category based on meal type:
  // - Restaurant foods: breakfast, lunch, dinner
  // - Bakery foods: teatime
  const foodsForMealType = availableFoods.filter(food => {
    if (mealType === 'teatime') {
      // Teatime: only bakery foods
      return food.category === 'bakery';
    } else {
      // Breakfast, lunch, dinner: only restaurant foods
      return food.category === 'restaurant';
    }
  });

  if (foodsForMealType.length === 0) {
    return [];
  }

  // Calculate max calories per meal (30% of TDEE)
  const maxCaloriesPerMeal = tdee * 0.3;
  const caloriesPerMeal = tdee / 4; // Average calories per meal

  // Filter foods based on health metrics - relaxed criteria
  let filteredFoods = foodsForMealType.filter(food => {
    // Ensure calories are reasonable for a single meal (relaxed lower bound)
    const isCalorieAppropriate = food.calories <= maxCaloriesPerMeal && food.calories >= 50; // Minimum 50 calories
    
    // For overweight/obese users, prefer lower calorie, higher protein options
    if (bmi >= 25) {
      return isCalorieAppropriate && food.protein_g >= 3 && food.calories <= caloriesPerMeal * 1.5;
    }
    
    // For underweight users, allow higher calorie options
    if (bmi < 18.5) {
      return isCalorieAppropriate && food.calories <= caloriesPerMeal * 2.0;
    }
    
    // Normal weight: balanced approach (relaxed protein requirement)
    return isCalorieAppropriate && food.protein_g >= 3;
  });

  // If no foods match strict criteria, relax filters even more
  if (filteredFoods.length === 0) {
    filteredFoods = foodsForMealType.filter(food => food.calories <= maxCaloriesPerMeal * 1.5);
  }

  // If still no foods, just return all foods for this meal type (last resort)
  if (filteredFoods.length === 0) {
    filteredFoods = foodsForMealType;
  }

  // Score and sort foods
  const scoredFoods = filteredFoods.map(food => {
    let score = 0;
    
    // Higher protein is better
    score += food.protein_g * 2;
    
    // Moderate carbs preferred
    if (food.carbs_g >= 10 && food.carbs_g <= 60) {
      score += 5;
    }
    
    // Lower fat is generally better (but not too low)
    if (food.fat_g >= 3 && food.fat_g <= 20) {
      score += 3;
    }
    
    // Prefer foods closer to ideal meal calories
    const calorieDiff = Math.abs(food.calories - caloriesPerMeal);
    score += (1000 - calorieDiff) / 10;
    
    // For overweight users, penalize high calorie foods
    if (bmi >= 25 && food.calories > caloriesPerMeal) {
      score -= (food.calories - caloriesPerMeal) / 5;
    }
    
    return { ...food, score };
  });

  // Sort by score and return top 3
  return scoredFoods
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score, ...food }) => food); // Remove score from returned objects
};

export default {
  generateMealPlan,
  suggestSafeMeals,
  getCurrentMealType,
  suggestFoodsForHealthScreening
};
