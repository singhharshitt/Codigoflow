import { initDatabase, closeDatabase } from './index';
import { logger } from '../utils/logger';

initDatabase();
logger.info('Database schema ready');
closeDatabase();
