import admin from '../config/firebaseAdmin.js';
import { getUserByEmail } from '../models/userModel.js';

export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Allow requests without auth (for guest orders)
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    // Verify Firebase token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      // If token is invalid, allow as guest
      req.user = null;
      return next();
    }

    // Get user from database using email
    const userData = await getUserByEmail(decodedToken.email);

    if (userData) {
      req.user = userData;
      req.firebaseUser = decodedToken;
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    // On error, allow as guest
    req.user = null;
    next();
  }
};

export const requireAdmin = async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export default { authenticateUser, requireAdmin };
