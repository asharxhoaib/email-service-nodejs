import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_EMAIL, QUEUE_BATCH } from 'src/config/redis.config';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_EMAIL }, { name: QUEUE_BATCH }),
    forwardRef(() => TemplatesModule),
  ],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailsModule {}
