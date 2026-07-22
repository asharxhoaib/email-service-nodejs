import { ConfigService } from '@nestjs/config';

/**
 * BullMQ connection options. Shared by the queue producers (API) and the
 * worker process so both talk to the same Redis instance.
 */
export const buildRedisConnection = (config: ConfigService) => ({
  host: config.get<string>('redis.host'),
  port: config.get<number>('redis.port'),
  maxRetriesPerRequest: null as null,
});

export const QUEUE_EMAIL = 'email';
export const QUEUE_BATCH = 'batch';
export const QUEUE_NOTIFICATION = 'notification';
