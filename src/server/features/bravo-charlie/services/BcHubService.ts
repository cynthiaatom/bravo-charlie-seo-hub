import { AppError } from "@/server/lib/errors";
import { BcHubRepository } from "@/server/features/bravo-charlie/repositories/BcHubRepository";
import { generateRegistrationCode, hashRegistrationCode } from "@/bcseo/registration-code";
import { encryptSiteSecret, decryptSiteSecret } from "@/bcseo/secret-vault";
import { hmacSha256Hex, signatureBase } from "@/bcseo/hmac";
import type { CreateBravoCharlieClientInput, IssueBravoCharlieRegistrationCodeInput, WpHeartbeatInput, WpRegistrationRequestInput } from "@/types/schemas/bravo-charlie";

function slugify(value: string) {
  const slug = value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return slug || `client-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeHttpsUrl(value: string, label: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError("VALIDATION_ERROR", `${label} is not a valid URL.`); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) throw new AppError("VALIDATION_ERROR", `${label} must use HTTPS.`);
  url.hash = "";
  return url;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function listClients(organizationId: string) { return BcHubRepository.listClientCards(organizationId); }

async function createClient(organizationId: string, input: CreateBravoCharlieClientInput) {
  if (!(await BcHubRepository.projectBelongsToOrganization(input.projectId, organizationId))) throw new AppError("NOT_FOUND", "Project not found.");
  const clientId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  try {
    await BcHubRepository.createClientWithProject({ clientId, organizationId, name: input.name.trim(), slug: `${slugify(input.name)}-${clientId.slice(0, 6)}`, projectId: input.projectId, nowIso });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) throw new AppError("CONFLICT", "That OpenSEO project is already assigned to a Bravo Charlie client.");
    throw error;
  }
  return { id: clientId };
}

async function issueWordPressRegistrationCode(organizationId: string, userId: string, input: IssueBravoCharlieRegistrationCodeInput) {
  if (!(await BcHubRepository.projectIsMappedToClient(input.clientId, input.projectId, organizationId))) throw new AppError("NOT_FOUND", "Client/project mapping was not found for this organization.");
  const code = generateRegistrationCode();
  const codeHash = await hashRegistrationCode(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
  await BcHubRepository.insertRegistrationCode({ id: crypto.randomUUID(), projectId: input.projectId, codeHash, expiresAt, createdByUserId: userId, createdAt: now.toISOString() });
  return { code, expiresAt };
}

async function registerWordPressSite(input: { payload: WpRegistrationRequestInput; siteSecretVaultKey: string; appOrigin: string }) {
  const body = input.payload;
  const siteUrl = normalizeHttpsUrl(body.site_url, "site_url");
  const statusUrl = normalizeHttpsUrl(body.status_endpoint, "status_endpoint");
  const updateUrl = normalizeHttpsUrl(body.update_endpoint, "update_endpoint");
  if (siteUrl.origin !== statusUrl.origin || siteUrl.origin !== updateUrl.origin) throw new AppError("VALIDATION_ERROR", "WordPress callback endpoints must use the registered site origin.");
  const actualFingerprint = await sha256Hex(body.site_secret);
  if (actualFingerprint !== body.site_secret_fingerprint.toLowerCase()) throw new AppError("VALIDATION_ERROR", "Site-secret fingerprint mismatch.");
  const grant = await BcHubRepository.consumeValidRegistrationCode(await hashRegistrationCode(body.registration_code), new Date().toISOString());
  if (!grant) throw new AppError("VALIDATION_ERROR", "Registration code is invalid, expired, or already used.");
  const stored = await BcHubRepository.upsertWpSite({ siteId: body.site_id, projectId: grant.projectId, siteUrl: siteUrl.toString(), siteName: body.site_name.trim(), secretCiphertext: await encryptSiteSecret(body.site_secret, input.siteSecretVaultKey), secretFingerprint: actualFingerprint, statusEndpoint: statusUrl.toString(), updateEndpoint: updateUrl.toString(), pluginVersion: body.plugin_version, wordpressVersion: body.wordpress, capabilitiesJson: JSON.stringify(body.capabilities), nowIso: new Date().toISOString() });
  const origin = input.appOrigin.replace(/\/$/, "");
  return { site_record_id: stored.siteRecordId, dashboard_url: `${origin}/clients`, google_connect_url: `${origin}/p/${grant.projectId}/settings/integrations` };
}

async function acceptWordPressHeartbeat(input: { rawBody: string; payload: WpHeartbeatInput; siteId: string; timestamp: string; signature: string; siteSecretVaultKey: string }) {
  if (!/^\d+$/.test(input.timestamp) || Math.abs(Date.now() - Number(input.timestamp) * 1000) > 5 * 60 * 1000) throw new AppError("UNAUTHENTICATED", "Invalid or expired signature.");
  const site = await BcHubRepository.getWpSiteBySiteId(input.siteId);
  if (!site || site.siteId !== input.payload.site_id) throw new AppError("UNAUTHENTICATED", "Invalid signature.");
  const secret = await decryptSiteSecret(site.secretCiphertext, input.siteSecretVaultKey);
  const expected = await hmacSha256Hex(secret, signatureBase(input.timestamp, "POST", "/api/wp/heartbeat", input.rawBody));
  const supplied = input.signature.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(supplied) || expected.length !== supplied.length) throw new AppError("UNAUTHENTICATED", "Invalid signature.");
  let diff = 0; for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (diff !== 0) throw new AppError("UNAUTHENTICATED", "Invalid signature.");
  await BcHubRepository.saveWpHeartbeat({ siteRecordId: site.id, siteId: site.siteId, heartbeat: input.payload, nowIso: new Date().toISOString() });
  return { ok: true } as const;
}

export const BcHubService = { listClients, createClient, issueWordPressRegistrationCode, registerWordPressSite, acceptWordPressHeartbeat } as const;
