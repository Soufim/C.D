# Operations guide

Audience: Ministry system administrators. Everything uses open-source tooling on
Ministry-controlled Linux hosts — no paid services are required.

## 1. Reference infrastructure (proportionate sizing)

| Environment | Host | Notes |
|---|---|---|
| Production | 1 VM: Ubuntu Server 24.04 LTS, 4 vCPU, 8 GB RAM, 100 GB SSD (+ backup target) | Docker Engine + Compose plugin; sized for ~300 concurrent users with headroom |
| Staging / test | 1 VM: 2 vCPU, 4 GB, 50 GB | same images & compose file, separate `.env`, separate DB, synthetic data |
| Development | developer workstations | `deploy/compose.dev.yml` for PostgreSQL |

Separation: different hosts (or at minimum different Docker projects and volumes), different
secrets, different admin accounts; production data is never copied to dev/test unless
anonymised. Kubernetes is not required (ADR-001); add a second API replica behind nginx only
if monitoring shows the need.

## 2. Installation (production)

1. Harden the host: automatic security updates (`unattended-upgrades`), SSH keys only,
   firewall allowing 443 (and 22 from the admin network), NTP.
2. Install Docker Engine + Compose plugin from the official Docker apt repository.
3. Clone the repository to `/opt/cdms` from the Ministry Git server.
4. `cp deploy/.env.example .env`, set `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`
   (`openssl rand -base64 48`), `PUBLIC_ORIGIN`, `SEED_ADMIN_EMAIL`; `chmod 600 .env`.
5. TLS: terminate at the Ministry reverse proxy/load balancer forwarding to
   `127.0.0.1:8080`, **or** add a 443 server block with the Ministry certificate to
   `deploy/nginx.conf`. Then enable HSTS in nginx.conf.
6. `./scripts/release.sh v<version>`. The `migrate` service applies migrations and the
   idempotent seed; the first administrator password is printed once:
   `docker compose logs migrate`. Sign in and change it immediately.

## 3. Configuration

All configuration is environment variables validated at start-up (`apps/api/src/config/env.ts`);
the API refuses to start with invalid or insecure production settings. Secrets live only in
`.env` on the host (or Docker secrets) — never in git. Rotate `JWT_ACCESS_SECRET` by changing
it and restarting `api` (users re-login); rotate the DB password with `ALTER ROLE` + `.env` +
restart.

## 4. Release process

```bash
./scripts/release.sh v0.2.0
```

Steps: checkout tag → build images → **backup** → migrate + start → health check → on
failure, logs + rollback instructions. Releases are tagged commits that passed CI
(`scripts/verify.sh`). Record each release (version, date, operator, backup id) in the
release log.

## 5. Database migrations

- Generated SQL files in `apps/api/drizzle/`, reviewed in pull requests, applied in order by
  `migrate.js` inside a transaction and recorded in `drizzle.__drizzle_migrations`.
- Compatibility rule: a release's migrations must not break the **previous** application
  version (expand/contract): add nullable columns / new tables first; backfill; switch code;
  drop old columns in a later release. This keeps application rollback possible.
- Destructive migrations (drop/rename) require a backup taken immediately before and a
  documented manual rollback script in the PR.
- Validate on staging with a restored copy of production before every release.

## 6. Backups

| Item | Method | Frequency | Retention |
|---|---|---|---|
| Database | `pg_dump --format=custom` | daily 01:30 + before every release | 30 days daily (configurable), keep monthly copies 12 months |
| Uploaded files | tar of the `file-storage` volume | daily | same |
| Configuration | `.env` (encrypted copy in the Ministry secrets vault), git tag | on change | indefinite |

`scripts/backup.sh` writes `db.dump`, `storage.tar.gz`, `manifest.txt`, `SHA256SUMS` and
verifies the dump is readable. Schedule with cron/systemd; then copy `BACKUP_DIR` to separate
storage (another server / institutional NAS, e.g. via `rsync` or `restic` with encryption).
Backup storage access: backup operators only; encrypted at rest.

## 7. Restore, disaster recovery, RPO/RTO

