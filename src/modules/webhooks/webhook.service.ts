import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/common/prisma.service';
import { SuppressionService } from '../suppression/suppression.service';
import { QUEUE_NOTIFICATION } from 'src/config/redis.config';

const SOFT_BOUNCE_LIMIT = 3;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly suppression: SuppressionService,
    @InjectQueue(QUEUE_NOTIFICATION) private readonly notifyQueue: Queue,
  ) {}

  private async findByProviderMessageId(messageId?: string) {
    if (!messageId) return null;
    return this.prisma.email.findFirst({ where: { providerMessageId: messageId } });
  }

  private async findByRecipient(to?: string) {
    if (!to) return null;
    return this.prisma.email.findFirst({
      where: { to },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * SendGrid posts an array of events. We handle delivered / open / click /
   * bounce / dropped / spamreport.
   */
  async handleSendGrid(events: any[]) {
    for (const ev of events) {
      const email =
        (await this.findByProviderMessageId(ev.sg_message_id?.split('.')[0])) ||
        (await this.findByRecipient(ev.email));
      if (!email) continue;

      switch (ev.event) {
        case 'delivered':
          await this.markDelivered(email.id, email.batchId);
          break;
        case 'bounce':
          await this.handleBounce(
            email.id,
            email.to,
            email.batchId,
            email.softBounceCount,
            ev.type === 'blocked' ? 'soft' : 'hard',
            'sendgrid',
          );
          break;
        case 'dropped':
          await this.handleBounce(email.id, email.to, email.batchId, email.softBounceCount, 'hard', 'sendgrid');
          break;
        case 'spamreport':
          await this.handleComplaint(email.to, 'sendgrid');
          break;
        default:
          break;
      }
    }
    return { processed: events.length };
  }

  /**
   * AWS SES sends SNS notifications. Body is JSON with notificationType
   * Bounce | Complaint | Delivery.
   */
  async handleSES(notification: any) {
    let message = notification;
    if (typeof notification?.Message === 'string') {
      try {
        message = JSON.parse(notification.Message);
      } catch {
        message = notification;
      }
    }

    const type = message.notificationType || message.eventType;
    const recipients: string[] =
      message.bounce?.bouncedRecipients?.map((r: any) => r.emailAddress) ||
      message.complaint?.complainedRecipients?.map((r: any) => r.emailAddress) ||
      message.mail?.destination ||
      [];

    for (const to of recipients) {
      const email = await this.findByRecipient(to);
      if (!email) continue;

      if (type === 'Bounce') {
        const hard = message.bounce?.bounceType === 'Permanent';
        await this.handleBounce(
          email.id,
          to,
          email.batchId,
          email.softBounceCount,
          hard ? 'hard' : 'soft',
          'ses',
        );
      } else if (type === 'Complaint') {
        await this.handleComplaint(to, 'ses');
      } else if (type === 'Delivery') {
        await this.markDelivered(email.id, email.batchId);
      }
    }
    return { processed: recipients.length };
  }

  private async markDelivered(emailId: string, batchId: string | null) {
    await this.prisma.email.update({
      where: { id: emailId },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
    if (batchId) {
      await this.prisma.batch.update({
        where: { id: batchId },
        data: { delivered: { increment: 1 } },
      });
    }
  }

  private async handleBounce(
    emailId: string,
    to: string,
    batchId: string | null,
    softCount: number,
    type: 'hard' | 'soft',
    provider: string,
  ) {
    await this.prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'BOUNCED',
        bouncedAt: new Date(),
        bounceType: type === 'hard' ? 'HARD' : 'SOFT',
        ...(type === 'soft' ? { softBounceCount: { increment: 1 } } : {}),
      },
    });

    if (batchId) {
      await this.prisma.batch.update({
        where: { id: batchId },
        data: { bounced: { increment: 1 } },
      });
    }

    // Hard bounce -> suppress immediately. Soft bounce -> suppress after limit.
    if (type === 'hard' || softCount + 1 >= SOFT_BOUNCE_LIMIT) {
      await this.suppression.add(to, 'BOUNCE', provider);
      this.logger.warn(`Suppressed ${to} after ${type} bounce`);
    }
  }

  private async handleComplaint(to: string, provider: string) {
    await this.suppression.add(to, 'COMPLAINT', provider);
    await this.checkComplaintRate();
  }

  /** Alert admin if the complaint rate crosses 0.1%. */
  private async checkComplaintRate() {
    const [sent, complaints] = await Promise.all([
      this.prisma.email.count({ where: { status: { in: ['SENT', 'DELIVERED'] } } }),
      this.prisma.suppressionEntry.count({ where: { reason: 'COMPLAINT' } }),
    ]);
    if (sent === 0) return;
    const rate = complaints / sent;
    if (rate > 0.001) {
      await this.notifyQueue.add('complaint-rate-alert', {
        rate,
        complaints,
        sent,
        at: new Date().toISOString(),
      });
    }
  }
}
