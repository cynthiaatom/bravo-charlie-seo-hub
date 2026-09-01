# Bravo Charlie SEO Hub M1

Bravo Charlie SEO Hub extends OpenSEO with an agency client registry and secure WordPress connector while leaving rank tracking, DataForSEO, Search Console, audits, backlinks, and MCP owned by upstream OpenSEO.

## M1 flow

1. Create or select an OpenSEO project for the client site.
2. Open **Bravo Charlie → Clients**.
3. Add a client and map the OpenSEO project.
4. Generate a one-time WordPress registration code. Codes expire after 20 minutes and are stored only as SHA-256 hashes.
5. Install Bravo Charlie SEO on WordPress and enter the Hub URL + registration code.
6. WordPress creates a random site ID and secret, sends the secret once over HTTPS, and the Hub encrypts it at rest with AES-GCM.
7. Ongoing heartbeats are authenticated with HMAC-SHA256 and a five-minute replay window.
8. The Clients page shows connection state, latest SEO health, 404 count, and Core Web Vitals assessment.

## Required deployment secret

Set `BCSEO_SITE_SECRET_KEY` to exactly 32 random bytes encoded as base64url. Do not expose it through a `VITE_` variable or send it to WordPress.

Optional: `BCSEO_PUBLIC_APP_URL` can define the canonical browser-facing Hub origin.

## Security boundary

M1 intentionally has no generic remote WordPress execution endpoint. Future SEO changes should enter an approval queue and be executed only through narrow action-specific endpoints after explicit approval.

## Database support

Bravo Charlie tables are defined for both OpenSEO database backends: D1/SQLite and PostgreSQL. A focused schema-parity test guards table/column drift between the two definitions.

## Follow-up

After this draft PR is green, generate and commit Drizzle migrations for both backends, configure the Hub secret in the deployment environment, and connect the first controlled WordPress test site.
