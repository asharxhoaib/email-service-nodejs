import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TrackingService } from './tracking.service';
import { transparentGifBuffer } from 'src/common/utils/tracking.util';

@Controller('api/v1/tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('open/:trackingId')
  async open(
    @Param('trackingId') trackingId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Fire-and-forget so the pixel always returns fast.
    this.tracking
      .recordOpen(trackingId, this.ip(req), req.headers['user-agent'])
      .catch(() => undefined);

    const gif = transparentGifBuffer();
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': gif.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(gif);
  }

  @Get('click/:trackingId')
  async click(
    @Param('trackingId') trackingId: string,
    @Query('url') url: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const target = url || '/';
    await this.tracking
      .recordClick(trackingId, target, this.ip(req), req.headers['user-agent'])
      .catch(() => undefined);
    res.redirect(302, target);
  }

  private ip(req: Request): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') return fwd.split(',')[0].trim();
    return req.socket?.remoteAddress;
  }
}
