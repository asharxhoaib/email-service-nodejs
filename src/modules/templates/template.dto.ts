import {
  IsString,
  IsOptional,
  IsObject,
  IsEmail,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  subjectTemplate: string;

  @IsString()
  bodyHtml: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsObject()
  variablesSchema?: Record<string, any>;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() subjectTemplate?: string;
  @IsOptional() @IsString() bodyHtml?: string;
  @IsOptional() @IsString() bodyText?: string;
  @IsOptional() @IsObject() variablesSchema?: Record<string, any>;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() locale?: string;
}

export class PreviewTemplateDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}

export class TestTemplateDto {
  @IsEmail()
  to: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}
