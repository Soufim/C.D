import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/bootstrap';

export const PASSWORD = 'Test-Passw0rd-2026';
export type Http = ReturnType<typeof request>;

export async function bootApp() {
  const app = await createApp({ logger: false });
  await app.init();
  return app;
}

export async function login(app: INestApplication, email: string, password = PASSWORD) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password });
  if (res.status !== 200)
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    token: res.body.accessToken as string,
    cookie: res.headers['set-cookie'] as unknown as string[],
    user: res.body.user,
  };
}

/** Small authenticated client. */
export function as(app: INestApplication, token: string) {
  const s = () => request(app.getHttpServer());
  const h = { Authorization: `Bearer ${token}` };
  return {
    get: (u: string) => s().get(`/api/v1${u}`).set(h),
    post: (u: string, b?: object) =>
      s()
        .post(`/api/v1${u}`)
        .set(h)
        .send(b ?? {}),
    patch: (u: string, b: object) => s().patch(`/api/v1${u}`).set(h).send(b),
    put: (u: string, b: object) => s().put(`/api/v1${u}`).set(h).send(b),
    del: (u: string) => s().delete(`/api/v1${u}`).set(h),
    upload: (u: string, field: Record<string, string>, file: { name: string; content: Buffer }) => {
      const r = s().post(`/api/v1${u}`).set(h);
      Object.entries(field).forEach(([k, v]) => r.field(k, v));
      return r.attach('file', file.content, file.name);
    },
  };
}
