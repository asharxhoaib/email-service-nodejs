import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';

@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  overall(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('provider') provider?: string,
  ) {
    return this.analytics.summary({ from, to, provider });
  }

  @Get('timeseries')
  timeseries(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('templateId') templateId?: string,
  ) {
    return this.analytics.timeSeries({ from, to, templateId });
  }

  @Get('export')
  async export(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('templateId') templateId?: string,
    @Query('provider') provider?: string,
  ) {
    const csv = await this.analytics.exportCsv({ from, to, templateId, provider });
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="analytics.csv"',
    });
    res.send(csv);
  }

  @Get('template/:id')
  byTemplate(@Param('id') id: string) {
    return this.analytics.byTemplate(id);
  }
}
