import { z } from "zod";

export const createBravoCharlieClientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  projectId: z.string().min(1).max(128),
});

export const issueBravoCharlieRegistrationCodeSchema = z.object({
  clientId: z.string().min(1).max(128),
  projectId: z.string().min(1).max(128),
});

export const wpRegistrationRequestSchema = z.object({
  protocol_version: z.literal("bcseo-hub-v1"),
  registration_code: z.string().regex(/^BC-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/i),
  site_id: z.string().uuid(),
  site_secret: z.string().min(32).max(512),
  site_secret_fingerprint: z.string().regex(/^[0-9a-f]{64}$/i),
  site_url: z.string().url().max(2048),
  site_name: z.string().trim().min(1).max(255),
  wordpress: z.string().max(64).optional(),
  plugin_version: z.string().min(1).max(64),
  status_endpoint: z.string().url().max(2048),
  update_endpoint: z.string().url().max(2048),
  capabilities: z.array(z.string().min(1).max(128)).max(100).default([]),
});

export const wpHeartbeatSchema = z.object({
  site_id: z.string().uuid(),
  site_url: z.string().url().max(2048),
  site_name: z.string().trim().min(1).max(255),
  plugin_version: z.string().min(1).max(64),
  wordpress: z.string().max(64).optional(),
  health: z.object({
    score: z.number().int().min(0).max(100).optional(),
    missing_descriptions: z.number().int().min(0).optional(),
    missing_titles: z.number().int().min(0).optional(),
    noindex_count: z.number().int().min(0).optional(),
  }).passthrough().optional(),
  cwv: z.record(z.string(), z.unknown()).optional(),
  "404_hits": z.number().int().min(0).optional(),
  generated_at: z.string().min(1).max(64),
});

export type CreateBravoCharlieClientInput = z.infer<typeof createBravoCharlieClientSchema>;
export type IssueBravoCharlieRegistrationCodeInput = z.infer<typeof issueBravoCharlieRegistrationCodeSchema>;
export type WpRegistrationRequestInput = z.infer<typeof wpRegistrationRequestSchema>;
export type WpHeartbeatInput = z.infer<typeof wpHeartbeatSchema>;
