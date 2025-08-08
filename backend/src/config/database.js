const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDatabase = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wazuh_case_management';
    
    const options = {
      // Connection options
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      
      // Deprecated options (keeping for backward compatibility info)
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    };

    const conn = await mongoose.connect(mongoURI, options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Connection event handlers
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('Mongoose connection closed due to application termination');
        process.exit(0);
      } catch (error) {
        logger.error('Error closing mongoose connection:', error);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }
};

const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase
};