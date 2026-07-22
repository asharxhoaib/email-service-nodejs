import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NOTIFICATION } from 'src/config/redis.config';

/**
 * Admin notifications (e.g. complaint-rate alerts). Kept as a queue so alerting
 * never blocks the webhook request. Wire this to email/Slack/PagerDuty as needed.
 */
@Processor(QUEUE_NOTIFICATION, { concurrency: 2 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name === 'complaint-rate-alert') {
      const { rate, complaints, sent } = job.data;
      this.logger.warn(
        `⚠️  Complaint rate ${(rate * 100).toFixed(3)}% (${complaints}/${sent}) exceeds 0.1% threshold`,
      );
    }
  }
}
