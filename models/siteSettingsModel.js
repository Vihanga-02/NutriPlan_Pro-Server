import { query } from '../config/database.js';

/**
 * Get site settings (singleton - only one row exists)
 */
export const getSiteSettings = async () => {
  const result = await query(
    'SELECT * FROM site_settings WHERE id = 1'
  );
  
  if (result.rows.length === 0) {
    // If no settings exist, create default ones
    return await createDefaultSettings();
  }
  
  return result.rows[0];
};

/**
 * Create default site settings
 */
const createDefaultSettings = async () => {
  const result = await query(
    `INSERT INTO site_settings (id, name, email, phone, address, delivery_radius, min_order_amount, email_orders, email_customers, sms_orders)
     VALUES (1, 'NutriPlan Pro', 'contact@nutriplan.com', '+1234567890', '123 Health Street, Wellness City', 10.00, 15.00, TRUE, TRUE, FALSE)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       address = EXCLUDED.address,
       delivery_radius = EXCLUDED.delivery_radius,
       min_order_amount = EXCLUDED.min_order_amount,
       email_orders = EXCLUDED.email_orders,
       email_customers = EXCLUDED.email_customers,
       sms_orders = EXCLUDED.sms_orders,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`
  );
  
  return result.rows[0];
};

/**
 * Update site settings
 */
export const updateSiteSettings = async (settingsData) => {
  const {
    name,
    email,
    phone,
    address,
    delivery_radius,
    min_order_amount,
    email_orders,
    email_customers,
    sms_orders
  } = settingsData;

  const result = await query(
    `UPDATE site_settings 
     SET 
       name = $1,
       email = $2,
       phone = $3,
       address = $4,
       delivery_radius = $5,
       min_order_amount = $6,
       email_orders = $7,
       email_customers = $8,
       sms_orders = $9,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = 1
     RETURNING *`,
    [
      name,
      email,
      phone,
      address,
      delivery_radius,
      min_order_amount,
      email_orders,
      email_customers,
      sms_orders
    ]
  );

  if (result.rows.length === 0) {
    // If no row exists, create it with the provided values
    return await createDefaultSettings();
  }

  return result.rows[0];
};

/**
 * Update restaurant information only
 */
export const updateRestaurantInfo = async (restaurantData) => {
  const { name, email, phone, address, delivery_radius, min_order_amount } = restaurantData;

  const result = await query(
    `UPDATE site_settings 
     SET 
       name = $1,
       email = $2,
       phone = $3,
       address = $4,
       delivery_radius = $5,
       min_order_amount = $6,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = 1
     RETURNING *`,
    [name, email, phone, address, delivery_radius, min_order_amount]
  );

  if (result.rows.length === 0) {
    // If no row exists, create default settings first
    await createDefaultSettings();
    return await updateRestaurantInfo(restaurantData);
  }

  return result.rows[0];
};

/**
 * Update notification settings only
 */
export const updateNotificationSettings = async (notificationData) => {
  const { email_orders, email_customers, sms_orders } = notificationData;

  const result = await query(
    `UPDATE site_settings 
     SET 
       email_orders = $1,
       email_customers = $2,
       sms_orders = $3,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = 1
     RETURNING *`,
    [email_orders, email_customers, sms_orders]
  );

  if (result.rows.length === 0) {
    // If no row exists, create default settings first
    await createDefaultSettings();
    return await updateNotificationSettings(notificationData);
  }

  return result.rows[0];
};

export default {
  getSiteSettings,
  updateSiteSettings,
  updateRestaurantInfo,
  updateNotificationSettings
};
