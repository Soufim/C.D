import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { PERMISSIONS } from '@cdms/contracts';
import type { FileDto, Permission } from '@cdms/contracts';
import { ENV, Env } from '../../config/env';
import { DB, Database } from '../../database/database.module';
import { files, users } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../../common/request-user';
import { businessRule, forbidden, notFound } from '../../common/errors';
import { iso } from '../../common/util';
import { validateUpload } from './file-validation';

export const ATTACHABLE: Record<string, { read: Permission; write: Permission }> = {
  curriculum: { read: PERMISSIONS.CURRICULUM_READ, write: PERMISSIONS.CURRICULUM_WRITE },
  unit: { read: PERMISSIONS.CATALOG_READ, write: PERMISSIONS.CATALOG_WRITE },
  competency: { read: PERMISSIONS.CATALOG_READ, write: PERMISSIONS.CATALOG_WRITE },
  occupation: { read: PERMISSIONS.CATALOG_READ, write: PERMISSIONS.CATALOG_WRITE },
  template: { read: PERMISSIONS.TEMPLATE_READ, write: PERMISSIONS.TEMPLATE_WRITE },
};

/**
 * Local-disk file storage under STORAGE_DIR (mount an institutional volume/NAS there).
 * Files are stored under random keys outside the web root and are only served through the API.
 */
@Injectable()
export class FilesService implements OnModuleInit {
  private root: string;
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
  ) {
    this.root = path.resolve(env.STORAGE_DIR);
  }

  async onModuleInit() {
    await mkdir(this.root, { recursive: true, mode: 0o750 });
  }

  private dto(f: typeof files.$inferSelect, uploader?: string | null): FileDto {
    return {
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      sha256: f.sha256,
      entityType: f.entityType,
      entityId: f.entityId,
      uploadedById: f.uploadedById,
      uploadedByName: uploader,
      createdAt: iso(f.createdAt)!,
    };
  }

  async upload(
    file: Express.Multer.File | undefined,
    entityType: string,
    entityId: string,
    user: RequestUser,
  ): Promise<FileDto> {
    if (!file) throw businessRule('No file provided');
    const policy = ATTACHABLE[entityType];
    if (!policy) throw businessRule('Files cannot be attached to this record type');
    if (!user.permissions.has(policy.write)) throw forbidden();
    const v = validateUpload(
      Buffer.from(file.originalname, 'latin1').toString('utf8'),
      file.buffer,
    );
    if (typeof v === 'string') throw businessRule(v, [{ path: 'file', message: v }]);

    const now = new Date();
    const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
    const abs = this.resolveKey(key);
    await mkdir(path.dirname(abs), { recursive: true, mode: 0o750 });
    await writeFile(`${abs}.part`, file.buffer, { mode: 0o640 });
    await rename(`${abs}.part`, abs);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    return this.db.transaction(async (tx) => {
      const [f] = await tx
        .insert(files)
        .values({
          originalName: v.safeName,
          mimeType: v.mimeType,
          sizeBytes: file.size,
          sha256,
          storageKey: key,
          entityType,
          entityId,
          uploadedById: user.id,
        })
        .returning();
      await this.audit.record(
        user,
        {
          action: 'file.upload',
          entityType: 'file',
          entityId: f.id,
          metadata: {
            name: v.safeName,
            size: file.size,
            sha256,
            attachedTo: { entityType, entityId },
          },
        },
        tx,
      );
      return this.dto(f);
    });
  }

  async list(entityType: string, entityId: string, user: RequestUser): Promise<FileDto[]> {
    const policy = ATTACHABLE[entityType];
    if (!policy || !user.permissions.has(policy.read)) throw forbidden();
    const rows = await this.db
      .select({ f: files, name: users.fullNameEn })
      .from(files)
      .leftJoin(users, eq(users.id, files.uploadedById))
      .where(
        and(
          eq(files.entityType, entityType),
          eq(files.entityId, entityId),
          isNull(files.deletedAt),
        ),
      )
      .orderBy(desc(files.createdAt));
    return rows.map((r) => this.dto(r.f, r.name));
  }

  async open(id: string, user: RequestUser) {
    const [f] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, id), isNull(files.deletedAt)));
    if (!f) throw notFound('File');
    const policy = f.entityType ? ATTACHABLE[f.entityType] : undefined;
    if (!policy || !user.permissions.has(policy.read)) throw notFound('File');
    await this.audit.record(user, { action: 'file.download', entityType: 'file', entityId: id });
    return { meta: f, stream: createReadStream(this.resolveKey(f.storageKey)) };
  }

  /** Soft delete: content is kept until the retention job/backup policy removes it. */
  async remove(id: string, user: RequestUser) {
    const [f] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, id), isNull(files.deletedAt)));
    if (!f) throw notFound('File');
    const policy = f.entityType ? ATTACHABLE[f.entityType] : undefined;
    if (!policy || !user.permissions.has(policy.write)) throw forbidden();
    await this.db.transaction(async (tx) => {
      await tx.update(files).set({ deletedAt: new Date() }).where(eq(files.id, id));
      await this.audit.record(
        user,
        {
          action: 'file.delete',
          entityType: 'file',
          entityId: id,
          metadata: { name: f.originalName },
        },
        tx,
      );
    });
  }

  /** Resolves a storage key and guarantees it stays inside the storage root (path traversal guard). */
  private resolveKey(key: string) {
    const abs = path.resolve(this.root, key);
    if (!abs.startsWith(this.root + path.sep)) throw forbidden('Invalid storage key');
    return abs;
  }
}
