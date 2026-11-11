import { config } from './config';
import { initDatabase, closeDatabase } from './database';
import { createApp } from './app';
import { logger } from './utils/logger';

async function main() {
  // Initialize database first
  initDatabase();

  const { httpServer } = createApp();

  httpServer.listen(parseInt(config.PORT, 10), config.HOST, () => {
    logger.info(
      `🚀 CódigoFlow server running at http://${config.HOST}:${config.PORT}`,
    );
    logger.info(`   Environment : ${config.NODE_ENV}`);
    logger.info(`   CORS origin  : ${config.CLIENT_ORIGIN}`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    httpServer.close(() => {
      closeDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
