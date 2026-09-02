import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  bcClientProjects,
  bcClients,
  bcWpRegistrationCodes,
  bcWpSites,
  bcWpSiteSnapshots,
  projects,
} from "@/db/schema";
import type { WpHeartbeatInput } from "@/types/schemas/bravo-charlie";

export type BravoCharlieClientCard = {
  id: string;
  name: string;
  status: "onboarding" | "active" | "paused" | "archived";
  publicProofEnabled: boolean;
  project: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
  wordpress: {
    siteId: string;
    siteUrl: string;
    siteName: string;
    pluginVersion: string;
    wordpressVersion: string | null;
    lastHeartbeatAt: string | null;
    healthScore: number | null;
    error404Hits: number;
    cwvAssessment: string | null;
  } | null;
};

async function listClientCards(
  organizationId: string,
): Promise<BravoCharlieClientCard[]> {
  const rows = await db
    .select({
      clientId: bcClients.id,
      clientName: bcClients.name,
      clientStatus: bcClients.status,
      publicProofEnabled: bcClients.publicProofEnabled,
      projectId: projects.id,
      projectName: projects.name,
      projectDomain: projects.domain,
      wpSiteId: bcWpSites.siteId,
      wpSiteUrl: bcWpSites.siteUrl,
      wpSiteName: bcWpSites.siteName,
      pluginVersion: bcWpSites.pluginVersion,
      wordpressVersion: bcWpSites.wordpressVersion,
      lastHeartbeatAt: bcWpSites.lastHeartbeatAt,
      healthScore: bcWpSites.lastHealthScore,
      error404Hits: bcWpSites.last404Hits,
      cwvAssessment: bcWpSites.lastCwvAssessment,
    })
    .from(bcClients)
    .leftJoin(bcClientProjects, eq(bcClientProjects.clientId, bcClients.id))
    .leftJoin(projects, eq(projects.id, bcClientProjects.projectId))
    .leftJoin(bcWpSites, eq(bcWpSites.projectId, projects.id))
    .where(eq(bcClients.organizationId, organizationId))
    .orderBy(desc(bcClients.createdAt), desc(bcClients.id));

  return rows.map((row) => ({
    id: row.clientId,
    name: row.clientName,
    status: row.clientStatus,
    publicProofEnabled: row.publicProofEnabled,
    project:
      row.projectId && row.projectName
        ? {
            id: row.projectId,
            name: row.projectName,
            domain: row.projectDomain,
          }
        : null,
    wordpress:
      row.wpSiteId && row.wpSiteUrl && row.wpSiteName && row.pluginVersion
        ? {
            siteId: row.wpSiteId,
            siteUrl: row.wpSiteUrl,
            siteName: row.wpSiteName,
            pluginVersion: row.pluginVersion,
            wordpressVersion: row.wordpressVersion,
            lastHeartbeatAt: row.lastHeartbeatAt,
            healthScore: row.healthScore,
            error404Hits: row.error404Hits ?? 0,
            cwvAssessment: row.cwvAssessment,
          }
        : null,
  }));
}

