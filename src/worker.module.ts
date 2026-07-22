import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { buildRedisConnection } from './config/redis.config';
import { PrismaModule } from './common/prisma.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { SuppressionModule } from './modules/suppression/suppression.module';
import { QueuesModule } from './queues/queues.module';

/**
 * Standalone module for the BullMQ worker process. Loads only what the
 * processors need — no HTTP controllers.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: buildRedisConnection(config),
      }),
    }),
    PrismaModule,
    ProvidersModule,
    SuppressionModule,
    QueuesModule,
  ],
})
export class WorkerModule {}
