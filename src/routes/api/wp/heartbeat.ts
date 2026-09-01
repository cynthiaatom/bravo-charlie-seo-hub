import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { BcHubService } from "@/server/features/bravo-charlie/services/BcHubService";
import { wpHeartbeatSchema } from "@/types/schemas/bravo-charlie";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/wp/heartbeat")({
  server: { handlers: { POST: async ({ request }) => {
    const rawBody = await request.text();
    let raw: unknown;
    try { raw = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON." }, 400); }
    const parsed = wpHeartbeatSchema.safeParse(raw);
    if (!parsed.success) return json({ error: "Invalid heartbeat." }, 400);
    const siteSecretVaultKey = (env as any).BCSEO_SITE_SECRET_KEY as string | undefined;
    if (!siteSecretVaultKey) return json({ error: "Hub heartbeat is not configured." }, 503);
    try {
      await BcHubService.acceptWordPressHeartbeat({
        rawBody,
        payload: parsed.data,
        siteId: request.headers.get("x-bc-site-id") ?? "",
        timestamp: request.headers.get("x-bc-timestamp") ?? "",
        signature: request.headers.get("x-bc-signature") ?? "",
        siteSecretVaultKey,
      });
      return json({ ok: true, received_at: new Date().toISOString() });
    } catch (error) {
      console.error("Bravo Charlie WordPress heartbeat rejected:", error);
      return json({ error: "Unauthorized." }, 401);
    }
  } } },
});
