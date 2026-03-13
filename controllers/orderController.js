import {
  createOrder,
  getOrderById,
  getOrdersByUserId,
  getAllOrders,
  updateOrderStatus,
  getOrderStats
} from '../models/orderModel.js';

export const create = async (req, res) => {
  try {
    const { customer_name, contact_number, delivery_address, items, total_amount, order_type = 'food', meal_plan_id = null } = req.body;

    if (!customer_name || !contact_number || !delivery_address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // For food orders, items are required
    if (order_type === 'food' && (!items || items.length === 0)) {
      return res.status(400).json({ error: 'Food orders require items' });
    }

    // For diet plan orders, meal_plan_id is required
    if (order_type === 'diet_plan' && !meal_plan_id) {
      return res.status(400).json({ error: 'Diet plan orders require meal_plan_id' });
    }

    // Calculate total if not provided
    let calculatedTotal = total_amount;
    if (!calculatedTotal) {
      if (order_type === 'food' && items && items.length > 0) {
        calculatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      } else if (order_type === 'diet_plan') {
        // For diet plan orders, you might want to set a fixed price or calculate based on meal plan
        calculatedTotal = 0; // Set to 0 or calculate based on your pricing model
      }
    }

    const orderData = {
      user_id: req.user?.id || null, // Allow guest orders
      customer_name,
      contact_number,
      delivery_address,
      total_amount: calculatedTotal,
      order_status: 'pending',
      order_type,
      meal_plan_id
    };

    const order = await createOrder(orderData, items || []);
    res.status(201).json(formatOrder(order));
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to format order numeric values
const formatOrder = (order) => {
  if (!order) return null;
  
  const formatted = {
    ...order,
    total_amount: order.total_amount ? parseFloat(order.total_amount) : 0,
  };
  
  // Format order_items if they exist
  if (order.order_items && Array.isArray(order.order_items)) {
    formatted.order_items = order.order_items.map(item => ({
      ...item,
      price: item.price ? parseFloat(item.price) : 0,
      quantity: item.quantity ? parseInt(item.quantity) : 0
    }));
  }
  
  // Format items if they exist (alternative property name from createOrder)
  if (order.items && Array.isArray(order.items)) {
    formatted.items = order.items.map(item => ({
      ...item,
      price: item.price ? parseFloat(item.price) : 0,
      quantity: item.quantity ? parseInt(item.quantity) : 0
    }));
  }
  
  return formatted;
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await getOrderById(parseInt(id));

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user && order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(formatOrder(order));
  } catch (error) {
    console.error('Get order by id error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await getOrdersByUserId(userId);
    res.json(orders.map(formatOrder));
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const orders = await getAllOrders();
    res.json(orders.map(formatOrder));
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await updateOrderStatus(parseInt(id), status);
    res.json(formatOrder(order));
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getStats = async (req, res) => {
  try {
    const stats = await getOrderStats();
    res.json(stats);
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  create,
  getById,
  getUserOrders,
  getAll,
  updateStatus,
  getStats
};
