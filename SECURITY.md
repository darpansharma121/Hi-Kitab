# Security

## Supabase keys

- The browser app only accepts a Supabase publishable key (`sb_publishable_...`) or a legacy anon JWT. These keys are public by design and are exposed in the downloaded web app.
- Never use a Supabase secret key (`sb_secret_...`) or legacy `service_role` key in this project, a `VITE_` variable, or any client-side code. Those keys bypass row-level security and belong only in a trusted server environment.
- Row-level security must remain enabled. Apply `supabase/schema.sql` and verify its owner policies in Supabase before enabling cloud sync.
- Do not commit `.env`, `.env.local`, deployment environment files, private keys, credentials, exports, or customer data. `.env.example` is a placeholder and is safe to commit.

## If a secret is exposed

Revoke or rotate it in the provider immediately. Removing it from the latest commit is not enough because Git history and existing clones retain old values. Review the repository history and provider audit logs, then notify affected users if their data may have been accessed.

## Reporting

Do not report vulnerabilities by opening a public issue with credentials or customer data attached. Contact the repository owner privately with reproduction details and omit secrets and personal data.