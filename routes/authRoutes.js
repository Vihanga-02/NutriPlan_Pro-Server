import express from 'express';
import { signup, login, logout, getCurrentUser, getAllUsers, createAdmin, createAdminByAdmin, updateProfile, getAdmins, deleteAdmin, updateAdminPassword, updateAdminProfile } from '../controllers/authController.js';
import { authenticateUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticateUser, getCurrentUser);
router.put('/profile', authenticateUser, updateProfile);
router.get('/users', authenticateUser, requireAdmin, getAllUsers);
// Public endpoint for creating admin account (no auth required - for initial setup)
router.post('/create-admin', createAdmin);
// Admin-only endpoint for creating admins from admin panel
router.post('/create-admin-secure', authenticateUser, requireAdmin, createAdminByAdmin);
// Admin management endpoints
router.get('/admins', authenticateUser, requireAdmin, getAdmins);
router.delete('/admins/:id', authenticateUser, requireAdmin, deleteAdmin);
// Admin self-management endpoints
router.put('/admin/password', authenticateUser, requireAdmin, updateAdminPassword);
router.put('/admin/profile', authenticateUser, requireAdmin, updateAdminProfile);

export default router;
