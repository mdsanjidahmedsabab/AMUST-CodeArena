import Redis from 'ioredis';
import { Queue } from 'bullmq';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ
});

connection.on('error', (err) => console.error('[Redis]', err.message));
connection.on('connect', () => console.log('✅ Redis connected'));

/**
 * Create a BullMQ queue with shared Redis connection.
 * @param {string} name - Queue name
 * @returns {Queue}
 */
export function createQueue(name) {
  return new Queue(name, { connection });
}

export default connection;
