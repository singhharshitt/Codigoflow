import { config } from './config';
import { initDatabase, closeDatabase } from './database';
import { createApp } from './app';
import { logger } from './utils/logger';

async function main() {
  initDatabase();

  const { httpServer } = createApp();
  const port = parseInt(config.PORT, 10);

  httpServer.listen(port, config.HOST, () => {
    logger.info(`CódigoFlow server running at http://${config.HOST}:${port}`);
    logger.info(`Environment : ${config.NODE_ENV}`);
    logger.info(`CORS origin : ${config.CLIENT_ORIGIN}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down...');
    httpServer.close(() => {
      closeDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
