const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);
// Query-operator injection is handled by express-mongo-sanitize (strips `$`/dotted keys)
// plus strict Zod request validation. Mongoose's sanitizeFilter must stay off because it
// wraps trusted server-built filters such as { status: { $in: [...] } } in $eq, which
// then fails to cast enum and date paths.

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 15000,
      autoIndex: true,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
};

module.exports = { connectDB, disconnectDB };
