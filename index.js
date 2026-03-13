import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import foodRoutes from './routes/foodRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import mealPlanRoutes from './routes/mealPlanRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import siteSettingsRoutes from './routes/siteSettingsRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT

// Middleware
const corsOptions = {
  origin: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173'),
  credentials: true,
  optionsSuccessStatus: 200
};

// Allow multiple origins in production if needed
if (process.env.NODE_ENV === 'production' && process.env.CLIENT_URL) {
  corsOptions.origin = process.env.CLIENT_URL.split(',').map(url => url.trim());
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/site-settings', siteSettingsRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Test database connection on startup
import { query } from './config/database.js';

const testDatabaseConnection = async () => {
  try {
    await query('SELECT NOW()');
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Please check your DATABASE_URL or database credentials in .env file');
  }
};

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📡 API available at http://localhost:${PORT}/api`);
  }
  
  // Test connections
  await testDatabaseConnection();
  
  // Check Firebase Admin
  try {
    const { isFirebaseInitialized } = await import('./config/firebaseAdmin.js');
    if (!isFirebaseInitialized()) {
      console.warn('⚠️  Firebase Admin not initialized - authentication features may not work');
      console.warn('   Please check your Firebase configuration in .env file');
      console.warn('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    } else {
      console.log('✅ Firebase Admin initialized');
    }
  } catch (error) {
    console.error('❌ Error checking Firebase Admin:', error.message);
  }
});

// Handle uncaught errors to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

export default app;

