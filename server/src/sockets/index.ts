import type { Server as SocketServer } from 'socket.io';
import { logger } from '../utils/logger';
import { setJobIo } from '../jobs/jobService';

export function registerSockets(io: SocketServer): void {
  setJobIo(io);

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected via Socket.IO');

    socket.on('job:subscribe', (jobId: string) => {
      if (typeof jobId === 'string' && jobId.length < 80) {
        socket.join(`job:${jobId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });
}
