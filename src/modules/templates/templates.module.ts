import { Module, forwardRef } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { EmailsModule } from '../emails/emails.module';

@Module({
  imports: [forwardRef(() => EmailsModule)],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplatesModule {}
