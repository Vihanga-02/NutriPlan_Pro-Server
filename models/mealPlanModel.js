import { query } from '../config/database.js';

export const createMealPlan = async (mealPlanData) => {
  const { user_id, goal_type, target_weight_change, start_date, end_date, daily_calorie_target } = mealPlanData;
  
  const result = await query(
    `INSERT INTO meal_plans (user_id, goal_type, target_weight_change, start_date, end_date, daily_calorie_target)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user_id, goal_type, target_weight_change, start_date, end_date, daily_calorie_target]
  );
  
  return result.rows[0];
};

export const createMealPlanDay = async (dayData) => {
  const { meal_plan_id, plan_date } = dayData;
  
  const result = await query(
    `INSERT INTO meal_plan_days (meal_plan_id, plan_date)
     VALUES ($1, $2)
     ON CONFLICT (meal_plan_id, plan_date) DO UPDATE SET meal_plan_id = EXCLUDED.meal_plan_id
     RETURNING *`,
    [meal_plan_id, plan_date]
  );
  
  return result.rows[0];
};

export const createMealPlanMeal = async (mealData) => {
  const { meal_plan_day_id, meal_type, food_id, portion_size, calories, protein_g, carbs_g, fat_g } = mealData;
  
  const result = await query(
    `INSERT INTO meal_plan_meals (meal_plan_day_id, meal_type, food_id, portion_size, calories, protein_g, carbs_g, fat_g)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [meal_plan_day_id, meal_type, food_id, portion_size, calories, protein_g, carbs_g, fat_g]
  );
  
  return result.rows[0];
};

export const getMealPlansByUserId = async (userId) => {
  const result = await query(
    'SELECT * FROM meal_plans WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  return result.rows;
};

export const getMealPlanById = async (planId) => {
  const planResult = await query(
    'SELECT * FROM meal_plans WHERE id = $1',
    [planId]
  );
  
  if (planResult.rows.length === 0) return null;
  
  const plan = planResult.rows[0];
  
  const daysResult = await query(
    'SELECT * FROM meal_plan_days WHERE meal_plan_id = $1 ORDER BY plan_date',
    [planId]
  );
  
  const days = [];
  for (const day of daysResult.rows) {
    const mealsResult = await query(
      `SELECT mpm.*, f.name as food_name, f.image_url, f.category, f.price as food_price,
              (f.price * mpm.portion_size) as meal_price
       FROM meal_plan_meals mpm
       JOIN foods f ON mpm.food_id = f.id
       WHERE mpm.meal_plan_day_id = $1
       ORDER BY mpm.meal_type`,
      [day.id]
    );
    
    days.push({
      ...day,
      meals: mealsResult.rows
    });
  }
  
  return {
    ...plan,
    meal_plan_days: days
  };
};

export const trackMeal = async (trackingData) => {
  const { user_id, meal_plan_meal_id, log_date, status } = trackingData;
  
  const result = await query(
    `INSERT INTO meal_tracking (user_id, meal_plan_meal_id, log_date, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, meal_plan_meal_id) 
     DO UPDATE SET status = EXCLUDED.status, logged_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [user_id, meal_plan_meal_id, log_date, status]
  );
  
  return result.rows[0];
};

export const logExternalFood = async (logData) => {
  const { user_id, log_date, meal_type, food_name, calories } = logData;
  
  const result = await query(
    `INSERT INTO external_food_logs (user_id, log_date, meal_type, food_name, calories)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [user_id, log_date, meal_type, food_name, calories]
  );
  
  return result.rows[0];
};

export const logBodyMeasurement = async (measurementData) => {
  const { user_id, log_date, weight_kg, neck_cm, waist_cm, hip_cm, body_fat_pct, notes } = measurementData;
  
  const result = await query(
    `INSERT INTO body_measurements (user_id, log_date, weight_kg, neck_cm, waist_cm, hip_cm, body_fat_pct, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, log_date) 
     DO UPDATE SET weight_kg = EXCLUDED.weight_kg, neck_cm = EXCLUDED.neck_cm, 
                   waist_cm = EXCLUDED.waist_cm, hip_cm = EXCLUDED.hip_cm, 
                   body_fat_pct = EXCLUDED.body_fat_pct, notes = EXCLUDED.notes
     RETURNING *`,
    [user_id, log_date, weight_kg, neck_cm, waist_cm, hip_cm, body_fat_pct, notes]
  );
  
  return result.rows[0];
};

export const getBodyMeasurements = async (userId, startDate, endDate) => {
  let sql = 'SELECT * FROM body_measurements WHERE user_id = $1';
  const params = [userId];
  let paramCount = 2;
  
  if (startDate) {
    sql += ` AND log_date >= $${paramCount}`;
    params.push(startDate);
    paramCount++;
  }
  if (endDate) {
    sql += ` AND log_date <= $${paramCount}`;
    params.push(endDate);
  }
  
  sql += ' ORDER BY log_date ASC';
  
  const result = await query(sql, params);
  return result.rows;
};

export const getMealTracking = async (userId, startDate, endDate) => {
  let sql = `
    SELECT 
      mt.*,
      mpm.meal_type,
      mpm.calories,
      mpm.protein_g,
      mpm.carbs_g,
      mpm.fat_g,
      f.name as food_name
    FROM meal_tracking mt
    JOIN meal_plan_meals mpm ON mt.meal_plan_meal_id = mpm.id
    JOIN foods f ON mpm.food_id = f.id
    WHERE mt.user_id = $1
  `;
  const params = [userId];
  let paramCount = 2;
  
  if (startDate) {
    sql += ` AND mt.log_date >= $${paramCount}`;
    params.push(startDate);
    paramCount++;
  }
  if (endDate) {
    sql += ` AND mt.log_date <= $${paramCount}`;
    params.push(endDate);
  }
  
  sql += ' ORDER BY mt.log_date DESC';
  
  const result = await query(sql, params);
  return result.rows;
};

export const calculateMealPlanTotalPrice = async (mealPlanId) => {
  const result = await query(
    `SELECT COALESCE(SUM(f.price * mpm.portion_size), 0) as total_price
     FROM meal_plan_meals mpm
     JOIN foods f ON mpm.food_id = f.id
     JOIN meal_plan_days mpd ON mpm.meal_plan_day_id = mpd.id
     WHERE mpd.meal_plan_id = $1`,
    [mealPlanId]
  );
  
  return parseFloat(result.rows[0]?.total_price || 0);
};

export default {
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
};
