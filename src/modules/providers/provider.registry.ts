import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseEmailProvider, EmailPayload, ProviderResult } from './provider.interface';
import { SendGridProvider } from './sendgrid.provider';
import { SESProvider } from './ses.provider';
import { SMTPProvider } from './smtp.provider';

/**
 * Resolves providers by name and implements the primary -> fallback strategy.
 * Every send goes through here; the rest of the app never touches a provider
 * class directly.
 */
@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly registry: Record<string, BaseEmailProvider>;

  constructor(
    private readonly config: ConfigService,
    sendgrid: SendGridProvider,
    ses: SESProvider,
    smtp: SMTPProvider,
  ) {
    this.registry = {
      [sendgrid.name]: sendgrid,
      [ses.name]: ses,
      [smtp.name]: smtp,
    };
  }

  get(name: string): BaseEmailProvider | undefined {
    return this.registry[name];
  }

  /**
   * Send via the primary provider; on failure fall back to the configured
   * fallback provider (if any). Returns whichever result is final.
   */
  async sendWithFallback(payload: EmailPayload): Promise<ProviderResult> {
    const primaryName = this.config.get<string>('providers.primary');
    const fallbackName = this.config.get<string>('providers.fallback');

    const primary = this.get(primaryName);
    if (!primary) {
      return { success: false, provider: primaryName, permanent: true, error: `Unknown provider: ${primaryName}` };
    }

    const result = await primary.send(payload);
    if (result.success) {
      this.logger.log(`Sent via primary provider "${primaryName}"`);
      return result;
    }

    // Don't fall back on permanent failures — the address/content is the problem.
    if (result.permanent || !fallbackName) {
      return result;
    }

    const fallback = this.get(fallbackName);
    if (!fallback) return result;

    this.logger.warn(`Primary "${primaryName}" failed; trying fallback "${fallbackName}"`);
    const fbResult = await fallback.send(payload);
    if (fbResult.success) {
      this.logger.log(`Sent via fallback provider "${fallbackName}"`);
    }
    return fbResult;
  }
}
