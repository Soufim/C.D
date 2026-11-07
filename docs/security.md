# Security

## 1. Assets and trust boundaries

| Asset | Sensitivity | Notes |
|---|---|---|
| Published curricula & standards | integrity-critical (official reference) | public-interest content; unauthorised change is the main risk |
| Draft curricula, reviewer comments | confidential (internal) | institution-scoped |
| User accounts, roles, sessions | high | privilege escalation path |
| Audit trail | integrity-critical | accountability evidence |
| Uploaded files | confidential; malware vector | |
| Secrets (`JWT_ACCESS_SECRET`, DB password) | critical | |

Boundaries: (1) Internet/Ministry network → nginx; (2) nginx → API (internal Docker network);
(3) API → PostgreSQL & file volume; (4) administrators → Docker host (SSH); (5) backups →
backup storage; (6) optional IdP.

## 2. Threat model (STRIDE, critical flows)

| # | Threat | Flow | Controls | Residual / action |
|---|---|---|---|---|
| T1 | Credential stuffing / brute force | login | argon2id; generic errors; lockout after N failures (`LOGIN_MAX_FAILED_ATTEMPTS`); per-IP rate limit 10/min; audit of failures | add IdP MFA (ADR-006) for admins |
| T2 | Session theft / replay | refresh | refresh token httpOnly + SameSite=Strict + Secure, path-scoped, hashed at rest, rotation + **family revocation on reuse**; 15-min access token in memory | XSS would still allow in-session actions → CSP |
| T3 | Privilege escalation | admin | permission-based guard (fail closed); grantors cannot grant permissions they lack; cannot change own roles/deactivate self; system_admin keeps all perms | review role changes in audit |
| T4 | IDOR / horizontal access | curricula | institution scoping in service; 404 outside scope; UUIDs | add scoping to other entities if required by policy |
| T5 | Tampering with published standards | catalogue | status locks, four-eyes, versioning, impact checks, FK RESTRICT, optimistic locking, audit diffs | |
| T6 | Repudiation | all writes | audit in same transaction; append-only via DB triggers; actor, IP, UA, request id | ship logs off-host (operations §7) |
| T7 | Injection (SQL, CSV, header) | API, export | parameterised Drizzle; sort allow-lists; LIKE escaping; CSV formula neutralisation; RFC 5987 filenames | |
| T8 | XSS | web | React escaping; no `dangerouslySetInnerHTML`; strict CSP (`script-src 'self'`, no inline); `nosniff`; downloads as attachments | |
| T9 | Malicious upload / path traversal | files | extension allow-list + magic-byte sniffing; 20 MB cap; random storage keys outside web root; path guard; served with `attachment` + `nosniff` | add ClamAV scan (open source) if files are shared externally |
| T10 | DoS | API | rate limits; body limit 2 MB; upload limits; statement timeout 30 s; bounded imports (5 000 rows); page size ≤ 200; container memory limits | |
| T11 | Info disclosure | errors, logs | problem+json without stack/SQL; log redaction of auth headers/cookies; no OpenAPI in production | |
| T12 | Secret leakage / supply chain | repo, images | `.env` git-ignored; env validated (refuses default secret in prod); lockfile; `npm audit`; Trivy; Dependabot; non-root read-only containers | |
| T13 | Data exposure to external AI tools | development | ADR-005; governance §2: no production data or secrets in prompts; use synthetic seed data | |

## 3. OWASP ASVS 4.0.3 (Level 2) mapping — summary

| Chapter | Status | Evidence |
|---|---|---|
| V1 Architecture | ✔ | docs/architecture.md, threat model above, AGENTS.md rules |
| V2 Authentication | ✔ (L2 MFA via IdP pending) | 12+ char passwords, max 128, argon2id, lockout, generic errors, password change revokes sessions |
| V3 Session | ✔ | rotation, reuse detection, logout revokes family, Secure/HttpOnly/SameSite cookies, absolute refresh lifetime (7 d) |
| V4 Access control | ✔ | deny-by-default guard, permission checks per route & action, row-level scoping, integration tests |
| V5 Validation & encoding | ✔ | zod at every boundary (body, query, params), output encoding by React, CSV neutralisation |
| V7 Errors & logging | ✔ | RFC 9457, request ids, structured logs, audit trail, no sensitive data in logs |
| V8 Data protection | ✔ / ops | no caching of API responses (`no-store` on files), backups encrypted at rest by host (ops) |
| V9 Communications | ops | TLS 1.2+ at reverse proxy; HSTS once HTTPS-only |
| V10 Malicious code | ✔ | dependency audit, lockfile, no dynamic code |
| V12 Files | ✔ | type/size/content checks, safe names, storage outside webroot |
| V13 API | ✔ | versioned REST, content-type enforcement, CORS allow-list, rate limits |
| V14 Configuration | ✔ | validated env, helmet headers, non-root read-only containers, production refuses insecure config |

A full per-requirement checklist is maintained in the security review workbook during each
phase gate (governance §4).

## 4. Verification procedures

- **Automated (every change)**: integration tests for authz/session/integrity; lint; `npm
  audit --omit=dev --audit-level=high`; Trivy image scan; migration consistency.
- **Per phase gate**: manual ASVS walkthrough of changed areas; secrets scan of the repo
  (e.g. gitleaks); review of audit samples.
- **Before production**: independent **penetration test** by qualified personnel not involved
  in implementation. Scope: web app, API (authn/z, privilege escalation, IDOR, business-logic
  bypass of workflow/four-eyes, file upload & download, import), session handling, nginx/TLS
  config, container/host hardening. Test accounts for every role and two institutions.

## 5. Findings and remediation process

1. Log each finding (ID, CVSS / severity, affected component, evidence, owner, due date).
2. SLA: Critical 48 h · High 7 days · Medium 30 days · Low next release.
3. Fix with a regression test; reference finding ID in the commit.
4. Retest by the original tester (or independent reviewer); record evidence.
5. **No production go-live with open Critical/High** findings unless the Ministry formally
   accepts the risk with compensating controls and an expiry date. Unresolved Critical findings
   are escalated to the project steering committee.

## 6. Privacy & personal data

- **Minimisation**: only staff identity data needed for access control and accountability
  (see data-model.md). No learner or citizen personal data.
- **Legal basis**: aligned with Egypt's Personal Data Protection Law No. 151 of 2020 and
  Ministry policies — Ministry is controller; processing limited to system administration.
- **Access**: user data visible to `user.read` holders only; audit to `audit.read`.
- **Retention** (proposal for Ministry approval): audit logs 5 years then archived offline;
  refresh-token rows purged after expiry (on login) — add a periodic purge job if desired;
  deactivated accounts retained for audit linkage (names may be pseudonymised on request).
- **Transfers**: data stays on Ministry infrastructure; no third-party processors, analytics,
  CDNs or AI services. Development uses synthetic seed data only.
- **Backups** inherit the same classification: encrypted storage, restricted access.
