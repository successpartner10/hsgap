# SignalGap Security Rules Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every unspecified collection and path is denied (`allow read, write: if false`).
2. **Verified Email Gate**: Unauthenticated users and users with `email_verified != true` cannot read or write any document.
3. **Allowlist Gate**: Only `sunnyguy664@gmail.com`, `sandipyashpal@gmail.com`, or emails present in `/allowed_emails/{lowercaseEmail}` can access `/watchlists/*`.
4. **Admin Isolation & PII Protection**: Only admins can list or edit `/allowed_emails/*`; non-admin members can `get` only their own `/allowed_emails/{ownEmail}` document and can never list other users' emails.
5. **Shared Admin vs. Personal Watchlist Separation**: `/watchlists/shared_admin` can only be read/written by admins (`role == 'admin'` or bootstrapped admins). `/watchlists/{uid}` can only be read/written by the matching user (`request.auth.uid == uid`) and must enforce `ownerId == request.auth.uid` and `scope == 'personal'`.
6. **Strict Schema & Array Bounds**: No shadow fields (`keys().hasOnly(...)`), bounded arrays (`customAssets <= 60`, `removedSymbols <= 50`, `favorites <= 80`), and server-enforced `request.time` timestamps.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. Unauthenticated read on `/allowed_emails/sunnyguy664@gmail.com` -> DENIED.
2. Unverified email (`email_verified: false`) pretending to be `sunnyguy664@gmail.com` writing `/watchlists/shared_admin` -> DENIED.
3. Non-allowlisted authenticated user (`outsider@gmail.com`) reading `/watchlists/shared_admin` or creating `/watchlists/{outsiderUid}` -> DENIED.
4. Allowed `member` (`member@gmail.com`) attempting `list` on `/allowed_emails` -> DENIED (PII leak blocked).
5. Allowed `member` attempting to read another user's `/allowed_emails/sunnyguy664@gmail.com` -> DENIED.
6. Allowed `member` attempting to write `/allowed_emails/member@gmail.com` with `role: 'admin'` (self-escalation) -> DENIED.
7. Allowed `member` attempting to read or write `/watchlists/shared_admin` -> DENIED.
8. Allowed `member` attempting to read or write `/watchlists/{otherMemberUid}` -> DENIED.
9. Allowed `member` creating `/watchlists/{ownUid}` with `scope: 'shared_admin'` or `ownerId: 'other'` -> DENIED.
10. Admin or member sending a shadow field (`isSuperAdmin: true`) on `/watchlists/{id}` -> DENIED (`hasOnly` check).
11. Admin or member sending forged `updatedAt` timestamp not equal to `request.time` -> DENIED.
12. Admin attempting to delete bootstrapped admin `sunnyguy664@gmail.com` or `sandipyashpal@gmail.com` -> DENIED.
