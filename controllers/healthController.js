import {
  createHealthProfile,
  getHealthProfileByUserId,
  updateHealthProfile,
  calculateBMR,
  calculateTDEE
} from '../models/healthProfileModel.js';

export const createProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profileData = req.body;

    const existingProfile = await getHealthProfileByUserId(userId);
    if (existingProfile) {
      return res.status(400).json({ error: 'Health profile already exists' });
    }

    const bmr = calculateBMR(
      profileData.weight_kg,
      profileData.height_cm,
      profileData.age,
      profileData.gender
    );
    const tdee = calculateTDEE(bmr, profileData.activity_level);

    const profile = await createHealthProfile({
      ...profileData,
      user_id: userId,
      bmr,
      tdee
    });

    // Convert string numeric values to numbers
    const formattedProfile = {
      ...profile,
      bmi: profile.bmi ? parseFloat(profile.bmi) : null,
      bmr: profile.bmr ? parseFloat(profile.bmr) : null,
      tdee: profile.tdee ? parseFloat(profile.tdee) : null,
      body_fat_pct: profile.body_fat_pct ? parseFloat(profile.body_fat_pct) : null,
      height_cm: profile.height_cm ? parseFloat(profile.height_cm) : null,
      weight_kg: profile.weight_kg ? parseFloat(profile.weight_kg) : null,
      neck_cm: profile.neck_cm ? parseFloat(profile.neck_cm) : null,
      waist_cm: profile.waist_cm ? parseFloat(profile.waist_cm) : null,
      hip_cm: profile.hip_cm ? parseFloat(profile.hip_cm) : null,
      age: profile.age ? parseInt(profile.age) : null,
    };

    res.status(201).json(formattedProfile);
  } catch (error) {
    console.error('Create health profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await getHealthProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({ error: 'Health profile not found' });
    }

    // Convert string numeric values to numbers (PostgreSQL returns NUMERIC as strings)
    const formattedProfile = {
      ...profile,
      bmi: profile.bmi ? parseFloat(profile.bmi) : null,
      bmr: profile.bmr ? parseFloat(profile.bmr) : null,
      tdee: profile.tdee ? parseFloat(profile.tdee) : null,
      body_fat_pct: profile.body_fat_pct ? parseFloat(profile.body_fat_pct) : null,
      height_cm: profile.height_cm ? parseFloat(profile.height_cm) : null,
      weight_kg: profile.weight_kg ? parseFloat(profile.weight_kg) : null,
      neck_cm: profile.neck_cm ? parseFloat(profile.neck_cm) : null,
      waist_cm: profile.waist_cm ? parseFloat(profile.waist_cm) : null,
      hip_cm: profile.hip_cm ? parseFloat(profile.hip_cm) : null,
      age: profile.age ? parseInt(profile.age) : null,
    };

    res.json(formattedProfile);
  } catch (error) {
    console.error('Get health profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    if (updates.weight_kg || updates.height_cm || updates.age || updates.activity_level) {
      const currentProfile = await getHealthProfileByUserId(userId);

      const weight = updates.weight_kg || currentProfile.weight_kg;
      const height = updates.height_cm || currentProfile.height_cm;
      const age = updates.age || currentProfile.age;
      const activityLevel = updates.activity_level || currentProfile.activity_level;
      const gender = updates.gender || currentProfile.gender;

      updates.bmr = calculateBMR(weight, height, age, gender);
      updates.tdee = calculateTDEE(updates.bmr, activityLevel);
    }

    const profile = await updateHealthProfile(userId, updates);
    
    // Convert string numeric values to numbers
    const formattedProfile = {
      ...profile,
      bmi: profile.bmi ? parseFloat(profile.bmi) : null,
      bmr: profile.bmr ? parseFloat(profile.bmr) : null,
      tdee: profile.tdee ? parseFloat(profile.tdee) : null,
      body_fat_pct: profile.body_fat_pct ? parseFloat(profile.body_fat_pct) : null,
      height_cm: profile.height_cm ? parseFloat(profile.height_cm) : null,
      weight_kg: profile.weight_kg ? parseFloat(profile.weight_kg) : null,
      neck_cm: profile.neck_cm ? parseFloat(profile.neck_cm) : null,
      waist_cm: profile.waist_cm ? parseFloat(profile.waist_cm) : null,
      hip_cm: profile.hip_cm ? parseFloat(profile.hip_cm) : null,
      age: profile.age ? parseInt(profile.age) : null,
    };
    
    res.json(formattedProfile);
  } catch (error) {
    console.error('Update health profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const calculateHealthMetrics = async (req, res) => {
  try {
    const { age, gender, height_cm, weight_kg, neck_cm, waist_cm, hip_cm, activity_level } = req.body;

    if (!age || !gender || !height_cm || !weight_kg) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bmi = weight_kg / Math.pow(height_cm / 100, 2);
    const bmr = calculateBMR(weight_kg, height_cm, age, gender);
    const tdee = calculateTDEE(bmr, activity_level || 'sedentary');

    let bodyFatPct = null;
    if (neck_cm && waist_cm && height_cm) {
      const h_in = height_cm / 2.54;
      const w_in = waist_cm / 2.54;
      const n_in = neck_cm / 2.54;

      if (gender === 'male') {
        const x = w_in - n_in;
        if (x > 0 && h_in > 0) {
          bodyFatPct = (86.010 * Math.log10(x)) - (70.041 * Math.log10(h_in)) + 36.76;
        }
      } else if (gender === 'female' && hip_cm) {
        const hip_in = hip_cm / 2.54;
        const x = w_in + hip_in - n_in;
        if (x > 0 && h_in > 0) {
          bodyFatPct = (163.205 * Math.log10(x)) - (97.684 * Math.log10(h_in)) - 78.387;
        }
      }
    }

    res.json({
      bmi: Math.round(bmi * 100) / 100,
      bmr: Math.round(bmr * 100) / 100,
      tdee: Math.round(tdee * 100) / 100,
      body_fat_pct: bodyFatPct ? Math.round(bodyFatPct * 100) / 100 : null
    });
  } catch (error) {
    console.error('Calculate health metrics error:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  createProfile,
  getProfile,
  updateProfile,
  calculateHealthMetrics
};
