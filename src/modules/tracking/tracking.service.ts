import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma.service';
import { isBotUserAgent } from 'src/common/utils/tracking.util';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an open. Bot user-agents are ignored so prefetch/proxy fetches don't
   * inflate open rates. First real open sets openedAt; every open increments the
   * count and its batch counter.
   */
  async recordOpen(trackingId: string, ip?: string, userAgent?: string) {
    if (isBotUserAgent(userAgent)) return;

    const email = await this.prisma.email.findUnique({ where: { trackingId } });
    if (!email) return;

    await this.prisma.trackingEvent.create({
      data: { emailId: email.id, type: 'OPEN', ip, userAgent },
    });

    await this.prisma.email.update({
      where: { id: email.id },
      data: {
        openedCount: { increment: 1 },
        ...(email.openedAt ? {} : { openedAt: new Date() }),
      },
    });

    if (email.batchId && !email.openedAt) {
      await this.prisma.batch.update({
        where: { id: email.batchId },
        data: { opened: { increment: 1 } },
      });
    }
  }

  /**
   * Record a click and return the original URL to redirect to. First click sets
   * clickedAt; unique-per-email opens are tracked implicitly via clickedAt.
   */
  async recordClick(
    trackingId: string,
    url: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    if (isBotUserAgent(userAgent)) return;

    const email = await this.prisma.email.findUnique({ where: { trackingId } });
    if (!email) return;

    await this.prisma.trackingEvent.create({
      data: { emailId: email.id, type: 'CLICK', url, ip, userAgent },
    });

    const firstClick = !email.clickedAt;
    await this.prisma.email.update({
      where: { id: email.id },
      data: {
        clickedCount: { increment: 1 },
        ...(firstClick ? { clickedAt: new Date() } : {}),
      },
    });

    if (email.batchId && firstClick) {
      await this.prisma.batch.update({
        where: { id: email.batchId },
        data: { clicked: { increment: 1 } },
      });
    }
  }
}
