import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { SendEmailDto, BatchSendDto, ScheduleEmailDto } from './email.dto';

@Controller('api/v1/emails')
export class EmailController {
  constructor(private readonly emails: EmailService) {}

  @Post('send')
  send(@Body() dto: SendEmailDto) {
    return this.emails.send(dto);
  }

  @Post('batch')
  batch(@Body() dto: BatchSendDto) {
    return this.emails.batchSend(dto);
  }

  @Post('schedule')
  schedule(@Body() dto: ScheduleEmailDto) {
    return this.emails.schedule(dto);
  }

  @Get('scheduled')
  scheduled() {
    return this.emails.listScheduled();
  }

  @Get()
  list(
    @Query('status') status?: string,
    @Query('skip') skip = '0',
    @Query('take') take = '50',
  ) {
    return this.emails.list(status, parseInt(skip, 10), parseInt(take, 10));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.emails.findOne(id);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.emails.cancel(id);
  }
}
