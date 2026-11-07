import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MAX_UPLOAD_BYTES, PERMISSIONS } from '@cdms/contracts';
import { Authenticated, CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { IdParam } from '../../common/zod';
import { FilesService } from './files.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  @Post(':entityType/:entityId')
  @RequirePermissions(PERMISSIONS.FILE_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 } }),
  )
  upload(
    @Param('entityType') type: string,
    @Param('entityId') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() u: RequestUser,
  ) {
    if (!UUID.test(id)) throw new BadRequestException('Invalid id');
    return this.svc.upload(file, type, id, u);
  }

  @Get()
  @Authenticated()
  list(
    @Query('entityType') type: string,
    @Query('entityId') id: string,
    @CurrentUser() u: RequestUser,
  ) {
    if (!UUID.test(id ?? '')) throw new BadRequestException('Invalid id');
    return this.svc.list(type, id, u);
  }

  @Get(':id/content')
  @Authenticated()
  async download(
    @IdParam() id: string,
    @CurrentUser() u: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { meta, stream } = await this.svc.open(id, u);
    res.set({
      'Content-Type': meta.mimeType,
      'Content-Length': String(meta.sizeBytes),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.originalName)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(stream);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.FILE_DELETE)
  remove(@IdParam() id: string, @CurrentUser() u: RequestUser) {
    return this.svc.remove(id, u);
  }
}
