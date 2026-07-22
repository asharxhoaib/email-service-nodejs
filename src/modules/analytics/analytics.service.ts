import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma.service';

export interface AnalyticsSummary {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complaints: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private rate(numerator: number, denominator: number): number {
    if (!denominator) return 0;
    return Math.round((numerator / denominator) * 10000) / 100; // percent, 2dp
  }

  private buildWhere(params: {
    from?: string;
    to?: string;
    templateId?: string;
    provider?: string;
  }): Prisma.EmailWhereInput {
    const where: Prisma.EmailWhereInput = {};
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }
    if (params.templateId) where.templateId = params.templateId;
    if (params.provider) where.provider = params.provider;
    return where;
  }

  async summary(params: {
    from?: string;
    to?: string;
    templateId?: string;
    provider?: string;
  } = {}): Promise<AnalyticsSummary> {
    const where = this.buildWhere(params);

    const [sent, delivered, opened, clicked, bounced, complaints] =
      await Promise.all([
        this.prisma.email.count({
          where: { ...where, status: { in: ['SENT', 'DELIVERED', 'BOUNCED'] } },
        }),
        this.prisma.email.count({ where: { ...where, status: 'DELIVERED' } }),
        this.prisma.email.count({ where: { ...where, openedAt: { not: null } } }),
        this.prisma.email.count({ where: { ...where, clickedAt: { not: null } } }),
        this.prisma.email.count({ where: { ...where, status: 'BOUNCED' } }),
        this.prisma.suppressionEntry.count({ where: { reason: 'COMPLAINT' } }),
      ]);

    return {
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      complaints,
      deliveryRate: this.rate(delivered, sent),
      openRate: this.rate(opened, delivered),
      clickRate: this.rate(clicked, opened),
      bounceRate: this.rate(bounced, sent),
      complaintRate: this.rate(complaints, sent),
    };
  }

  async byTemplate(templateId: string) {
    return this.summary({ templateId });
  }

  /**
   * Daily time series between two dates. Aggregates in JS from raw rows — fine
   * for dashboard ranges; swap for a SQL GROUP BY at very high volume.
   */
  async timeSeries(params: { from: string; to: string; templateId?: string }) {
    const where = this.buildWhere(params);
    const emails = await this.prisma.email.findMany({
      where,
      select: { createdAt: true, status: true, openedAt: true, clickedAt: true },
    });

    const buckets: Record<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number }> = {};
    for (const e of emails) {
      const day = e.createdAt.toISOString().slice(0, 10);
      buckets[day] ||= { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
      buckets[day].sent += 1;
      if (e.status === 'DELIVERED') buckets[day].delivered += 1;
      if (e.status === 'BOUNCED') buckets[day].bounced += 1;
      if (e.openedAt) buckets[day].opened += 1;
      if (e.clickedAt) buckets[day].clicked += 1;
    }

    return Object.entries(buckets)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async exportCsv(params: { from?: string; to?: string; templateId?: string; provider?: string }): Promise<string> {
    const where = this.buildWhere(params);
    const emails = await this.prisma.email.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        to: true,
        subject: true,
        status: true,
        provider: true,
        sentAt: true,
        deliveredAt: true,
        openedCount: true,
        clickedCount: true,
        bounceType: true,
        createdAt: true,
      },
    });

    const header = [
      'id',
      'to',
      'subject',
      'status',
      'provider',
      'sentAt',
      'deliveredAt',
      'openedCount',
      'clickedCount',
      'bounceType',
      'createdAt',
    ];
    const escape = (v: any) =>
      v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`;
    const rows = emails.map((e) =>
      [
        e.id,
        e.to,
        e.subject,
        e.status,
        e.provider,
        e.sentAt?.toISOString(),
        e.deliveredAt?.toISOString(),
        e.openedCount,
        e.clickedCount,
        e.bounceType,
        e.createdAt.toISOString(),
      ]
        .map(escape)
        .join(','),
    );
    return [header.join(','), ...rows].join('\n');
  }
}
