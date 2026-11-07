import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WORKFLOW_ACTION_NAMES, WORKFLOW_ENTITY_TYPES, workflowTransitionSchema } from '@cdms/contracts';
import type { WorkflowAction, WorkflowEntityType, WorkflowTransitionInput } from '@cdms/contracts';
import { Authenticated, CurrentUser } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { IdParam, ZBody } from '../../common/zod';
import { forbidden } from '../../common/errors';
import { WorkflowService } from './workflow.service';
import { WORKFLOW_REGISTRY } from './workflow.registry';

function entity(type: string): WorkflowEntityType {
  if (!(WORKFLOW_ENTITY_TYPES as readonly string[]).includes(type)) throw new BadRequestException('Unknown entity type');
  return type as WorkflowEntityType;
}

/**
 * Generic workflow endpoints: /workflow/:entityType/:id/...
 * Permission checks are per-action and per-entity (see workflow.registry.ts), enforced in the service.
 */
@ApiTags('workflow')
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly wf: WorkflowService) {}

  @Get('review-queue')
  @Authenticated()
  queue(@CurrentUser() user: RequestUser) {
    return this.wf.reviewQueue(user);
  }

  @Post(':entityType/:id/transition')
  @Authenticated()
  transition(@Param('entityType') type: string, @IdParam() id: string, @ZBody(workflowTransitionSchema) body: WorkflowTransitionInput, @CurrentUser() user: RequestUser) {
    return this.wf.transition(entity(type), id, body, user);
  }

  @Get(':entityType/:id/check')
  @Authenticated()
  check(@Param('entityType') type: string, @IdParam() id: string, @Query('action') action: string, @CurrentUser() user: RequestUser) {
    const e = entity(type);
    if (!(WORKFLOW_ACTION_NAMES as string[]).includes(action)) throw new BadRequestException('Unknown action');
    if (!user.permissions.has(WORKFLOW_REGISTRY[e].permissions[action as WorkflowAction])) throw forbidden();
    return this.wf.check(e, id, action as WorkflowAction, user);
  }

  @Get(':entityType/:id/history')
  @Authenticated()
  history(@Param('entityType') type: string, @IdParam() id: string, @CurrentUser() user: RequestUser) {
    const e = entity(type);
    const readPerm = e === 'curriculum' ? 'curriculum.read' : e === 'template' ? 'template.read' : 'catalog.read';
    if (!user.permissions.has(readPerm)) throw forbidden();
    return this.wf.history(e, id);
  }
}
