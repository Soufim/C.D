import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@cdms/contracts';
import { Authenticated, CurrentUser, RequirePermissions } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { InsightsService } from './insights.service';

@ApiTags('insights')
@Controller()
export class InsightsController {
  constructor(private readonly svc: InsightsService) {}

  @Get('dashboard')
  @Authenticated()
  dashboard(@CurrentUser() u: RequestUser) {
    return this.svc.dashboard(u);
  }

  @Get('search')
  @Authenticated()
  search(@Query('q') q: string = '', @CurrentUser() u: RequestUser) {
    return this.svc.search(q.slice(0, 100), u);
  }

  @Get('reports/standardisation')
  @RequirePermissions(PERMISSIONS.REPORT_READ, PERMISSIONS.CATALOG_READ)
  report() {
    return this.svc.standardisationReport();
  }
}
