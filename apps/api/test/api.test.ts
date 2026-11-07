/**
 * API integration tests: security controls, data integrity and workflow rules, exercised
 * through HTTP against a real PostgreSQL database (see global-setup.ts).
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, bootApp, login } from './helpers';

let app: INestApplication;
let admin: ReturnType<typeof as>;
let developer: ReturnType<typeof as>;
let reviewer: ReturnType<typeof as>;
let manager: ReturnType<typeof as>;
let viewer: ReturnType<typeof as>;

beforeAll(async () => {
  app = await bootApp();
  admin = as(app, (await login(app, 'admin@cdms.local')).token);
  developer = as(app, (await login(app, 'developer@cdms.local')).token);
  reviewer = as(app, (await login(app, 'reviewer@cdms.local')).token);
  manager = as(app, (await login(app, 'manager@cdms.local')).token);
  viewer = as(app, (await login(app, 'viewer@cdms.local')).token);
});
afterAll(async () => {
  await app?.close();
});

describe('authentication', () => {
  it('exposes health without auth but protects everything else', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    const res = await request(app.getHttpServer()).get('/api/v1/curricula').expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('rejects tampered tokens', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer abc.def.ghi')
      .expect(401);
  });

  it('uses a generic error for unknown users and wrong passwords', async () => {
    const a = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@cdms.local', password: 'x' });
    const b = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'viewer@cdms.local', password: 'wrong' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.title).toBe(b.body.title);
  });

  it('locks an account after repeated failures', async () => {
    const http = request(app.getHttpServer());
    const res = await admin.post('/admin/users', {
      email: 'lockme@cdms.local',
      fullNameEn: 'Lock',
      fullNameAr: 'قفل',
      password: 'Lock-me-Passw0rd',
      roleIds: [],
    });
    expect(res.status).toBe(201);
    for (let i = 0; i < 3; i++)
      await http.post('/api/v1/auth/login').send({ email: 'lockme@cdms.local', password: 'bad' });
    const locked = await http
      .post('/api/v1/auth/login')
      .send({ email: 'lockme@cdms.local', password: 'Lock-me-Passw0rd' });
    expect(locked.status).toBe(401);
    expect(locked.body.title).toMatch(/locked/i);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const http = request(app.getHttpServer());
    const { cookie } = await login(app, 'viewer@cdms.local');
    const first = await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    const rotated = first.headers['set-cookie'] as unknown as string[];
    expect(rotated[0]).toMatch(/HttpOnly/i);
    expect(rotated[0]).toMatch(/SameSite=Strict/i);
    // Re-using the old token = theft signal → whole family revoked, new token also dead.
    await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    await http.post('/api/v1/auth/refresh').set('Cookie', rotated).expect(401);
  });
});

describe('authorisation', () => {
  it('denies writes without permission (backend-enforced)', async () => {
    await viewer
      .post('/competencies', { code: 'CMP-X', titleEn: 'X', titleAr: 'س', type: 'core' })
      .expect(403);
    await developer.get('/admin/users').expect(403);
    await developer.get('/audit').expect(403);
  });

  it('prevents privilege escalation when granting roles', async () => {
    const roles = (await admin.get('/admin/roles')).body as { id: string; code: string }[];
    const sysAdmin = roles.find((r) => r.code === 'system_admin')!;
    // Create a user manager without role.write/all permissions.
    const role = await admin
      .post('/admin/roles', {
        code: 'user_manager',
        nameEn: 'User manager',
        nameAr: 'مدير المستخدمين',
        permissions: ['user.read', 'user.write'],
      })
      .expect(201);
    await admin
      .post('/admin/users', {
        email: 'um@cdms.local',
        fullNameEn: 'UM',
        fullNameAr: 'م',
        password: 'User-Manager-2026',
        roleIds: [role.body.id],
      })
      .expect(201);
    const um = as(app, (await login(app, 'um@cdms.local', 'User-Manager-2026')).token);
    const res = await um.post('/admin/users', {
      email: 'evil@cdms.local',
      fullNameEn: 'E',
      fullNameAr: 'ش',
      password: 'Evil-Passw0rd-2026',
      roleIds: [sysAdmin.id],
    });
    expect(res.status).toBe(422);
  });

  it('scopes curricula to the user institution', async () => {
    const list = (await viewer.get('/curricula')).body;
    expect(list.items.every((c: { status: string }) => c.status === 'published')).toBe(true);
    const draft = (await developer.get('/curricula?status=draft')).body.items[0];
    await viewer.get(`/curricula/${draft.id}`).expect(404);
  });

  it('rejects malformed ids and unknown fields cleanly', async () => {
    await admin.get('/curricula/not-a-uuid').expect(400);
    const res = await admin.post('/competencies', { code: 'bad code' }).expect(422);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

describe('workflow and integrity', () => {
  let unitId: string;
  let rowVersion: number;

  it('creates a draft unit with learning outcomes and links competencies', async () => {
    const comps = (await developer.get('/competencies?status=published')).body.items;
    const res = await developer
      .post('/units', {
        code: 'UNT-TEST-001',
        titleEn: 'Test unit',
        titleAr: 'وحدة اختبار',
        theoryHours: 10,
        practicalHours: 20,
        creditHours: 2,
        learningOutcomes: [{ code: 'LO1', textEn: 'Do things', textAr: 'ينفذ المهام' }],
      })
      .expect(201);
    unitId = res.body.id;
    await developer.post(`/units/${unitId}/competencies`, { targetIds: [comps[0].id] }).expect(204);
    const unit = (await developer.get(`/units/${unitId}`)).body;
    expect(unit.competencies).toHaveLength(1);
    expect(unit.learningOutcomes).toHaveLength(1);
    rowVersion = unit.rowVersion;
  });

  it('rejects stale updates (optimistic locking)', async () => {
    await developer
      .patch(`/units/${unitId}`, { titleEn: 'Renamed', rowVersion: rowVersion + 5 })
      .expect(409);
    const ok = await developer
      .patch(`/units/${unitId}`, { titleEn: 'Renamed', rowVersion })
      .expect(200);
    rowVersion = ok.body.rowVersion;
    // Regression: a partial update must not reset omitted fields to their defaults.
    const after = (await developer.get(`/units/${unitId}`)).body;
    expect(after.theoryHours).toBe(10);
    expect(after.learningOutcomes).toHaveLength(1);
  });

  it('requires a comment to return, and enforces four-eyes on approval', async () => {
    const sub = await developer.post(`/workflow/unit/${unitId}/transition`, {
      action: 'submit',
      rowVersion,
    });
    expect(sub.status, JSON.stringify(sub.body)).toBe(201);
    rowVersion = sub.body.rowVersion;
    await developer.patch(`/units/${unitId}`, { titleEn: 'Locked', rowVersion }).expect(409); // not editable in review
    await reviewer
      .post(`/workflow/unit/${unitId}/transition`, { action: 'return', rowVersion })
      .expect(422);
    // Manager (different person) approves; the developer could not (no permission + four-eyes).
    await developer
      .post(`/workflow/unit/${unitId}/transition`, { action: 'approve', rowVersion })
      .expect(403);
    const appr = await manager
      .post(`/workflow/unit/${unitId}/transition`, { action: 'approve', rowVersion })
      .expect(201);
    expect(appr.body.status).toBe('approved');
    const history = (await developer.get(`/workflow/unit/${unitId}/history`)).body;
    expect(history.map((h: { action: string }) => h.action)).toEqual([
      'approve',
      'submit',
      'create',
    ]);
  });

  it('prevents a manager approving their own submission', async () => {
    const c = await manager
      .post('/competencies', {
        code: 'CMP-SELF-01',
        titleEn: 'Self',
        titleAr: 'ذاتي',
        type: 'core',
        performanceCriteriaEn: 'x',
      })
      .expect(201);
    await manager
      .post(`/workflow/competency/${c.body.id}/transition`, {
        action: 'submit',
        rowVersion: c.body.rowVersion,
      })
      .expect(201);
    const res = await manager.post(`/workflow/competency/${c.body.id}/transition`, {
      action: 'approve',
      rowVersion: c.body.rowVersion + 1,
    });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/segregation/i);
  });

  it('blocks publishing a curriculum whose units are not published', async () => {
    const list = (await developer.get('/curricula?status=draft')).body.items;
    const cur = (await developer.get(`/curricula/${list[0].id}`)).body;
    await developer
      .put(`/curricula/${cur.id}/units`, {
        rowVersion: cur.rowVersion,
        units: [
          ...cur.units.map((u: { unitId: string }) => ({
            unitId: u.unitId,
            term: 1,
            isMandatory: true,
          })),
          { unitId, term: 2, isMandatory: true },
        ],
      })
      .expect(200);
    const issues = (await developer.get(`/curricula/${cur.id}/validation`)).body as {
      code: string;
      severity: string;
    }[];
    expect(issues.some((i) => i.code === 'units' && i.severity === 'error')).toBe(true);
  });

  it('protects shared records referenced by other records', async () => {
    const comps = (await admin.get('/competencies?q=CMP-OSH-01')).body.items;
    const impact = (await admin.get(`/competencies/${comps[0].id}/impact`)).body;
    expect(impact.publishedAffected).toBeGreaterThan(0);
    const res = await admin.post(`/workflow/competency/${comps[0].id}/transition`, {
      action: 'archive',
      rowVersion: comps[0].rowVersion,
    });
    expect(res.status).toBe(422);
  });

  it('rejects cycles in the occupational hierarchy', async () => {
    const roots = (await admin.get('/occupations?parentId=root')).body.items;
    expect(roots[0].childCount).toBeGreaterThan(0); // regression: correlated sub-query counts
    const child = (
      await admin.post('/occupations', {
        code: 'OCC-T1',
        titleEn: 'T1',
        titleAr: 'ت١',
        level: 'sub_major_group',
        parentId: roots[0].id,
      })
    ).body;
    const grand = (
      await admin.post('/occupations', {
        code: 'OCC-T2',
        titleEn: 'T2',
        titleAr: 'ت٢',
        level: 'minor_group',
        parentId: child.id,
      })
    ).body;
    // Re-parenting T1 under its own grandchild must fail (level rule or DB cycle trigger).
    const res = await admin.patch(`/occupations/${child.id}`, {
      parentId: grand.id,
      level: 'occupation',
      rowVersion: child.rowVersion,
    });
    expect([409, 422]).toContain(res.status);
  });

  it('rejects duplicate codes case-insensitively', async () => {
    const res = await admin.post('/competencies', {
      code: 'cmp-osh-01',
      titleEn: 'Dup',
      titleAr: 'مكرر',
      type: 'core',
    });
    expect(res.status).toBe(409);
  });

  it('creates new curriculum versions and supersedes on publish', async () => {
    const pub = (await admin.get('/curricula?status=published')).body.items[0];
    const v2 = await admin
      .post(`/curricula/${pub.id}/new-version`, { reason: 'Annual review' })
      .expect(201);
    expect(v2.body.version).toBe(pub.version + 1);
    expect(v2.body.status).toBe('draft');
    await admin.post(`/curricula/${pub.id}/new-version`, {}).expect(422); // only one open draft
    const versions = (await admin.get(`/curricula/${v2.body.id}/versions`)).body;
    expect(versions).toHaveLength(2);
  });
});

describe('audit trail', () => {
  it('records changes with field-level diffs', async () => {
    const res = (await admin.get('/audit?entityType=unit&action=unit.update')).body;
    expect(res.items[0].changes.titleEn).toEqual({ from: 'Test unit', to: 'Renamed' });
  });

  it('is append-only at database level', async () => {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    await expect(db.query('UPDATE audit_logs SET action = $1', ['tampered'])).rejects.toThrow(
      /append-only/,
    );
    await expect(db.query('DELETE FROM audit_logs')).rejects.toThrow(/append-only/);
    await db.end();
  });
});

describe('files and import/export', () => {
  it('rejects files whose content does not match the extension', async () => {
    const cur = (await developer.get('/curricula?status=draft')).body.items[0];
    const bad = await developer.upload(
      `/files/curriculum/${cur.id}`,
      {},
      { name: 'evil.pdf', content: Buffer.from('<script>alert(1)</script>') },
    );
    expect(bad.status).toBe(422);
    const good = await developer.upload(
      `/files/curriculum/${cur.id}`,
      {},
      { name: 'notes.txt', content: Buffer.from('Meeting notes — ملاحظات') },
    );
    expect(good.status).toBe(201);
    const dl = await developer.get(`/files/${good.body.id}/content`).expect(200);
    expect(dl.headers['content-disposition']).toMatch(/attachment/);
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
  });

  it('validates imports as a dry run and is all-or-nothing', async () => {
    const csv =
      'code,titleEn,titleAr,type\nCMP-IMP-01,Imported,مستورد,core\nCMP-IMP-02,,ناقص,core\n';
    const dry = await admin
      .upload(
        '/import',
        { entity: 'competency', format: 'csv', dryRun: 'true' },
        { name: 'c.csv', content: Buffer.from(csv) },
      )
      .expect(201);
    expect(dry.body.errors).toHaveLength(1);
    expect(dry.body.errors[0].row).toBe(3);
    const real = await admin
      .upload(
        '/import',
        { entity: 'competency', format: 'csv', dryRun: 'false' },
        { name: 'c.csv', content: Buffer.from(csv) },
      )
      .expect(201);
    expect(real.body.created).toBe(0);
    expect((await admin.get('/competencies?q=CMP-IMP-01')).body.total).toBe(0);
  });

  it('neutralises spreadsheet formulas in CSV exports', async () => {
    await admin
      .post('/competencies', {
        code: 'CMP-CSV-01',
        titleEn: '=HYPERLINK("http://x")',
        titleAr: 'صيغة',
        type: 'core',
      })
      .expect(201);
    const res = await admin.get('/export/competency?format=csv').expect(200);
    expect(res.text).toContain(`'=HYPERLINK`);
  });
});
