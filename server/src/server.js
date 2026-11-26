const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDB, disconnectDB } = require('./config/db');
const { startScheduler, stopScheduler } = require('./utils/scheduler');

const start = async () => {
  try {
    await connectDB();
    const server = app.listen(env.port, () => {
      logger.info(`HRMS API listening on http://localhost:${env.port}${env.apiPrefix}`);
      logger.info(`Environment: ${env.nodeEnv} | Client: ${env.clientUrl}`);
      startScheduler();
    });

    const shutdown = async (signal) => {
      logger.warn(`${signal} received, shutting down gracefully`);
      stopScheduler();
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack : reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.stack}`);
  process.exit(1);
});

start();
