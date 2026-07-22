import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { PrismaService } from 'src/common/prisma.service';
import { ProviderRegistry } from 'src/modules/providers/provider.registry';
import { QUEUE_EMAIL } from 'src/config/redis.config';

interface EmailJobData {
  emailId: string;
  headers?: Record<string, string>;
}

/**
 * Consumes the email queue: loads the record, sends via the provider registry
 * (primary -> fallback), and records the outcome. Concurrency 10.
 *
 * Retry policy: transient failures throw (BullMQ retries with the custom
 * backoff below, max 5 attempts). Permanent failures throw UnrecoverableError
 * so BullMQ stops retrying.
 */
@Processor(QUEUE_EMAIL, { concurrency: 10 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistry,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { emailId, headers } = job.data;
    const email = await this.prisma.email.findUnique({ where: { id: emailId } });
    if (!email) throw new UnrecoverableError(`Email ${emailId} not found`);

    // Respect cancellation that happened after the job was enqueued.
    if (email.status === 'CANCELLED') {
      this.logger.log(`Email ${emailId} was cancelled; skipping`);
      return;
    }

    const result = await this.providers.sendWithFallback({
      from: email.from,
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      subject: email.subject,
      html: email.bodyHtml,
      text: email.bodyText || undefined,
      headers,
    });

    if (result.success) {
      await this.prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          provider: result.provider,
          providerMessageId: result.messageId,
          sentAt: new Date(),
          errorMessage: null,
        },
      });
      if (email.batchId) {
        await this.prisma.batch.update({
          where: { id: email.batchId },
          data: { sent: { increment: 1 } },
        });
      }
      return;
    }

    // Permanent failure: mark failed, do not retry.
    if (result.permanent) {
      await this.prisma.email.update({
        where: { id: emailId },
        data: { status: 'FAILED', errorMessage: result.error },
      });
      if (email.batchId) {
        await this.prisma.batch.update({
          where: { id: email.batchId },
          data: { failed: { increment: 1 } },
        });
      }
      throw new UnrecoverableError(result.error || 'Permanent send failure');
    }

    // Transient: record the error and rethrow so BullMQ retries.
    await this.prisma.email.update({
      where: { id: emailId },
      data: { errorMessage: result.error },
    });

    if (job.attemptsMade + 1 >= (job.opts.attempts || 5)) {
      await this.prisma.email.update({
        where: { id: emailId },
        data: { status: 'FAILED' },
      });
      if (email.batchId) {
        await this.prisma.batch.update({
          where: { id: email.batchId },
          data: { failed: { increment: 1 } },
        });
      }
    }
    throw new Error(result.error || 'Transient send failure');
  }
}

/** Exponential backoff steps: 10s, 30s, 1m, 5m, 15m. */
export function emailBackoffStrategy(attemptsMade: number): number {
  const steps = [10_000, 30_000, 60_000, 300_000, 900_000];
  return steps[Math.min(attemptsMade, steps.length - 1)];
}
