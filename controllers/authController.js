import admin, { isFirebaseInitialized } from '../config/firebaseAdmin.js';
import { createUser, getUserByEmail } from '../models/userModel.js';
import { createHealthProfile, calculateBMR, calculateTDEE } from '../models/healthProfileModel.js';

export const signup = async (req, res) => {
  try {
    const { email, password, full_name, age, gender, height_cm, weight_kg, neck_cm, waist_cm, hip_cm, activity_level, firebaseToken, contact_number, delivery_address } = req.body;

    if (!email || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let firebaseUser;
    
    // If Firebase token is provided (Google sign-in), verify it
    if (firebaseToken) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        firebaseUser = decodedToken;
      } catch (error) {
        return res.status(401).json({ error: 'Invalid Firebase token' });
      }
    } else if (password) {
      // Email/password signup - Firebase handles this on client side
      // We just need to verify the token from client
      return res.status(400).json({ error: 'Firebase token required. Please sign up through Firebase Auth first.' });
    } else {
      return res.status(400).json({ error: 'Either password or Firebase token required' });
    }

    // Check if user already exists
    let user = await getUserByEmail(email);
    
    if (!user) {
      // Create user in database
      user = await createUser({
        email: firebaseUser.email,
        password_hash: 'firebase_auth', // Placeholder since Firebase handles auth
        full_name,
        role: 'user',
        delivery_address: delivery_address || null,
        contact_number: contact_number || null
      });
    }

    // Create health profile if data provided
    if (age && gender && height_cm && weight_kg) {
      const existingProfile = await getUserByEmail(email);
      if (existingProfile) {
        const bmr = calculateBMR(weight_kg, height_cm, age, gender);
        const tdee = calculateTDEE(bmr, activity_level || 'sedentary');

        await createHealthProfile({
          user_id: user.id,
          age,
          gender,
          height_cm,
          weight_kg,
          neck_cm: neck_cm || null,
          waist_cm: waist_cm || null,
          hip_cm: hip_cm || null,
          activity_level: activity_level || 'sedentary',
          bmr,
          tdee
        });
      }
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { firebaseToken } = req.body;

    if (!firebaseToken) {
      return res.status(400).json({ error: 'Firebase token required' });
    }

    // Check if Firebase Admin is initialized
    if (!isFirebaseInitialized() || !admin.apps.length) {
      console.error('Firebase Admin not initialized');
      return res.status(500).json({ 
        error: 'Server configuration error. Firebase Admin is not properly configured. Please check your .env file and ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set correctly.' 
      });
    }

    // Verify Firebase token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    } catch (error) {
      console.error('Firebase token verification error:', error);
      return res.status(401).json({ error: 'Invalid or expired token: ' + error.message });
    }

    // Get or create user in database
    let user;
    try {
      user = await getUserByEmail(decodedToken.email);
    } catch (dbError) {
      console.error('Database error getting user:', dbError);
      return res.status(500).json({ error: 'Database error: ' + dbError.message });
    }
    
    if (!user) {
      try {
        // Create user if doesn't exist (for Google sign-in users)
        user = await createUser({
          email: decodedToken.email,
          password_hash: 'firebase_auth',
          full_name: decodedToken.name || decodedToken.email.split('@')[0],
          role: 'user'
        });
      } catch (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ error: 'Failed to create user: ' + createError.message });
      }
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Internal server error during login' });
  }
};

