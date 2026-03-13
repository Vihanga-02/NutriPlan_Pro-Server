import { query } from '../config/database.js';

export const createOrder = async (orderData, items) => {
  const { user_id, customer_name, contact_number, delivery_address, total_amount, order_status = 'pending', order_type = 'food', meal_plan_id = null } = orderData;
  
  const orderResult = await query(
    `INSERT INTO orders (user_id, customer_name, contact_number, delivery_address, total_amount, order_status, order_type, meal_plan_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [user_id, customer_name, contact_number, delivery_address, total_amount, order_status, order_type, meal_plan_id]
  );
  
  const order = orderResult.rows[0];
  
  const itemsData = [];
  if (items && items.length > 0) {
    for (const item of items) {
      const itemResult = await query(
        `INSERT INTO order_items (order_id, food_id, quantity, price)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [order.id, item.food_id, item.quantity, item.price]
      );
      itemsData.push(itemResult.rows[0]);
    }
  }
  
  return { ...order, items: itemsData };
};

export const getOrderById = async (orderId) => {
  const orderResult = await query(
    'SELECT * FROM orders WHERE id = $1',
    [orderId]
  );
  
  if (orderResult.rows.length === 0) return null;
  
  const order = orderResult.rows[0];
  
  // Get order items (only for food orders)
  let itemsResult = { rows: [] };
  if (order.order_type === 'food') {
    itemsResult = await query(
      `SELECT oi.*, f.name, f.image_url, f.category
       FROM order_items oi
       JOIN foods f ON oi.food_id = f.id
       WHERE oi.order_id = $1`,
      [orderId]
    );
  }
  
  // Get meal plan details if it's a diet plan order
  let mealPlan = null;
  if (order.order_type === 'diet_plan' && order.meal_plan_id) {
    const mealPlanResult = await query(
      'SELECT * FROM meal_plans WHERE id = $1',
      [order.meal_plan_id]
    );
    if (mealPlanResult.rows.length > 0) {
      mealPlan = mealPlanResult.rows[0];
      
      // Get meal plan days with meals and prices
      const daysResult = await query(
        'SELECT * FROM meal_plan_days WHERE meal_plan_id = $1 ORDER BY plan_date',
        [order.meal_plan_id]
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
      
      mealPlan.meal_plan_days = days;
    }
  }
  
  return {
    ...order,
    order_items: itemsResult.rows,
    meal_plan: mealPlan
  };
};

export const getOrdersByUserId = async (userId) => {
  const ordersResult = await query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  const orders = [];
  for (const order of ordersResult.rows) {
    // Get order items (only for food orders)
    let itemsResult = { rows: [] };
    if (order.order_type === 'food') {
      itemsResult = await query(
        `SELECT oi.*, f.name, f.image_url, f.category
         FROM order_items oi
         JOIN foods f ON oi.food_id = f.id
         WHERE oi.order_id = $1`,
        [order.id]
      );
    }
    
    // Get meal plan details if it's a diet plan order
    let mealPlan = null;
    if (order.order_type === 'diet_plan' && order.meal_plan_id) {
      const mealPlanResult = await query(
        'SELECT * FROM meal_plans WHERE id = $1',
        [order.meal_plan_id]
      );
      if (mealPlanResult.rows.length > 0) {
        mealPlan = mealPlanResult.rows[0];
        
        // Get meal plan days with meals and prices
        const daysResult = await query(
          'SELECT * FROM meal_plan_days WHERE meal_plan_id = $1 ORDER BY plan_date',
          [order.meal_plan_id]
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
        
        mealPlan.meal_plan_days = days;
      }
    }
    
    orders.push({
      ...order,
      order_items: itemsResult.rows,
      meal_plan: mealPlan
    });
  }
  
  return orders;
};

export const getAllOrders = async () => {
  const ordersResult = await query(
    'SELECT * FROM orders ORDER BY created_at DESC'
  );
  
  const orders = [];
  for (const order of ordersResult.rows) {
    // Get order items (only for food orders)
    let itemsResult = { rows: [] };
    if (order.order_type === 'food') {
      itemsResult = await query(
        `SELECT oi.*, f.name, f.image_url, f.category
         FROM order_items oi
         JOIN foods f ON oi.food_id = f.id
         WHERE oi.order_id = $1`,
        [order.id]
      );
    }
    
    // Get meal plan details if it's a diet plan order
    let mealPlan = null;
    if (order.order_type === 'diet_plan' && order.meal_plan_id) {
      const mealPlanResult = await query(
        'SELECT * FROM meal_plans WHERE id = $1',
        [order.meal_plan_id]
      );
      if (mealPlanResult.rows.length > 0) {
        mealPlan = mealPlanResult.rows[0];
        
        // Get meal plan days with meals and prices
        const daysResult = await query(
          'SELECT * FROM meal_plan_days WHERE meal_plan_id = $1 ORDER BY plan_date',
          [order.meal_plan_id]
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
        
        mealPlan.meal_plan_days = days;
      }
    }
    
    orders.push({
      ...order,
      order_items: itemsResult.rows,
      meal_plan: mealPlan
    });
  }
  
  return orders;
};

export const updateOrderStatus = async (orderId, status) => {
  const result = await query(
    'UPDATE orders SET order_status = $1 WHERE id = $2 RETURNING *',
    [status, orderId]
  );
  
  return result.rows[0] || null;
};

export const getOrderStats = async () => {
  const result = await query(
    `SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COUNT(*) FILTER (WHERE order_status = 'pending') as pending_orders,
      COUNT(*) FILTER (WHERE order_status = 'confirmed') as confirmed_orders,
      COUNT(*) FILTER (WHERE order_status = 'delivered') as delivered_orders
     FROM orders`
  );
  
  const row = result.rows[0];
  return {
    totalOrders: parseInt(row.total_orders),
    totalRevenue: parseFloat(row.total_revenue) || 0,
    pendingOrders: parseInt(row.pending_orders),
    confirmedOrders: parseInt(row.confirmed_orders),
    deliveredOrders: parseInt(row.delivered_orders)
  };
};

export default {
  createOrder,
  getOrderById,
  getOrdersByUserId,
  getAllOrders,
  updateOrderStatus,
  getOrderStats
};
