# Handover, ownership and sustainability

## 1. Technical asset & service register (template — complete at handover)

| Asset | Type | Location / identifier | Owner (Ministry account) | Recurring cost | Renewal |
|---|---|---|---|---|---|
| Source code repository | Git | Ministry Git server (mirror of development repo) | IT dept. group | none | — |
| Production VM | infrastructure | Ministry data centre / private cloud | IT operations | existing institutional | — |
| Staging VM | infrastructure | | IT operations | existing institutional | — |
| PostgreSQL 16 database | container + volume `db-data` | production VM | DBA | none (OSS) | — |
| File storage | volume `file-storage` / NAS mount | | IT operations | existing | — |
| Backup storage | NAS / secondary server | `BACKUP_DIR` + off-host copy | backup operator | existing | — |
| Container images | `cdms/api`, `cdms/web` | built on host or Ministry registry (e.g. Harbor/Gitea, OSS) | IT operations | none | — |
| Domain / DNS | `cdms.<ministry domain>` | Ministry DNS | network team | existing | annual |
| TLS certificate | X.509 | Ministry CA or Let's Encrypt | network team | none / existing | per CA |
| CI configuration | `.github/workflows/ci.yml`, `scripts/verify.sh` | repo | dev team | none (self-hosted runner or local script) | — |
| Monitoring | Uptime Kuma / Prometheus / Grafana (optional) | ops VM | IT operations | none (OSS) | — |
| Secrets | `.env` (DB password, JWT secret) | production host + Ministry vault | IT security | none | rotate yearly |
| Administrative accounts | CDMS `system_admin`, host sudo, DB superuser | | named Ministry staff | none | quarterly review |
| Third-party services | **none required** | — | — | — | — |

## 2. Software inventory (runtime)

| Component | Licence |
|---|---|
| Node.js 22, NestJS 11, Express 5, Drizzle ORM, pg, zod, helmet, pino, argon2 (@node-rs) | MIT |
| React 19, React Router 7, TanStack Query, react-hook-form, i18next, Radix UI, lucide, sonner, Tailwind CSS 4, class-variance-authority, clsx, tailwind-merge | MIT / ISC |
| papaparse, cookie-parser | MIT |
| Inter, IBM Plex Sans Arabic (self-hosted fonts) | SIL OFL 1.1 |
| PostgreSQL 16 | PostgreSQL licence |
| nginx (unprivileged image), Debian/Alpine base images | BSD-2 / various OSS |

Generate the exact list at handover with `npx license-checker --production --summary` and an
SBOM (`docker sbom` or `syft`) for each image.

## 3. Ownership transfer checklist

- [ ] Repository (with full history) pushed to Ministry Git; contractor access removed
- [ ] Production/staging hosts, DNS, certificates under Ministry accounts
- [ ] All secrets rotated **after** handover by Ministry staff; old values destroyed
- [ ] CDMS admin accounts are named Ministry staff; contractor CDMS accounts deactivated
- [ ] Backup destinations and schedules owned by Ministry operators; restore test witnessed
- [ ] Monitoring/alerting recipients are Ministry addresses
- [ ] No dependency on personal or contractor-controlled accounts (verified below)

## 4. Independent build & deploy verification

Ministry staff, on a clean Ministry VM, using only this repository and documentation:
1. `./scripts/verify.sh` passes.
2. `docker compose build` succeeds (base images from Docker Hub or a Ministry mirror).
3. `./scripts/release.sh <tag>` deploys; first-admin login works.
4. Restore of a production backup succeeds (`restore.sh`).
Record the run (date, operator, duration, issues) as handover evidence.

## 5. Knowledge transfer plan

| Session | Audience | Content | Hands-on |
|---|---|---|---|
| 1 Architecture & code tour | developers | modules, contracts, AGENTS.md, adding a field end-to-end | add a field with migration + UI + test |
| 2 Deployment & containers | sysadmins | compose services, release, rollback, logs | perform a release and a rollback on staging |
| 3 Backup & DR | sysadmins / DBA | backup.sh, restore.sh, off-host copies, RPO/RTO | restore to a clean VM |
| 4 Monitoring & incidents | sysadmins / security | health, logs, alerts, incident runbook | simulate refresh-token reuse alert |
| 5 Security maintenance | developers / security | dependency updates, Trivy, ASVS, pen-test findings | process a Dependabot PR |
| 6 Administration | business admins | users, roles, reference data, imports, audit | onboard a user, import a CSV |

## 6. Five-year sustainability & cost assessment

**Recurring licence / subscription costs: none.** All components are open source; no paid
AI, cloud, database, monitoring, CI or per-user fees are required.

| Cost item | Year 1 | Years 2–5 (per year) | Notes |
|---|---|---|---|
| Production VM (4 vCPU / 8 GB / 100 GB) | existing infrastructure | existing | marginal share of Ministry virtualisation capacity |
| Staging VM (2 vCPU / 4 GB) | existing | existing | |
| Backup storage (~50 GB/yr growth estimate incl. retention) | existing NAS | existing | grows with uploaded files |
| TLS certificate | Ministry CA / free ACME | same | |
| Technical support (internal) | ~0.5 FTE developer + 0.2 FTE sysadmin | ~0.3 FTE dev + 0.1 FTE sysadmin | patches, minor features, user support |
| Framework upgrades | — | 2–4 person-weeks every ~2 years | Node LTS, NestJS/React majors, PostgreSQL major (pg_upgrade/dump-restore) |
| Penetration test (recommended) | 1 × before go-live | 1 × every 2 years or after major change | can use Ministry/government security unit |
| Optional: commercial support for OS/DB | — | — | only if Ministry policy requires; not needed technically |

Risks and mitigations: skills availability (TypeScript is mainstream; AGENTS.md lowers onboarding
cost) · dependency churn (small dependency set, Dependabot, monthly cadence) · single-VM
availability (documented DR; add standby VM if SLA requires) · data growth (files on NAS;
DB small — tens of MB per thousand curricula).

## 7. Independence verification

The system was designed and is verified to run without: commercial cloud platforms,
contractor-controlled hosting or accounts, proprietary managed databases, paid AI APIs,
external CDNs/fonts/analytics, or paid CI. Unavoidable costs are limited to the Ministry's own
infrastructure and staff time listed above.
