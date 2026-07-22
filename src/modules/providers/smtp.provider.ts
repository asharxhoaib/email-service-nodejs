import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { BaseEmailProvider, EmailPayload, ProviderResult } from './provider.interface';

@Injectable()
export class SMTPProvider implements BaseEmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SMTPProvider.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    const smtp = this.config.get('providers.smtp');
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
    });
  }

  async send(email: EmailPayload): Promise<ProviderResult> {
    try {
      const info = await this.transporter.sendMail({
        from: email.from,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
      });
      return { success: true, provider: this.name, messageId: info.messageId };
    } catch (err: any) {
      // nodemailer surfaces SMTP response codes on err.responseCode.
      const code = err?.responseCode;
      const permanent = typeof code === 'number' && code >= 500 && code < 600;
      this.logger.warn(`SMTP send failed (${code}): ${err?.message}`);
      return { success: false, provider: this.name, permanent, error: err?.message };
    }
  }
}
