# Portfolio CMS backend setup

The CMS backend is implemented locally but remains inactive until this setup is reviewed and completed. No migration or remote Supabase operation has been run.

## Runtime configuration

Provide these non-service-role values to the server runtime:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

For Cloudflare deployments, configure them as runtime bindings available through the request's Cloudflare environment. The CMS server reads those request-scoped bindings; it does not read `.env` files or use a service-role key. The existing browser authentication continues to use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Database preflight and administrator bootstrap

Before applying the migrations in order, inspect the remote schema for all `portfolio_cms_*` names, tables, functions, grants, and policies, and check whether the `portfolio-cms-media` bucket or corresponding Storage policies already exist. The migrations are additive and use plain `CREATE` statements so a name collision fails instead of silently adopting an unrelated object. They do not modify or repurpose `site_settings`.

After a reviewed migration is applied, a trusted operator must provision the intended existing Supabase Auth user's UUID into `public.portfolio_cms_admins` using a separately approved privileged operation. The migration deliberately grants no user the ability to self-enroll as an administrator. Until this allowlist row exists, every CMS read/write RPC requiring administrator access is denied. Do not use the browser-side `VITE_SUPABASE_ADMIN_UID` check as server authorization.

## Authorization and data exposure

Admin requests send the access token from the existing Supabase browser session. The server validates it with Supabase Auth `getUser(token)` and forwards that bearer token to PostgREST. The database functions independently verify `auth.uid()` against the administrator allowlist; no user ID from a request body is trusted. No service-role credential is used.

CMS tables have RLS enabled, direct table access is revoked, and privileged operations are exposed only as narrowly scoped RPCs. The public RPC returns the revision referenced by the published pointer only. Draft snapshots are unavailable through the public RPC. Server-function responses use private, no-store cache headers.

The `portfolio-cms-media` bucket is private and limited to JPEG, PNG, WebP, and AVIF files up to 10 MiB. Storage upload and delete policies require the CMS administrator allowlist. A read policy permits authorized administrators and objects referenced by the current published snapshot; public visitors cannot sign draft-only media. Media is uploaded under immutable generated keys. Failed metadata registration triggers best-effort object cleanup, and deletion is blocked while any retained revision contains the media record. Replaced or historical media is intentionally retained until no saved revision depends on it.

The current dashboard stays explicitly demo-only if server configuration or authorization is unavailable. Permanent save, restore, publish, and unpublish actions become available only after the backend setup succeeds.

## Operational limits

- The migration must be reviewed against the live schema before execution; remote objects and existing policies were not inspected by this implementation.
- No migration, Auth allowlist insert, bucket creation, upload, or deployment has been performed.
- Storage and media policies are defined in the second additive migration; they remain unapplied.
- Public routes read and validate only the published snapshot. If it is unavailable or invalid, they render the existing static portfolio content as a fallback; drafts are not exposed to public visitors.
