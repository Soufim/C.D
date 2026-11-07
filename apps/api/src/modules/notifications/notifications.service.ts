import { Inject, Injectable } from '@nestjs/common';
import { and, arrayOverlaps, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NotificationDto, Permission } from '@cdms/contracts';
import { DB, Database, DbOrTx } from '../../database/database.module';
import { notifications, roles, userRoles, users } from '../../database/schema';
import { iso } from '../../common/util';

export interface NewNotification {
  titleEn: string;
  titleAr: string;
  link?: string;
}

/** In-app notifications (no external e-mail/SMS dependency). */
@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async notifyUsers(userIds: string[], n: NewNotification, tx: DbOrTx = this.db) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;
    await tx
      .insert(notifications)
      .values(unique.map((userId) => ({ userId, ...n, link: n.link ?? null })));
  }

  /** Notifies every active user holding the permission (optionally within an institution). */
  async notifyPermission(
    permission: Permission,
    n: NewNotification,
    excludeUserId?: string,
    tx: DbOrTx = this.db,
  ) {
    const rows = await tx
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(users.isActive, true), arrayOverlaps(roles.permissions, [permission])));
    await this.notifyUsers(
      rows.map((r) => r.id).filter((id) => id !== excludeUserId),
      n,
      tx,
    );
  }

  async list(userId: string): Promise<{ items: NotificationDto[]; unread: number }> {
    const [items, [{ unread }]] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50),
      this.db
        .select({ unread: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    ]);
    return {
      unread,
      items: items.map((n) => ({
        id: n.id,
        titleEn: n.titleEn,
        titleAr: n.titleAr,
        link: n.link,
        readAt: iso(n.readAt),
        createdAt: iso(n.createdAt)!,
      })),
    };
  }

  async markRead(userId: string, ids?: string[]) {
    const where = ids?.length
      ? and(eq(notifications.userId, userId), inArray(notifications.id, ids))
      : eq(notifications.userId, userId);
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(where, isNull(notifications.readAt)));
  }
}
