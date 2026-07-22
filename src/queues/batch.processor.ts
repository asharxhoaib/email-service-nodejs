import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { PrismaService } from 'src/common/prisma.service';
import { TemplateService } from 'src/modules/templates/template.service';
import { SuppressionService } from 'src/modules/suppression/suppression.service';
import { UnsubscribeService } from 'src/modules/suppression/unsubscribe.service';
import { RedisService } from 'src/common/redis.service';
import {
  injectTrackingPixel,
  rewriteLinks,
  injectUnsubscribeFooter,
} from 'src/common/utils/tracking.util';
import { QUEUE_BATCH, QUEUE_EMAIL } from 'src/config/redis.config';

interface BatchChunkData {
  batchId: string;
  templateId: string;
  variables: Record<string, any>;
  from?: string;
  recipients: string[];
}

/**
 * Processes a chunk of batch recipients: renders the template per recipient,
 * skips suppressed addresses, creates the email record, injects tracking, and
 * enqueues an individual send job. Batch counters use Redis HINCRBY for
 * atomicity across concurrent chunk workers.
 */
@Processor(QUEUE_BATCH, { concurrency: 5 })
export class BatchProcessor extends WorkerHost {
  private readonly logger = new Logger(BatchProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly templates: TemplateService,
    private readonly suppression: SuppressionService,
    private readonly unsubscribe: UnsubscribeService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUE_EMAIL) private readonly emailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<BatchChunkData>): Promise<void> {
    const { batchId, templateId, variables, from, recipients } = job.data;
    const baseUrl = this.config.get<string>('apiBaseUrl');
    const defaultFrom = from || this.config.get<string>('defaultFrom');
    const tpl = await this.templates.findOne(templateId);

    await this.prisma.batch.update({
      where: { id: batchId },
      data: { status: 'PROCESSING' },
    });

    for (const to of recipients) {
      if (await this.suppression.isSuppressed(to)) {
        await this.redis.incrBatchCounter(batchId, 'skipped');
        continue;
      }

      const rendered = this.templates.render(tpl, variables);
      const trackingId = uuid();
      const unsubToken = this.unsubscribe.createToken(to);

      let html = rewriteLinks(rendered.html, trackingId, baseUrl);
      html = injectTrackingPixel(html, trackingId, baseUrl);
      html = injectUnsubscribeFooter(html, unsubToken, baseUrl);

      const email = await this.prisma.email.create({
        data: {
          trackingId,
          from: defaultFrom,
          to,
          subject: rendered.subject,
          bodyHtml: html,
          bodyText: rendered.text,
          templateId,
          variablesJson: variables,
          status: 'QUEUED',
          batchId,
        },
      });

      await this.prisma.batch.update({
        where: { id: batchId },
        data: { queued: { increment: 1 } },
      });

      await this.emailQueue.add(
        'send',
        {
          emailId: email.id,
          headers: {
            'List-Unsubscribe': `<${baseUrl}/api/v1/unsubscribe/${unsubToken}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        },
        { attempts: 5, backoff: { type: 'custom' }, removeOnComplete: 1000 },
      );

      await this.redis.incrBatchCounter(batchId, 'enqueued');
    }

    // Mark completed once every recipient across all chunks has been enqueued.
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (batch && batch.queued >= batch.total) {
      await this.prisma.batch.update({
        where: { id: batchId },
        data: { status: 'COMPLETED' },
      });
    }
  }
}
