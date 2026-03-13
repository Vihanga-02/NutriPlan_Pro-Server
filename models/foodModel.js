import { query } from '../config/database.js';

export const createFood = async (foodData) => {
  const {
    name,
    category,
    calories,
    protein_g = 0,
    carbs_g = 0,
    fat_g = 0,
    price,
    image_url = '',
    tags = {},
    is_active = true
  } = foodData;

  const result = await query(
    `INSERT INTO foods (name, category, calories, protein_g, carbs_g, fat_g, price, image_url, tags, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [name, category, calories, protein_g, carbs_g, fat_g, price, image_url, JSON.stringify(tags), is_active]
  );

  return result.rows[0];
};

export const getAllFoods = async (category = null, isActive = true) => {
  let sql = `
    SELECT 
      f.*,
      COALESCE(
        ARRAY_AGG(DISTINCT fmt.meal_type) FILTER (WHERE fmt.meal_type IS NOT NULL),
        ARRAY[]::VARCHAR[]
      ) as meal_types
    FROM foods f
    LEFT JOIN food_meal_types fmt ON f.id = fmt.food_id
    WHERE f.is_active = $1
  `;
  
  const params = [isActive];
  
  if (category) {
    sql += ' AND f.category = $2';
    params.push(category);
    sql += ' GROUP BY f.id ORDER BY f.created_at DESC';
  } else {
    sql += ' GROUP BY f.id ORDER BY f.created_at DESC';
  }

  const result = await query(sql, params);
  return result.rows;
};

export const getFoodById = async (foodId) => {
  const result = await query(
    `SELECT 
      f.*,
      COALESCE(
        ARRAY_AGG(DISTINCT fmt.meal_type) FILTER (WHERE fmt.meal_type IS NOT NULL),
        ARRAY[]::VARCHAR[]
      ) as meal_types
    FROM foods f
    LEFT JOIN food_meal_types fmt ON f.id = fmt.food_id
    WHERE f.id = $1
    GROUP BY f.id`,
    [foodId]
  );

  return result.rows[0] || null;
};

export const updateFood = async (foodId, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'tags' && typeof value === 'object') {
      fields.push(`${key} = $${paramCount}::jsonb`);
      values.push(JSON.stringify(value));
    } else {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
    }
    paramCount++;
  }

  values.push(foodId);
  const result = await query(
    `UPDATE foods SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows[0] || null;
};

export const deleteFood = async (foodId) => {
  await query('DELETE FROM foods WHERE id = $1', [foodId]);
  return true;
};

export const addFoodMealType = async (foodId, mealType) => {
  const result = await query(
    `INSERT INTO food_meal_types (food_id, meal_type)
     VALUES ($1, $2)
     ON CONFLICT (food_id, meal_type) DO NOTHING
     RETURNING *`,
    [foodId, mealType]
  );

  return result.rows[0] || null;
};

export const removeFoodMealType = async (foodId, mealType) => {
  await query(
    'DELETE FROM food_meal_types WHERE food_id = $1 AND meal_type = $2',
    [foodId, mealType]
  );
  return true;
};

export const getFoodsByMealType = async (mealType) => {
  const result = await query(
    `SELECT 
      f.*,
      COALESCE(
        ARRAY_AGG(DISTINCT fmt2.meal_type) FILTER (WHERE fmt2.meal_type IS NOT NULL),
        ARRAY[]::VARCHAR[]
      ) as meal_types
    FROM foods f
    INNER JOIN food_meal_types fmt ON f.id = fmt.food_id
    LEFT JOIN food_meal_types fmt2 ON f.id = fmt2.food_id
    WHERE fmt.meal_type = $1 AND f.is_active = true
    GROUP BY f.id
    ORDER BY f.created_at DESC`,
    [mealType]
  );

  return result.rows;
};

export default {
  createFood,
  getAllFoods,
  getFoodById,
  updateFood,
  deleteFood,
  addFoodMealType,
  removeFoodMealType,
  getFoodsByMealType
};
