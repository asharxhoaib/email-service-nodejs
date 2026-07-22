import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { BaseEmailProvider, EmailPayload, ProviderResult } from './provider.interface';

@Injectable()
export class SendGridProvider implements BaseEmailProvider {
  readonly name = 'sendgrid';
  private readonly logger = new Logger(SendGridProvider.name);
  private ready = false;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('providers.sendgrid.apiKey');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.ready = true;
    }
  }

  async send(email: EmailPayload): Promise<ProviderResult> {
    if (!this.ready) {
      return { success: false, provider: this.name, permanent: true, error: 'SendGrid API key not configured' };
    }
    try {
      const [res] = await sgMail.send({
        from: email.from,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
      });
      return {
        success: true,
        provider: this.name,
        messageId: res.headers['x-message-id'] as string,
      };
    } catch (err: any) {
      const code = err?.code || err?.response?.statusCode;
      const permanent = typeof code === 'number' && code >= 400 && code < 500;
      this.logger.warn(`SendGrid send failed (${code}): ${err?.message}`);
      return { success: false, provider: this.name, permanent, error: err?.message };
    }
  }
}
