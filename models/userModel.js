import { query } from '../config/database.js';

export const createUser = async (userData) => {
  const { email, password_hash, full_name, role = 'user', delivery_address = null, contact_number = null } = userData;
  
  try {
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role, delivery_address, contact_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [email, password_hash, full_name, role, delivery_address, contact_number]
    );
    
    return result.rows[0];
  } catch (error) {
    // Handle unique constraint violation (email already exists)
    if (error.code === '23505') {
      // User already exists, try to get it
      return await getUserByEmail(email);
    }
    throw error;
  }
};

export const getUserById = async (userId) => {
  const result = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  
  return result.rows[0] || null;
};

export const getUserByEmail = async (email) => {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  
  return result.rows[0] || null;
};

export const updateUser = async (userId, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${paramCount}`);
    values.push(value);
    paramCount++;
  }

  values.push(userId);
  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows[0] || null;
};

export const getAllUsers = async () => {
  const result = await query(
    'SELECT * FROM users ORDER BY created_at DESC'
  );
  
  return result.rows;
};

export const getAdmins = async () => {
  const result = await query(
    'SELECT id, email, full_name, role, created_at FROM users WHERE role = $1 ORDER BY created_at DESC',
    ['admin']
  );
  
  return result.rows;
};

export const deleteUser = async (userId) => {
  const result = await query(
    'DELETE FROM users WHERE id = $1 RETURNING *',
    [userId]
  );
  
  return result.rows[0] || null;
};

export default {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  getAllUsers,
  getAdmins,
  deleteUser
};
