import { Redis } from '@upstash/redis';

let redis: Redis;

export function getRedisClient() {
  if (!redis) {
    redis = new Redis({
      url: process.env.REDIS_URL || '',
      token: process.env.REDIS_TOKEN || '',
    });
  }
  return redis;
}
