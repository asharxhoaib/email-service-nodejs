import {
  IsEmail,
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsUUID,
  IsDateString,
  ValidateIf,
  ArrayMaxSize,
} from 'class-validator';

export class SendEmailDto {
  @IsEmail()
  to: string;

  @IsOptional()
  @IsEmail()
  from?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  // Either provide subject+body, or a templateId+variables.
  @ValidateIf((o) => !o.templateId)
  @IsString()
  subject?: string;

  @ValidateIf((o) => !o.templateId)
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class BatchSendDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsUUID()
  templateId: string;

  @IsArray()
  @ArrayMaxSize(10000)
  @IsEmail({}, { each: true })
  recipients: string[];

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsEmail()
  from?: string;
}

export class ScheduleEmailDto extends SendEmailDto {
  @IsDateString()
  declare scheduledAt: string;
}
