import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { auditQuerySchema, PERMISSIONS } from '@cdms/contracts';
import type { AuditQuery } from '@cdms/contracts';
import { RequirePermissions } from '../../common/auth.decorators';
import { ZQuery } from '../../common/zod';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  list(@ZQuery(auditQuerySchema) q: AuditQuery) {
    return this.audit.list(q);
  }
}
