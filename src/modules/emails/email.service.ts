import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { PrismaService } from 'src/common/prisma.service';
import { QUEUE_EMAIL, QUEUE_BATCH } from 'src/config/redis.config';
import { SuppressionService } from '../suppression/suppression.service';
import { UnsubscribeService } from '../suppression/unsubscribe.service';
import { TemplateService } from '../templates/template.service';
import {
  injectTrackingPixel,
  rewriteLinks,
  injectUnsubscribeFooter,
} from 'src/common/utils/tracking.util';
import { validateEmail } from 'src/common/utils/email-validation.util';
import { SendEmailDto, BatchSendDto } from './email.dto';

interface ResolvedContent {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly suppression: SuppressionService,
    private readonly unsubscribe: UnsubscribeService,
    private readonly templates: TemplateService,
    @InjectQueue(QUEUE_EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_BATCH) private readonly batchQueue: Queue,
  ) {}

  /** Resolve subject/html/text from either raw body or a template. */
  private async resolveContent(dto: SendEmailDto): Promise<ResolvedContent> {
    if (dto.templateId) {
      const rendered = await this.templates.renderById(
        dto.templateId,
        dto.variables || {},
      );
      return rendered;
    }
    if (!dto.subject || !dto.body) {
      throw new BadRequestException('subject and body are required when no templateId is given');
    }
    return { subject: dto.subject, html: dto.body, text: dto.bodyText || '' };
  }

  /**
   * Create an email record, inject tracking + unsubscribe, and enqueue it.
   * `scheduledAt` produces a delayed BullMQ job.
   */
  async send(dto: SendEmailDto) {
    const from = dto.from || this.config.get<string>('defaultFrom');
    const baseUrl = this.config.get<string>('apiBaseUrl');

    // 1. Validate recipient format (MX check skipped for latency; enable per-need).
    const validation = await validateEmail(dto.to, false);
    if (!validation.valid) {
      throw new BadRequestException(validation.reason);
    }

    // 2. Suppression gate.
    if (await this.suppression.isSuppressed(dto.to)) {
      throw new BadRequestException(`Recipient ${dto.to} is on the suppression list`);
    }

    // 3. Resolve content.
    const content = await this.resolveContent(dto);

    // 4. Tracking + unsubscribe injection.
    const trackingId = uuid();
    const unsubToken = this.unsubscribe.createToken(dto.to);
    let html = rewriteLinks(content.html, trackingId, baseUrl);
    html = injectTrackingPixel(html, trackingId, baseUrl);
    html = injectUnsubscribeFooter(html, unsubToken, baseUrl);

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;

    // 5. Persist.
    const email = await this.prisma.email.create({
      data: {
        trackingId,
        from,
        to: dto.to,
        cc: dto.cc || [],
        bcc: dto.bcc || [],
        subject: content.subject,
        bodyHtml: html,
        bodyText: content.text,
        templateId: dto.templateId,
        variablesJson: dto.variables || undefined,
        status: scheduledAt ? 'SCHEDULED' : 'QUEUED',
        scheduledAt,
      },
    });

    // 6. Enqueue (delayed if scheduled).
    const listUnsubscribeHeader = {
      'List-Unsubscribe': `<${baseUrl}/api/v1/unsubscribe/${unsubToken}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
    const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
    const job = await this.emailQueue.add(
      'send',
      { emailId: email.id, headers: listUnsubscribeHeader },
      {
        delay,
        attempts: 5,
        backoff: { type: 'custom' },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    return { emailId: email.id, jobId: job.id, status: email.status };
  }

  async schedule(dto: SendEmailDto) {
    if (!dto.scheduledAt) {
      throw new BadRequestException('scheduledAt is required');
    }
    return this.send(dto);
  }

  /** Cancel a scheduled email if it has not been picked up yet. */
  async cancel(emailId: string) {
    const email = await this.prisma.email.findUnique({ where: { id: emailId } });
    if (!email) throw new NotFoundException('Email not found');
    if (email.status !== 'SCHEDULED' && email.status !== 'QUEUED') {
      throw new BadRequestException(`Cannot cancel an email in status ${email.status}`);
    }
    // Best-effort queue cleanup; the processor also re-checks status.
    const jobs = await this.emailQueue.getDelayed();
    for (const job of jobs) {
      if (job.data?.emailId === emailId) await job.remove();
    }
    return this.prisma.email.update({
      where: { id: emailId },
      data: { status: 'CANCELLED' },
    });
  }

  async findOne(id: string) {
    const email = await this.prisma.email.findUnique({
      where: { id },
      include: { trackingEvents: true },
    });
    if (!email) throw new NotFoundException('Email not found');
    return email;
  }

  list(status?: string, skip = 0, take = 50) {
    return this.prisma.email.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  listScheduled() {
    return this.prisma.email.findMany({
      where: { status: 'SCHEDULED' },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Batch send: create a batch record, chunk recipients (50/job), enqueue chunks.
   * The batch processor renders + enqueues individual sends per recipient.
   */
  async batchSend(dto: BatchSendDto) {
    await this.templates.findOne(dto.templateId); // 404 early if missing

    const batch = await this.prisma.batch.create({
      data: {
        name: dto.name,
        templateId: dto.templateId,
        total: dto.recipients.length,
        status: 'QUEUED',
      },
    });

    const CHUNK = 50;
    for (let i = 0; i < dto.recipients.length; i += CHUNK) {
      const chunk = dto.recipients.slice(i, i + CHUNK);
      await this.batchQueue.add(
        'process-chunk',
        {
          batchId: batch.id,
          templateId: dto.templateId,
          variables: dto.variables || {},
          from: dto.from,
          recipients: chunk,
        },
        { attempts: 3, removeOnComplete: 1000 },
      );
    }

    return { batchId: batch.id, total: batch.total, status: batch.status };
  }
}