async function projectBelongsToOrganization(
  projectId: string,
  organizationId: string,
) {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
        isNull(projects.archivedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function projectIsMappedToClient(
  clientId: string,
  projectId: string,
  organizationId: string,
) {
  const [row] = await db
    .select({ clientId: bcClients.id })
    .from(bcClientProjects)
    .innerJoin(bcClients, eq(bcClients.id, bcClientProjects.clientId))
    .where(
      and(
        eq(bcClientProjects.clientId, clientId),
        eq(bcClientProjects.projectId, projectId),
        eq(bcClients.organizationId, organizationId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function createClientWithProject(input: {
  clientId: string;
  organizationId: string;
  name: string;
  slug: string;
  projectId: string;
  nowIso: string;
}) {
  await runBatch((tx) => [
    tx.insert(bcClients).values({
      id: input.clientId,
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      status: "onboarding",
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    }),
    tx.insert(bcClientProjects).values({
      clientId: input.clientId,
      projectId: input.projectId,
      isPrimary: true,
      createdAt: input.nowIso,
    }),
  ]);
}

async function insertRegistrationCode(input: {
  id: string;
  projectId: string;
  codeHash: string;
  expiresAt: string;
  createdByUserId: string;
  createdAt: string;
}) {
  await db.insert(bcWpRegistrationCodes).values(input);
}

async function consumeValidRegistrationCode(codeHash: string, nowIso: string) {
  const [row] = await db
    .update(bcWpRegistrationCodes)
    .set({ consumedAt: nowIso })
    .where(
      and(
        eq(bcWpRegistrationCodes.codeHash, codeHash),
        isNull(bcWpRegistrationCodes.consumedAt),
        gt(bcWpRegistrationCodes.expiresAt, nowIso),
      ),
    )
    .returning({
      id: bcWpRegistrationCodes.id,
      projectId: bcWpRegistrationCodes.projectId,
    });
  return row ?? null;
}

async function upsertWpSite(input: {
  siteId: string;
  projectId: string;
  siteUrl: string;
  siteName: string;
  secretCiphertext: string;
  secretFingerprint: string;
  statusEndpoint: string;
  updateEndpoint: string;
  pluginVersion: string;
  wordpressVersion?: string;
  capabilitiesJson: string;
  nowIso: string;
}) {
  const newRecordId = crypto.randomUUID();
  const [row] = await db
    .insert(bcWpSites)
    .values({
      id: newRecordId,
      siteId: input.siteId,
      projectId: input.projectId,
      siteUrl: input.siteUrl,
      siteName: input.siteName,
      secretCiphertext: input.secretCiphertext,
      secretFingerprint: input.secretFingerprint,
      statusEndpoint: input.statusEndpoint,
      updateEndpoint: input.updateEndpoint,
      pluginVersion: input.pluginVersion,
      wordpressVersion: input.wordpressVersion ?? null,
      capabilitiesJson: input.capabilitiesJson,
      registeredAt: input.nowIso,
      updatedAt: input.nowIso,
    })
    .onConflictDoUpdate({
      target: bcWpSites.projectId,
      set: {
        siteId: input.siteId,
        siteUrl: input.siteUrl,
        siteName: input.siteName,
        secretCiphertext: input.secretCiphertext,
        secretFingerprint: input.secretFingerprint,
        statusEndpoint: input.statusEndpoint,
        updateEndpoint: input.updateEndpoint,
        pluginVersion: input.pluginVersion,
        wordpressVersion: input.wordpressVersion ?? null,
        capabilitiesJson: input.capabilitiesJson,
        updatedAt: input.nowIso,
      },
    })
    .returning({ siteRecordId: bcWpSites.id });

  if (!row) throw new Error("Failed to register WordPress site");
  return row;
}

async function getWpSiteBySiteId(siteId: string) {
  const [row] = await db
    .select({
      id: bcWpSites.id,
      siteId: bcWpSites.siteId,
      projectId: bcWpSites.projectId,
      siteUrl: bcWpSites.siteUrl,
      secretCiphertext: bcWpSites.secretCiphertext,
    })
    .from(bcWpSites)
    .where(eq(bcWpSites.siteId, siteId))
    .limit(1);
  return row ?? null;
}

async function saveWpHeartbeat(input: {
  siteRecordId: string;
  siteId: string;
  heartbeat: WpHeartbeatInput;
  nowIso: string;
}) {
  const health = input.heartbeat.health;
  const cwvAssessment =
    typeof input.heartbeat.cwv?.assessment === "string"
      ? input.heartbeat.cwv.assessment
      : null;
  const error404Hits = input.heartbeat["404_hits"] ?? 0;

  await runBatch((tx) => [
    tx
      .update(bcWpSites)
      .set({
        siteName: input.heartbeat.site_name,
        pluginVersion: input.heartbeat.plugin_version,
        wordpressVersion: input.heartbeat.wordpress ?? null,
        lastHeartbeatAt: input.nowIso,
        lastHealthScore: health?.score ?? null,
        last404Hits: error404Hits,
        lastCwvAssessment: cwvAssessment,
        updatedAt: input.nowIso,
      })
      .where(eq(bcWpSites.id, input.siteRecordId)),
    tx.insert(bcWpSiteSnapshots).values({
      wpSiteId: input.siteRecordId,
      healthScore: health?.score ?? null,
      missingDescriptions: health?.missing_descriptions ?? null,
      missingTitles: health?.missing_titles ?? null,
      noindexCount: health?.noindex_count ?? null,
      error404Hits,
      cwvJson: input.heartbeat.cwv
        ? JSON.stringify(input.heartbeat.cwv)
        : null,
      auditSummaryJson: JSON.stringify({
        generated_at: input.heartbeat.generated_at,
        health: input.heartbeat.health ?? null,
      }),
      capturedAt: input.nowIso,
    }),
  ]);
}

export const BcHubRepository = {
  listClientCards,
  projectBelongsToOrganization,
  projectIsMappedToClient,
  createClientWithProject,
  insertRegistrationCode,
  consumeValidRegistrationCode,
  upsertWpSite,
  getWpSiteBySiteId,
  saveWpHeartbeat,
} as const;
