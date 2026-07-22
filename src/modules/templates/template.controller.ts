import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { TemplateService } from './template.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  PreviewTemplateDto,
  TestTemplateDto,
} from './template.dto';
import { EmailService } from '../emails/email.service';

@Controller('api/v1/templates')
export class TemplateController {
  constructor(
    private readonly templates: TemplateService,
    private readonly emails: EmailService,
  ) {}

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto);
  }

  @Get()
  list(@Query('category') category?: string, @Query('locale') locale?: string) {
    return this.templates.findAll(category, locale);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.templates.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templates.remove(id);
  }

  @Post(':id/preview')
  preview(@Param('id') id: string, @Body() dto: PreviewTemplateDto) {
    return this.templates.preview(id, dto.variables || {});
  }

  @Post(':id/test')
  test(@Param('id') id: string, @Body() dto: TestTemplateDto) {
    return this.emails.send({
      to: dto.to,
      templateId: id,
      variables: dto.variables || {},
    });
  }
}