export const logout = async (req, res) => {
  try {
    // Firebase handles logout on client side
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    // Get full user data including delivery_address
    const { getUserById } = await import('../models/userModel.js');
    const fullUser = await getUserById(req.user.id);
    
    if (!fullUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is Google user (password_hash = 'firebase_auth' indicates Google sign-in)
    // Note: This is a simple check. For more accuracy, check Firebase providerData on client side
    const isGoogleUser = fullUser.password_hash === 'firebase_auth';

    res.json({ 
      user: {
        ...fullUser,
        isGoogleUser
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { getAllUsers } = await import('../models/userModel.js');
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createAdmin = async (req, res) => {
  let firebaseUserRecord = null;
  
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ 
        success: false,
        error: 'Email, password, and full name are required' 
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email format' 
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if Firebase Admin is initialized
    if (!isFirebaseInitialized() || !admin.apps.length) {
      return res.status(500).json({ 
        success: false,
        error: 'Firebase Admin is not properly configured. Please check server configuration.' 
      });
    }

    // Check if user already exists in database
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }

    // Check if user already exists in Firebase Auth
    try {
      const existingFirebaseUser = await admin.auth().getUserByEmail(email);
      if (existingFirebaseUser) {
        return res.status(400).json({ 
          success: false,
          error: 'User with this email already exists in Firebase Authentication' 
        });
      }
    } catch (firebaseError) {
      // If error is not "user not found", rethrow it
      if (firebaseError.code !== 'auth/user-not-found') {
        throw firebaseError;
      }
      // User doesn't exist in Firebase, which is what we want
    }

    // Create user in Firebase Authentication first
    try {
      firebaseUserRecord = await admin.auth().createUser({
        email,
        password,
        displayName: full_name,
        emailVerified: false
      });
      console.log('Firebase user created:', firebaseUserRecord.uid);
    } catch (firebaseError) {
      console.error('Firebase user creation error:', firebaseError);
      return res.status(500).json({ 
        success: false,
        error: `Failed to create user in Firebase: ${firebaseError.message}` 
      });
    }

    // Create admin user in database
    try {
      const adminUser = await createUser({
        email,
        password_hash: 'firebase_auth', // Marker since Firebase handles auth
        full_name,
        role: 'admin'
      });

      res.status(201).json({
        success: true,
        message: 'Admin account created successfully',
        user: {
          id: adminUser.id,
          email: adminUser.email,
          full_name: adminUser.full_name,
          role: adminUser.role,
          firebase_uid: firebaseUserRecord.uid
        }
      });
    } catch (dbError) {
      console.error('Database user creation error:', dbError);
      
      // Clean up Firebase user if database creation fails
      if (firebaseUserRecord) {
        try {
          await admin.auth().deleteUser(firebaseUserRecord.uid);
          console.log('Cleaned up Firebase user after database error');
        } catch (cleanupError) {
          console.error('Error cleaning up Firebase user:', cleanupError);
        }
      }
      
      return res.status(500).json({ 
        success: false,
        error: `Failed to create user in database: ${dbError.message}` 
      });
    }
  } catch (error) {
    console.error('Create admin error:', error);
    
    // Clean up Firebase user if it was created
    if (firebaseUserRecord) {
      try {
        await admin.auth().deleteUser(firebaseUserRecord.uid);
        console.log('Cleaned up Firebase user after error');
      } catch (cleanupError) {
        console.error('Error cleaning up Firebase user:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to create admin account' 
    });
  }
};

// Admin-only endpoint for creating admins (requires admin authentication)
export const createAdminByAdmin = async (req, res) => {
  let firebaseUserRecord = null;
  
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        error: 'Admin access required' 
      });
    }

    const { email, password, full_name } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ 
        success: false,
        error: 'Email, password, and full name are required' 
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email format' 
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if Firebase Admin is initialized
    if (!isFirebaseInitialized() || !admin.apps.length) {
      return res.status(500).json({ 
        success: false,
        error: 'Firebase Admin is not properly configured. Please check server configuration.' 
      });
    }

    // Check if user already exists in database
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }

    // Check if user already exists in Firebase Auth
    try {
      const existingFirebaseUser = await admin.auth().getUserByEmail(email);
      if (existingFirebaseUser) {
        return res.status(400).json({ 
          success: false,
          error: 'User with this email already exists in Firebase Authentication' 
        });
      }
    } catch (firebaseError) {
      // If error is not "user not found", rethrow it
      if (firebaseError.code !== 'auth/user-not-found') {
        throw firebaseError;
      }
      // User doesn't exist in Firebase, which is what we want
    }

    // Create user in Firebase Authentication first
    try {
      firebaseUserRecord = await admin.auth().createUser({
        email,
        password,
        displayName: full_name,
        emailVerified: false
      });
      console.log('Firebase user created:', firebaseUserRecord.uid);
    } catch (firebaseError) {
      console.error('Firebase user creation error:', firebaseError);
      return res.status(500).json({ 
        success: false,
        error: `Failed to create user in Firebase: ${firebaseError.message}` 
      });
    }

    // Create admin user in database
    try {
      const adminUser = await createUser({
        email,
        password_hash: 'firebase_auth', // Marker since Firebase handles auth
        full_name,
        role: 'admin'
      });

      res.status(201).json({
        success: true,
        message: 'Admin account created successfully',
        user: {
          id: adminUser.id,
          email: adminUser.email,
          full_name: adminUser.full_name,
          role: adminUser.role,
          firebase_uid: firebaseUserRecord.uid
        }
      });
    } catch (dbError) {
      console.error('Database user creation error:', dbError);
      
      // Clean up Firebase user if database creation fails
      if (firebaseUserRecord) {
        try {
          await admin.auth().deleteUser(firebaseUserRecord.uid);
          console.log('Cleaned up Firebase user after database error');
        } catch (cleanupError) {
          console.error('Error cleaning up Firebase user:', cleanupError);
        }
      }
      
      return res.status(500).json({ 
        success: false,
        error: `Failed to create user in database: ${dbError.message}` 
      });
    }
  } catch (error) {
    console.error('Create admin by admin error:', error);
    
    // Clean up Firebase user if it was created
    if (firebaseUserRecord) {
      try {
        await admin.auth().deleteUser(firebaseUserRecord.uid);
        console.log('Cleaned up Firebase user after error');
      } catch (cleanupError) {
        console.error('Error cleaning up Firebase user:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to create admin account' 
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, delivery_address, contact_number } = req.body;

    const updates = {};
    
    if (full_name) {
      updates.full_name = full_name;
    }
    
    if (delivery_address !== undefined) {
      updates.delivery_address = delivery_address;
    }

    if (contact_number !== undefined) {
      updates.contact_number = contact_number;
    }

    // Note: Password updates are handled on the client side via Firebase
    // We don't store passwords in the database for Firebase-authenticated users
    // The password_hash field is just a marker ('firebase_auth' for Google users)

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { updateUser } = await import('../models/userModel.js');
    const updatedUser = await updateUser(userId, updates);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        delivery_address: updatedUser.delivery_address,
        contact_number: updatedUser.contact_number,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAdmins = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { getAdmins } = await import('../models/userModel.js');
    const admins = await getAdmins();
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAdminPassword = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if Firebase Admin is initialized
    if (!isFirebaseInitialized() || !admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin is not properly configured' });
    }

    // Get Firebase user by email
    try {
      const firebaseUser = await admin.auth().getUserByEmail(req.user.email);
      
      // Update password using Firebase Admin SDK (no reauthentication needed)
      await admin.auth().updateUser(firebaseUser.uid, {
        password: newPassword
      });

      res.json({
        message: 'Password updated successfully'
      });
    } catch (firebaseError) {
      console.error('Firebase password update error:', firebaseError);
      if (firebaseError.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'User not found in Firebase Authentication' });
      }
      throw firebaseError;
    }
  } catch (error) {
    console.error('Update admin password error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { full_name } = req.body;

    if (!full_name) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    // Update in database
    const { updateUser } = await import('../models/userModel.js');
    const updatedUser = await updateUser(req.user.id, { full_name });

    // Update in Firebase Auth display name if user exists
    try {
      if (isFirebaseInitialized() && admin.apps.length) {
        const firebaseUser = await admin.auth().getUserByEmail(req.user.email);
        await admin.auth().updateUser(firebaseUser.uid, {
          displayName: full_name
        });
      }
    } catch (firebaseError) {
      // If Firebase update fails, continue with database update
      console.error('Firebase display name update error:', firebaseError);
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const adminIdToDelete = parseInt(id);

    // Prevent self-deletion
    if (adminIdToDelete === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Get the admin to delete
    const { getUserById, deleteUser } = await import('../models/userModel.js');
    const adminToDelete = await getUserById(adminIdToDelete);

    if (!adminToDelete) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (adminToDelete.role !== 'admin') {
      return res.status(400).json({ error: 'User is not an admin' });
    }

    // Delete from Firebase Auth if user exists
    try {
      const admin = (await import('../config/firebaseAdmin.js')).default;
      // Try to get Firebase user by email
      try {
        const firebaseUser = await admin.auth().getUserByEmail(adminToDelete.email);
        await admin.auth().deleteUser(firebaseUser.uid);
        console.log('Firebase user deleted:', firebaseUser.uid);
      } catch (firebaseError) {
        // If user doesn't exist in Firebase, that's okay
        if (firebaseError.code !== 'auth/user-not-found') {
          console.error('Firebase deletion error:', firebaseError);
          // Continue with database deletion even if Firebase deletion fails
        }
      }
    } catch (firebaseAdminError) {
      console.error('Firebase Admin error:', firebaseAdminError);
      // Continue with database deletion even if Firebase Admin fails
    }

    // Delete from database
    const deletedAdmin = await deleteUser(adminIdToDelete);

    res.json({
      message: 'Admin account deleted successfully',
      deletedAdmin: {
        id: deletedAdmin.id,
        email: deletedAdmin.email,
        full_name: deletedAdmin.full_name
      }
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  signup,
  login,
  logout,
  getCurrentUser,
  getAllUsers,
  createAdmin,
  createAdminByAdmin,
  updateProfile,
  getAdmins,
  deleteAdmin,
  updateAdminPassword,
  updateAdminProfile
};
