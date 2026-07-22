import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import juice from 'juice';
import { PrismaService } from 'src/common/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto } from './template.dto';

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTemplateDto) {
    return this.prisma.template.create({ data: dto });
  }

  findAll(category?: string, locale?: string) {
    return this.prisma.template.findMany({
      where: { ...(category ? { category } : {}), ...(locale ? { locale } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tpl = await this.prisma.template.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException(`Template ${id} not found`);
    return tpl;
  }

  async update(id: string, dto: UpdateTemplateDto) {
    await this.findOne(id);
    return this.prisma.template.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.template.delete({ where: { id } });
  }

  /**
   * Validate variables against the template's JSON-Schema-ish variablesSchema.
   * Supports `required: string[]` — enough to catch missing merge fields before
   * a broken email goes out.
   */
  validateVariables(schema: any, variables: Record<string, any>): void {
    if (!schema || !Array.isArray(schema.required)) return;
    const missing = schema.required.filter(
      (k: string) => variables[k] === undefined || variables[k] === null,
    );
    if (missing.length) {
      throw new BadRequestException(`Missing required variables: ${missing.join(', ')}`);
    }
  }

  /** Compile subject + body with Handlebars, then inline CSS for the HTML. */
  render(
    tpl: { subjectTemplate: string; bodyHtml: string; bodyText: string | null },
    variables: Record<string, any> = {},
  ): RenderedTemplate {
    const subject = Handlebars.compile(tpl.subjectTemplate)(variables);
    const rawHtml = Handlebars.compile(tpl.bodyHtml)(variables);
    const html = juice(rawHtml);
    const text = tpl.bodyText
      ? Handlebars.compile(tpl.bodyText)(variables)
      : this.htmlToText(html);
    return { subject, html, text };
  }

  async renderById(id: string, variables: Record<string, any> = {}) {
    const tpl = await this.findOne(id);
    this.validateVariables(tpl.variablesSchema, variables);
    return this.render(tpl, variables);
  }

  /** Preview endpoint helper — render with caller-supplied sample data. */
  async preview(id: string, sampleData: Record<string, any> = {}) {
    const tpl = await this.findOne(id);
    return this.render(tpl, sampleData);
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
