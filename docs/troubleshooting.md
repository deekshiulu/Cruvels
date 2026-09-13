# Cruvels Intern Mail Portal — Troubleshooting & FAQs

## 1. Frequently Asked Questions

### Q: An intern is not receiving an incoming email sent to their alias.
1. Check if the alias is marked active in the Admin Dashboard (`/admin`).
2. Verify that the incoming email actually included the intern's alias in `To`, `Cc`, or `Bcc`.
3. Check the **System Security Audit Trail** for any `EMAIL_SYNC_FAILED` events.
4. Click **Sync Mailbox** in the sidebar or **Trigger Mail Sync** in the Admin Portal to run an immediate sync cycle.

### Q: An intern sees "Access denied. Your account is disabled."
- The account has been placed into `disabled` status by an administrator. Contact the administrator to re-enable access.

### Q: An intern cannot send an email ("Email send rate limit reached").
- The rate limiter prevents abuse (limit is 30 emails per hour per user). The restriction resets automatically after the window expires.

### Q: How do I switch from the Mock Provider to live Google Workspace?
1. Follow the instructions in `docs/email-integration.md`.
2. Update `.env.local` with `EMAIL_PROVIDER_MODE="google_service_account"` and configure your Service Account credentials.
3. Restart the dev server or redeploy.

---

## 2. Common Error Codes & Mitigations

| HTTP Code | Error Message | Solution |
|---|---|---|
| `401 Unauthorized` | "Authentication required. Please log in." | Log in again; the JWT session cookie may have expired. |
| `403 Forbidden` | "Access denied to requested message." | The message does not belong to the authenticated intern (IDOR protection). |
| `403 Forbidden` | "Forbidden. Administrative privileges required." | Intern account attempting to access `/admin` or admin API endpoints. |
| `429 Too Many Requests` | "Too many login attempts." | Wait 60 seconds for the IP brute-force lock to expire. |
