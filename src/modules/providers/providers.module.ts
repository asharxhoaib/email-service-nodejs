import { Global, Module } from '@nestjs/common';
import { SendGridProvider } from './sendgrid.provider';
import { SESProvider } from './ses.provider';
import { SMTPProvider } from './smtp.provider';
import { ProviderRegistry } from './provider.registry';

@Global()
@Module({
  providers: [SendGridProvider, SESProvider, SMTPProvider, ProviderRegistry],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}
