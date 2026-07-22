import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { BaseEmailProvider, EmailPayload, ProviderResult } from './provider.interface';

@Injectable()
export class SESProvider implements BaseEmailProvider {
  readonly name = 'ses';
  private readonly logger = new Logger(SESProvider.name);
  private readonly client: SESv2Client;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('providers.ses.region');
    const accessKeyId = this.config.get<string>('providers.ses.accessKeyId');
    const secretAccessKey = this.config.get<string>('providers.ses.secretAccessKey');
    this.client = new SESv2Client({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  async send(email: EmailPayload): Promise<ProviderResult> {
    try {
      const res = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: email.from,
          Destination: {
            ToAddresses: [email.to],
            CcAddresses: email.cc,
            BccAddresses: email.bcc,
          },
          Content: {
            Simple: {
              Subject: { Data: email.subject },
              Body: {
                Html: { Data: email.html },
                ...(email.text ? { Text: { Data: email.text } } : {}),
              },
            },
          },
        }),
      );
      return { success: true, provider: this.name, messageId: res.MessageId };
    } catch (err: any) {
      // SES throws named errors for permanent failures.
      const permanentNames = ['MessageRejected', 'MailFromDomainNotVerifiedException', 'AccountSuspendedException'];
      const permanent = permanentNames.includes(err?.name);
      this.logger.warn(`SES send failed (${err?.name}): ${err?.message}`);
      return { success: false, provider: this.name, permanent, error: err?.message };
    }
  }
}
