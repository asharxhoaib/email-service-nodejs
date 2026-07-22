import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { SuppressionReason } from '@prisma/client';
import { SuppressionService } from './suppression.service';

class AddSuppressionDto {
  @IsEmail() emailAddress: string;
  @IsEnum(SuppressionReason) reason: SuppressionReason;
  @IsOptional() provider?: string;
}

@Controller('api/v1/suppression')
export class SuppressionController {
  constructor(private readonly suppression: SuppressionService) {}

  @Get()
  list(
    @Query('reason') reason?: SuppressionReason,
    @Query('skip') skip = '0',
    @Query('take') take = '50',
  ) {
    return this.suppression.list(reason, parseInt(skip, 10), parseInt(take, 10));
  }

  @Post()
  add(@Body() dto: AddSuppressionDto) {
    return this.suppression.add(dto.emailAddress, dto.reason, dto.provider);
  }

  @Delete(':email')
  remove(@Param('email') email: string) {
    return this.suppression.remove(email);
  }
}
