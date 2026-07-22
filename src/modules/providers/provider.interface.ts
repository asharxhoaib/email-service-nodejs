export interface EmailPayload {
  from: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}

export interface ProviderResult {
  success: boolean;
  provider: string;
  messageId?: string;
  /** true = don't retry (bad address, 4xx). false = transient, worth retrying. */
  permanent?: boolean;
  error?: string;
}

export interface BaseEmailProvider {
  readonly name: string;
  send(email: EmailPayload): Promise<ProviderResult>;
}

export const PROVIDER_TOKENS = {
  sendgrid: 'PROVIDER_SENDGRID',
  ses: 'PROVIDER_SES',
  smtp: 'PROVIDER_SMTP',
} as const;
