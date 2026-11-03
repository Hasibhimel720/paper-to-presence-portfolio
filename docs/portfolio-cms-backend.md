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

Service illustrations use this same bucket and media-reference workflow. Each service stores its own optional image reference, fit, and focal point in the CMS snapshot; removing or replacing an image changes the content reference but does not immediately delete the stored asset. The Services workspace restricts selected files to JPEG, PNG, and WebP while retaining the shared 10 MiB limit. No additional bucket or Storage policy is required.

Categories, services, experience entries, process steps, and FAQs are snapshot data. Collection order and visibility are synchronized with the matching homepage section, so additions and edits remain draft-only until Publish. Experience records may keep their legacy date text or use validated ISO start/end dates and a current-employment flag; current roles publish with a “Present” end label. Software icons for the About Digital Portfolio Pass use built-in icon identifiers or an optional custom media reference. Custom icon media is validated against the snapshot library and retained while a saved revision references it.

Appearance settings are stored in the existing versioned CMS snapshot alongside the public theme tokens. Older snapshots without appearance settings remain valid and use the website defaults. Design Studio changes stay local until Save Draft, and only the separate Publish action changes the public site's active design; no additional table or migration is required.

Project case studies use the same snapshot and media library. Projects can reference separate cover and hero images, an ordered gallery with alt text and captions, and ordered sections with their own visibility, image layout, and media references. The public project detail route resolves these references only from the published snapshot. Older project records remain valid, with the cover used as the hero image when no separate hero is configured. Project edits remain dashboard changes until saved as a draft and published; changing a slug changes its `/work/<slug>` URL.

The current dashboard stays explicitly demo-only if server configuration or authorization is unavailable. Permanent save, restore, publish, and unpublish actions become available only after the backend setup succeeds.

## Operational limits

- The migration must be reviewed against the live schema before execution; remote objects and existing policies were not inspected by this implementation.
- No migration, Auth allowlist insert, bucket creation, upload, or deployment has been performed.
- Storage and media policies are defined in the second additive migration; they remain unapplied.
- Public routes read and validate only the published snapshot. If it is unavailable or invalid, they render the existing static portfolio content as a fallback; drafts are not exposed to public visitors.
