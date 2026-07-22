import { Controller, Post, Param } from '@nestjs/common';
import { UnsubscribeService } from './unsubscribe.service';

@Controller('api/v1/unsubscribe')
export class UnsubscribeController {
  constructor(private readonly unsubscribe: UnsubscribeService) {}

  @Post(':token')
  async handle(@Param('token') token: string) {
    const result = await this.unsubscribe.unsubscribe(token);
    return {
      ...result,
      message: `${result.email} has been unsubscribed and will no longer receive emails.`,
    };
  }
}
