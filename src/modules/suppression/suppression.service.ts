import { Injectable } from '@nestjs/common';
import { SuppressionReason } from '@prisma/client';
import { PrismaService } from 'src/common/prisma.service';

@Injectable()
export class SuppressionService {
  constructor(private readonly prisma: PrismaService) {}

  async isSuppressed(email: string): Promise<boolean> {
    const entry = await this.prisma.suppressionEntry.findUnique({
      where: { emailAddress: email.toLowerCase() },
    });
    return !!entry;
  }

  /** Idempotent add — upsert so repeated bounces/complaints don't throw. */
  add(email: string, reason: SuppressionReason, provider?: string) {
    const emailAddress = email.toLowerCase();
    return this.prisma.suppressionEntry.upsert({
      where: { emailAddress },
      create: { emailAddress, reason, provider },
      update: { reason, provider },
    });
  }

  list(reason?: SuppressionReason, skip = 0, take = 50) {
    return this.prisma.suppressionEntry.findMany({
      where: reason ? { reason } : {},
      orderBy: { addedAt: 'desc' },
      skip,
      take,
    });
  }

  remove(email: string) {
    return this.prisma.suppressionEntry.deleteMany({
      where: { emailAddress: email.toLowerCase() },
    });
  }
}
