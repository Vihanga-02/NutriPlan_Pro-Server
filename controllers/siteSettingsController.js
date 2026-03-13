import {
  getSiteSettings,
  updateSiteSettings,
  updateRestaurantInfo,
  updateNotificationSettings
} from '../models/siteSettingsModel.js';

/**
 * Get site settings (public endpoint - no auth required)
 */
export const get = async (req, res) => {
  try {
    const settings = await getSiteSettings();
    res.json(settings);
  } catch (error) {
    console.error('Get site settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update all site settings (admin only)
 */
export const update = async (req, res) => {
  try {
    const settingsData = req.body;
    
    // Validate required fields
    if (!settingsData.name || !settingsData.email || !settingsData.phone || !settingsData.address) {
      return res.status(400).json({ error: 'Missing required fields: name, email, phone, address' });
    }

    const settings = await updateSiteSettings(settingsData);
    res.json(settings);
  } catch (error) {
    console.error('Update site settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update restaurant information only (admin only)
 */
export const updateRestaurant = async (req, res) => {
  try {
    const restaurantData = req.body;
    
    // Validate required fields
    if (!restaurantData.name || !restaurantData.email || !restaurantData.phone || !restaurantData.address) {
      return res.status(400).json({ error: 'Missing required fields: name, email, phone, address' });
    }

    const settings = await updateRestaurantInfo(restaurantData);
    res.json(settings);
  } catch (error) {
    console.error('Update restaurant info error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update notification settings only (admin only)
 */
export const updateNotifications = async (req, res) => {
  try {
    const notificationData = req.body;
    
    // Validate fields exist
    if (notificationData.email_orders === undefined || 
        notificationData.email_customers === undefined || 
        notificationData.sms_orders === undefined) {
      return res.status(400).json({ error: 'Missing required fields: email_orders, email_customers, sms_orders' });
    }

    const settings = await updateNotificationSettings(notificationData);
    res.json(settings);
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  get,
  update,
  updateRestaurant,
  updateNotifications
};
