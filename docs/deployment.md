# Cruvels Internal Portal — Production Deployment Checklist & Rollback Procedures

## 1. Overview
This document outlines the deployment workflow, production readiness checklist, and operational rollback procedures for the **Cruvels Internal Workplace & Mail Portal**, as mandated in Section 15 and Section 18 of the Intern Development Assignment.

---

## 2. Pre-Deployment Verification Checklist

Before deploying any release to staging or production, the following verification gates must pass:

- [x] **Automated Regression Test Suite**: All 16 Vitest test suites must pass 100% green without skips or weakened assertions (`npm test`).
- [x] **Static Type Check**: Strict TypeScript compilation check must pass with zero diagnostic errors (`npx tsc --noEmit`).
- [x] **Production Bundle Compilation**: Next.js production build must compile all static pages, server components, and API routes successfully (`npm run build`).
- [x] **Zero Secret Leakage**: No `.env.local`, JWT secrets, Supabase service-role keys, or API tokens committed in source control or exposed to client-side bundles.
- [x] **Sanitization & Security Headers**: Content-Security-Policy, HSTS, X-Frame-Options, and X-Content-Type-Options active in `next.config.ts`.
- [x] **Rate Limiting & Zero-Trust Checks**: Server-side session verification active across all protected endpoints with anti-brute force throttling enabled.
- [x] **Database Migrations & Seed Data**: Baseline schema integrity and seed accounts (`admin`, `charith`, `niketh`, `rahul`, `priya`, `interns`) intact.
- [x] **Demo Credential Hygiene**: No hardcoded test credentials or pre-fill buttons displayed on public login routes.

---

## 3. Environment Configuration

The following environment variables must be defined in the production runtime environment (e.g. Vercel, AWS ECS, or Docker):

| Variable | Required | Description | Example / Default |
|:---|:---|:---|:---|
| `NODE_ENV` | Yes | Runtime mode | `production` |
| `PORT` | Optional | HTTP server listen port | `3000` (or `3005` in dev) |
| `SESSION_SECRET` | Yes | Cryptographic HMAC secret for JWT signing | 64+ char random hex |
| `DATABASE_URL` | Optional | Direct PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Optional | Supabase public anonymous client key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase privileged server key | Server-only secret |
| `CRON_SECRET` | Yes | Shared secret for automated mail sync worker | 32+ char random token |
| `VAPID_PRIVATE_KEY` | Optional | Web Push notification private signing key | ECDSA P-256 base64 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`| Optional | Web Push notification public client key | ECDSA P-256 base64 |

---

## 4. Production Deployment Procedure

### Step 1: Source Control Cleanliness
```bash
git checkout main
git pull origin main
git status  # Verify clean working tree
```

### Step 2: Dependency Verification
```bash
npm ci --prefer-offline
```

### Step 3: Run Full Test Suite
```bash
npm test
```

### Step 4: Validate Static Types & Build Production Bundle
```bash
npx tsc --noEmit
npm run build
```

### Step 5: Start Service & Smoke Test Health
```bash
npm run start
# In a separate terminal or monitoring check:
curl -f http://localhost:3000/api/health
```

Expected health check response:
```json
{
  "status": "healthy",
  "service": "Cruvels Internal Portal",
  "version": "1.0.0",
  "timestamp": "2026-09-18T...",
  "storage": "operational",
  "auth": "active"
}
```

---

## 5. Rollback Procedures & Runbook

If a critical failure occurs post-deployment (e.g., unexpected 500 error spikes, database connection degradation, or session verification anomalies), execute the following rollback steps immediately:

### Scenario A: Application Layer Failure (Regressed Build)
1. **Identify Previous Stable Commit**:
   ```bash
   git log -n 5 --oneline
   ```
2. **Revert to Previous Release Tag or Commit**:
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT_HASH>
   npm ci
   npm run build
   pm2 restart cruvels-portal || systemctl restart cruvels-portal
   ```
3. **Verify Health Endpoint**:
   ```bash
   curl -i http://localhost:3000/api/health
   ```

### Scenario B: Corrupted Local or Supabase Data Store
1. If using `data/cruvels_db.json` fallback storage:
   - Restore from the pre-deployment timestamped snapshot located in `data/backups/` or git checkout:
     ```bash
     git checkout HEAD~1 -- data/cruvels_db.json
     ```
2. If using Supabase / PostgreSQL:
   - Apply rollback SQL migration scripts located in `supabase/migrations/` in reverse chronological order.
   - Or restore the point-in-time backup from the Supabase dashboard.

### Scenario C: Compromised Session Secrets or Token Invalidation
1. If a session secret was inadvertently compromised:
   - Immediately rotate `SESSION_SECRET` in environment variables.
   - Restart the server process. All existing JWT session tokens will instantly be rejected.
   - Users will be securely prompted to re-authenticate at `/login`.
2. Review the immutable audit log (`dataStore.getAuditLogs()` or `/api/admin/audit-logs`) to verify unauthorized access attempts.

---

## 6. Post-Deployment Verification & Sign-Off
After any deployment or rollback, perform manual sign-off:
1. Log in with an admin account (`admin`).
2. Verify Dashboard widgets: attendance stats, recent notices, schedule events.
3. Punch attendance and verify daily record is locked to Indian Standard Time (IST).
4. Send an internal test message via Mail Gateway and confirm isolation.
5. Check `/api/admin/audit-logs` for clean event recording.
