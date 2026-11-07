import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Authenticated, CurrentUser } from '../../common/auth.decorators';
import type { RequestUser } from '../../common/request-user';
import { ZodPipe } from '../../common/zod';
import { NotificationsService } from './notifications.service';

const markReadSchema = z.object({ ids: z.array(z.uuid()).max(200).optional() });

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @Authenticated()
  list(@CurrentUser() user: RequestUser) {
    return this.svc.list(user.id);
  }

  @Post('read')
  @HttpCode(204)
  @Authenticated()
  read(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(markReadSchema)) body: z.infer<typeof markReadSchema>,
  ) {
    return this.svc.markRead(user.id, body.ids);
  }
}
