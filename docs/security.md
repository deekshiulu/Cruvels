# Cruvels Intern Mail Portal — Security & Threat Mitigation Specification

## 1. Zero-Trust Authorization Model

### 1.1 Invariant: No Client Trust
The portal assumes that any client request can be manipulated. 
- Mailbox queries do NOT accept client parameters like `?alias=user@cruvels.com` or `?ownerUserId=123`.
- The user identity is extracted solely from the verified JWT HTTP-Only session cookie.
- The user's active assigned aliases are verified against the database during every request.

### 1.2 IDOR / BOLA Prevention
Access to every message and attachment is mediated through the centralized security layer:
```typescript
// Enforced in /api/messages/[id]
const message = await assertMessageOwnership(user, messageId);

// Enforced in /api/messages/[id]/attachments/[attId]
const { message, attachment } = await assertAttachmentOwnership(user, messageId, attachmentId);
```
Attempts by User A to access a message or attachment owned by User B trigger a logged `UNAUTHORIZED_MESSAGE_ACCESS_ATTEMPT` audit event and return a non-enumerating `403 Forbidden` or `404 Not Found`.

---

## 2. Inbound & Outbound Email Security

### 2.1 Sender Spoofing & Header Injection Defense
- When composing or replying, the `From` header is strictly overridden on the server with the user's primary alias (`user.primaryAlias`).
- Any custom `from` field sent in the JSON payload is discarded.
- Recipient fields (`To`, `Cc`, `Bcc`) and `Subject` headers are sanitized to remove CRLF (`\r\n`) characters, preventing SMTP header injection.

### 2.2 Inbound HTML Email Sanitization
- Inbound HTML bodies are filtered with `sanitize-html` and DOMPurify.
- All `<script>`, `<object>`, `<embed>`, `<iframe>`, `<form>`, `<base>`, `<meta>`, and `<link>` tags are stripped.
- Attributes containing `javascript:`, `vbscript:`, or `data:text/html` are neutralized.
- Inline event handlers (`onclick`, `onerror`, `onload`, `onmouseover`, etc.) are discarded.
- All external anchor tags are modified to include `target="_blank" rel="noopener noreferrer nofollow"`.

---

## 3. Authentication & Account Lifecycle

### 3.1 Password Security
- Passwords are hashed using PBKDF2 with SHA-512 and 10,000 iterations.
- Comparisons use `crypto.timingSafeEqual` to prevent side-channel timing attacks.

### 3.2 Immediate Account Revocation
When an admin disables an intern (`user.status = 'disabled'`):
- The `verifySessionToken` routine dynamically checks user status in the database.
- Active tokens are instantly rejected on subsequent requests.
- Disabled interns cannot log in, read cached mail, download attachments, or dispatch emails.

---

## 4. Rate Limiting & Abuse Defense

| Action | Rate Limit Threshold | Window |
|---|---|---|
| **Login Attempts** | 10 requests | 60 seconds (per IP) |
| **Email Dispatch** | 30 emails | 3600 seconds (per user) |
| **Attachment Downloads** | 20 downloads | 60 seconds (per user) |
| **Incremental Sync** | 4 requests | 60 seconds (per user) |

---

## 5. Security Headers & CSP
Configured in `next.config.ts`:
- `Content-Security-Policy`: Restricts scripts, frames, and connections.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options`: `SAMEORIGIN`
- `X-Content-Type-Options`: `nosniff`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`

---

## 6. Audit Trail & Redaction
All security-sensitive events (`LOGIN`, `LOGIN_FAILED`, `READ_MESSAGE`, `SEND_MESSAGE`, `REPLY_MESSAGE`, `DOWNLOAD_ATTACHMENT`, `ADMIN_CREATE_USER`, `ADMIN_DISABLE_USER`, `ADMIN_ASSIGN_ALIAS`, `ADMIN_RESET_ACCESS`) are saved in the `audit_logs` table.
- Sensitive fields (`password`, `token`, `secret`, `cookie`, `access_token`) are automatically redacted before logging.
- Audit logs are accessible only to authenticated administrators.
