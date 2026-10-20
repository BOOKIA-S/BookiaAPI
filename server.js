// Process entry point: validates env, opens the single DB connection, starts HTTP server.
const app = require('./app');
const { connectDb, disconnectDb } = require('./config/db');
const { PORT, assertRequiredEnv } = require('./config/env');

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'];

async function start() {
  assertRequiredEnv(['MONGODB_URI', 'JWT_SECRET']);
  await connectDb();
  const server = app.listen(PORT, () => {
    console.log(`BOOKIA API listening on port ${PORT}`);
  });

  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };
  SHUTDOWN_SIGNALS.forEach((signal) => process.on(signal, () => shutdown(signal)));
}

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
