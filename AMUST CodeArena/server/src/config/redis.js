import Redis from 'ioredis';
import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisWarned = false;

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy(times) {
    // Exponential backoff capped at 10 seconds to avoid connection thrashing
    return Math.min(times * 1000, 10000);
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

connection.on('error', (err) => {
  if (!redisWarned) {
    console.warn(`⚠️  [Redis] Unable to connect to ${redisUrl}: ${err.message || err.code || 'Offline'}`);
    console.warn('   (Background BullMQ queues and live Redis caching will operate in fallback mode)');
    redisWarned = true;
  }
});

connection.on('connect', () => {
  redisWarned = false;
  console.log('✅ Redis connected');
});

/**
 * Create a BullMQ queue with shared Redis connection.
 * @param {string} name - Queue name
 * @returns {Queue}
 */
export function createQueue(name) {
  return new Queue(name, { connection });
}

/**
 * Returns the active Redis connection instance.
 * @returns {Redis}
 */
export function getRedisClient() {
  return connection;
}

/**
 * Safely reads a key from Redis with offline guard and timeout.
 * Returns null if Redis is not connected, avoiding hanging promises.
 * @param {string} key
 * @param {number} [timeoutMs=300]
 * @returns {Promise<string|null>}
 */
export async function safeRedisGet(key, timeoutMs = 300) {
  if (!connection || connection.status !== 'ready') {
    return null;
  }
  try {
    return await Promise.race([
      connection.get(key),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis get timeout')), timeoutMs)
      ),
    ]);
  } catch {
    return null;
  }
}

export default connection;
