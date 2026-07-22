import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('api/v1/webhooks')
export class WebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Post('sendgrid')
  @HttpCode(200)
  sendgrid(@Body() events: any[]) {
    return this.webhooks.handleSendGrid(Array.isArray(events) ? events : [events]);
  }

  @Post('ses')
  @HttpCode(200)
  ses(@Body() notification: any) {
    return this.webhooks.handleSES(notification);
  }
}
