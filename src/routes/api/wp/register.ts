import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { BcHubService } from "@/server/features/bravo-charlie/services/BcHubService";
import { wpRegistrationRequestSchema } from "@/types/schemas/bravo-charlie";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getEnvString(key: string) {
  const value = Reflect.get(env, key);
  return typeof value === "string" ? value : undefined;
}

function getAppOrigin(request: Request) {
  const configured = getEnvString("BCSEO_PUBLIC_APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

function getRegistrationRateLimiter(): RateLimiter | undefined {
  const value = Reflect.get(env, "BCSEO_REGISTRATION_RATE_LIMIT");
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return undefined;
  }
  const limit = Reflect.get(value, "limit");
  if (typeof limit !== "function") return undefined;
  return value as RateLimiter;
}

export const Route = createFileRoute("/api/wp/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limiter = getRegistrationRateLimiter();
        if (limiter) {
          const result = await limiter.limit({
            key: request.headers.get("cf-connecting-ip") ?? "unknown",
          });
          if (!result.success) {
            return json({ error: "Too many registration attempts." }, 429);
          }
        }

        const parsed = wpRegistrationRequestSchema.safeParse(
          await request.json().catch(() => null),
        );
        if (!parsed.success) {
          return json({ error: "Invalid WordPress registration payload." }, 400);
        }

        const siteSecretVaultKey = getEnvString("BCSEO_SITE_SECRET_KEY");
        if (!siteSecretVaultKey) {
          return json({ error: "Hub registration is not configured." }, 503);
        }

        try {
          const result = await BcHubService.registerWordPressSite({
            payload: parsed.data,
            siteSecretVaultKey,
            appOrigin: getAppOrigin(request),
          });
          return json(result, 201);
        } catch (error) {
          console.error("Bravo Charlie WordPress registration failed:", error);
          return json(
            { error: "Registration code is invalid, expired, or already used." },
            400,
          );
        }
      },
    },
  },
});
