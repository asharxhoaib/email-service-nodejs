import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { buildRedisConnection } from './config/redis.config';
import { PrismaModule } from './common/prisma.module';
import { RedisService } from './common/redis.service';
import { ProvidersModule } from './modules/providers/providers.module';
import { SuppressionModule } from './modules/suppression/suppression.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { EmailsModule } from './modules/emails/emails.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

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
    TemplatesModule,
    EmailsModule,
    TrackingModule,
    WebhooksModule,
    AnalyticsModule,
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class AppModule {}