```bash
./scripts/restore.sh /var/backups/cdms/<timestamp>
```

Verifies checksums, stops app containers, recreates the DB, restores files, restarts.

| Objective | Target (proposed) |
|---|---|
| RPO | ≤ 24 h (daily backups); ≤ 1 h achievable by adding WAL archiving (pgBackRest, open source) |
| RTO | ≤ 4 h on a prepared standby VM; ≤ 8 h from bare VM |

**DR drill (quarterly)**: provision a clean VM, install Docker, clone repo, restore the latest
off-host backup, run smoke checks (login, open a curriculum, download a file), record duration
and issues.

## 8. Monitoring, logging, alerting

- **Health**: `/api/v1/health/live`, `/api/v1/health/ready` (DB check); container health
  checks restart failed services (`restart: unless-stopped`).
- **Logs**: API emits JSON (pino) with request ids (`X-Request-Id`); authorization headers and
  cookies are redacted. Docker rotates logs (20 MB × 10). Ship to the Ministry log platform or
  self-host Grafana Loki + Promtail / or an ELK stack.
- **Metrics/alerts** (open source): Uptime Kuma for HTTP checks; node-exporter + cAdvisor +
  postgres-exporter → Prometheus → Grafana/Alertmanager (e-mail via Ministry SMTP). Alert on:
  readiness failing, 5xx rate, disk > 80 %, backup job failure, container restarts, DB
  connections near limit, certificate expiry < 21 days.
- **Security events**: audit log entries with outcome `failure` (logins, refresh reuse) —
  review weekly; alert on `auth.refresh_reuse_detected` and bursts of failed logins.

## 9. Rollback

1. **Application only** (migrations compatible): `./scripts/release.sh <previous-tag>`.
2. **With data**: stop, `./scripts/restore.sh <pre-release backup>`, then release the previous
   tag. Data entered after the backup is lost → communicate; prefer forward fixes when safe.

## 10. Incident response

| Phase | Actions |
|---|---|
| Detect | alerts, user reports, audit anomalies |
| Triage (≤ 1 h) | classify severity (S1 outage/breach, S2 degraded, S3 minor); appoint incident lead; notify Ministry IT security per institutional policy |
| Contain | suspected compromise: rotate `JWT_ACCESS_SECRET` (invalidates sessions), disable affected accounts, block IPs at the proxy, preserve logs/audit (do not restore over evidence) |
| Eradicate & recover | patch, restore from known-good backup if needed, verify integrity via audit trail |
| Notify | data-exposure obligations under Law 151/2020 and Ministry policy; stakeholders |
| Review (≤ 10 days) | post-incident report, actions tracked to closure |

Escalation: on-call administrator → Ministry IT security lead → CIO/steering committee.

## 11. Patching and maintenance

| Task | Interval | Responsible |
|---|---|---|
| OS security updates (unattended) + reboot window | weekly | system admin |
| Rebuild images to pick up base-image fixes (`docker compose build --pull`) | monthly, or on critical CVE | system admin |
| Dependency updates (Dependabot/Renovate PRs → CI → review) | weekly triage, monthly merge | developer |
| `npm audit` / Trivy findings: Critical ≤ 48 h, High ≤ 7 d | continuous | developer |
| Major framework upgrades (Node LTS, NestJS, React, PostgreSQL) | plan yearly; Node LTS every 2 years | tech lead |
| Restore test / DR drill | quarterly | system admin |
| Access review (users, roles, admin accounts) | quarterly | business owner |
| Certificate renewal | before expiry | system admin |

Supported versions at handover: Node.js 22 LTS (EOL Apr 2027 → plan Node 24 LTS in 2026/27),
PostgreSQL 16 (EOL Nov 2028), Ubuntu 24.04 LTS (standard support to 2029).

## 12. Routine administration

Users & roles via the UI (Administration); reset passwords; deactivate leavers (sessions are
revoked immediately); maintain reference lists; monitor review queue; export catalogue monthly
for archival. Basic troubleshooting: `docker compose ps`, `docker compose logs -f api`,
check `/api/v1/health/ready`, find a failing request by its `traceId` in the logs.
