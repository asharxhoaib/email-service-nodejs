import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_EMAIL, QUEUE_BATCH, QUEUE_NOTIFICATION } from 'src/config/redis.config';
import { RedisService } from 'src/common/redis.service';
import { TemplatesModule } from 'src/modules/templates/templates.module';
import { SuppressionModule } from 'src/modules/suppression/suppression.module';
import { EmailProcessor, emailBackoffStrategy } from './email.processor';
import { BatchProcessor } from './batch.processor';
import { NotificationProcessor } from './notification.processor';

/**
 * Worker-side module. Registers the queues WITH the custom backoff strategy and
 * the processor classes. Imported by worker.ts (and optionally by the API if you
 * run everything in one process).
 */
@Module({
  imports: [
    BullModule.registerQueueAsync(
      {
        name: QUEUE_EMAIL,
        inject: [ConfigService],
        useFactory: () => ({
          settings: { backoffStrategy: emailBackoffStrategy },
        }),
      },
      { name: QUEUE_BATCH },
      { name: QUEUE_NOTIFICATION },
    ),
    TemplatesModule,
    SuppressionModule,
  ],
  providers: [RedisService, EmailProcessor, BatchProcessor, NotificationProcessor],
})
export class QueuesModule {}
