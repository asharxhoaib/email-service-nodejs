import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SuppressionService } from './suppression.service';

/**
 * One-click unsubscribe. Tokens are JWTs carrying the recipient address with a
 * 1-year expiry, so the link stays valid for the lifetime of a campaign.
 */
@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly jwt: JwtService,
    private readonly suppression: SuppressionService,
  ) {}

  createToken(email: string): string {
    return this.jwt.sign({ email }, { expiresIn: '365d' });
  }

  async unsubscribe(token: string): Promise<{ email: string; unsubscribed: boolean }> {
    let email: string;
    try {
      const payload = this.jwt.verify(token);
      email = payload.email;
    } catch {
      throw new BadRequestException('Invalid or expired unsubscribe token');
    }
    await this.suppression.add(email, 'UNSUBSCRIBE');
    return { email, unsubscribed: true };
  }
}
