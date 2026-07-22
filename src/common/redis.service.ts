import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Plain Redis client used for atomic batch counters (INCR). Separate from the
 * BullMQ connection so queue back-pressure never blocks counter writes.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      maxRetriesPerRequest: null,
    });
  }

  async incrBatchCounter(batchId: string, field: string, by = 1): Promise<number> {
    return this.client.hincrby(`batch:${batchId}`, field, by);
  }

  async getBatchCounters(batchId: string): Promise<Record<string, string>> {
    return this.client.hgetall(`batch:${batchId}`);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
