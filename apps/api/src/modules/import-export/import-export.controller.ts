import { BadRequestException, Body, Controller, Get, Header, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IMPORTABLE_ENTITIES, importRequestSchema, MAX_UPLOAD_BYTES, PERMISSIONS } from '@cdms/contracts';
import type { ImportableEntity } from '@cdms/contracts';
import { CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { ZodPipe } from '../../common/zod';
import { forbidden } from '../../common/errors';
import { AuditService } from '../audit/audit.service';
import { COLUMNS } from './columns';
import { ImportExportService } from './import-export.service';

const entityOf = (e: string): ImportableEntity => {
  if (!(IMPORTABLE_ENTITIES as readonly string[]).includes(e)) throw new BadRequestException('Unknown entity');
  return e as ImportableEntity;
};

@ApiTags('import-export')
@Controller()
export class ImportExportController {
  constructor(private readonly svc: ImportExportService, private readonly audit: AuditService) {}

  @Post('import')
  @RequirePermissions(PERMISSIONS.IMPORT_RUN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  import(@UploadedFile() file: Express.Multer.File, @Body(new ZodPipe(importRequestSchema)) body: ReturnType<typeof importRequestSchema.parse>, @CurrentUser() u: RequestUser) {
    if (!file) throw new BadRequestException('No file provided');
    const needed = { occupation: PERMISSIONS.CATALOG_WRITE, competency: PERMISSIONS.CATALOG_WRITE, unit: PERMISSIONS.CATALOG_WRITE, reference_item: PERMISSIONS.REFERENCE_WRITE, institution: PERMISSIONS.INSTITUTION_WRITE }[body.entity];
    if (!u.permissions.has(needed)) throw forbidden(`Importing ${body.entity} requires ${needed}`);
    return this.svc.run(body, file.buffer, u);
  }

  @Get('import/template/:entity')
  @RequirePermissions(PERMISSIONS.IMPORT_RUN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  template(@Param('entity') e: string, @Res({ passthrough: true }) res: Response) {
    const entity = entityOf(e);
    res.set('Content-Disposition', `attachment; filename="${entity}-template.csv"`);
    return '﻿' + COLUMNS[entity].join(',') + '\n';
  }

  @Get('export/full')
  @RequirePermissions(PERMISSIONS.EXPORT_RUN, PERMISSIONS.CATALOG_READ)
  full(@CurrentUser() u: RequestUser) {
    return this.svc.fullExport(u);
  }

  @Get('export/:entity')
  @RequirePermissions(PERMISSIONS.EXPORT_RUN)
  async export(@Param('entity') e: string, @Query('format') format = 'csv', @Query('listCode') listCode: string | undefined, @CurrentUser() u: RequestUser, @Res({ passthrough: true }) res: Response) {
    const entity = entityOf(e);
    const rows = await this.svc.exportRows(entity, listCode);
    await this.audit.record(u, { action: 'export.run', entityType: entity, metadata: { format, rows: rows.length } });
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      res.set('Content-Disposition', `attachment; filename="${entity}-${stamp}.json"`);
      return rows;
    }
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${entity}-${stamp}.csv"` });
    return this.svc.toCsv(entity, rows);
  }
}
