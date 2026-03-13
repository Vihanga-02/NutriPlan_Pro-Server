import { query } from '../config/database.js';

export const createHealthProfile = async (profileData) => {
  const {
    user_id,
    age,
    gender,
    height_cm,
    weight_kg,
    neck_cm,
    waist_cm,
    hip_cm,
    activity_level,
    bmr,
    tdee,
    preferences = {}
  } = profileData;

  const result = await query(
    `INSERT INTO user_health_profiles 
     (user_id, age, gender, height_cm, weight_kg, neck_cm, waist_cm, hip_cm, activity_level, bmr, tdee, preferences)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [user_id, age, gender, height_cm, weight_kg, neck_cm, waist_cm, hip_cm, activity_level, bmr, tdee, JSON.stringify(preferences)]
  );

  return result.rows[0];
};

export const getHealthProfileByUserId = async (userId) => {
  const result = await query(
    'SELECT * FROM user_health_profiles WHERE user_id = $1',
    [userId]
  );

  return result.rows[0] || null;
};

export const updateHealthProfile = async (userId, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'preferences' && typeof value === 'object') {
      fields.push(`${key} = $${paramCount}::jsonb`);
      values.push(JSON.stringify(value));
    } else {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
    }
    paramCount++;
  }

  values.push(userId);
  const result = await query(
    `UPDATE user_health_profiles SET ${fields.join(', ')} WHERE user_id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows[0] || null;
};

export const calculateBMR = (weight, height, age, gender) => {
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === 'female') {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
  return 10 * weight + 6.25 * height - 5 * age - 78;
};

export const calculateTDEE = (bmr, activityLevel) => {
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725
  };
  return bmr * (multipliers[activityLevel] || 1.2);
};

export default {
  createHealthProfile,
  getHealthProfileByUserId,
  updateHealthProfile,
  calculateBMR,
  calculateTDEE
};
