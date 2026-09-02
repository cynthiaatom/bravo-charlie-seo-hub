import { describe, expect, it } from "vitest";
import { hmacSha256Hex, signatureBase, verifyWpSignature } from "./hmac";

const SECRET = "bravo-charlie-test-secret-0123456789";
const TIMESTAMP = "1788326400";
const ROUTE = "/api/wp/heartbeat";
const BODY = JSON.stringify({
  site_id: "8f14e45f-ea4f-4ef9-bc83-0f8b7c7b9e5a",
  health: { score: 91 },
});

describe("Bravo Charlie HMAC protocol", () => {
  it("builds the canonical signature base", () => {
    expect(signatureBase(TIMESTAMP, "post", ROUTE, BODY)).toBe(
      `${TIMESTAMP}\nPOST\n${ROUTE}\n${BODY}`,
    );
  });

  it("accepts a valid fresh signature", async () => {
    const siteId = "8f14e45f-ea4f-4ef9-bc83-0f8b7c7b9e5a";
    const signature = await hmacSha256Hex(
      SECRET,
      signatureBase(TIMESTAMP, "POST", ROUTE, BODY),
    );

    await expect(
      verifyWpSignature({
        secret: SECRET,
        siteId,
        expectedSiteId: siteId,
        timestamp: TIMESTAMP,
        method: "POST",
        route: ROUTE,
        body: BODY,
        signature,
        nowMs: Number(TIMESTAMP) * 1000 + 60_000,
      }),
    ).resolves.toBe(true);
  });

  it("rejects a stale signature", async () => {
    const siteId = "8f14e45f-ea4f-4ef9-bc83-0f8b7c7b9e5a";
    const signature = await hmacSha256Hex(
      SECRET,
      signatureBase(TIMESTAMP, "POST", ROUTE, BODY),
    );

    await expect(
      verifyWpSignature({
        secret: SECRET,
        siteId,
        expectedSiteId: siteId,
        timestamp: TIMESTAMP,
        method: "POST",
        route: ROUTE,
        body: BODY,
        signature,
        nowMs: Number(TIMESTAMP) * 1000 + 301_000,
      }),
    ).resolves.toBe(false);
  });

  it("rejects site-id and body tampering", async () => {
    const siteId = "8f14e45f-ea4f-4ef9-bc83-0f8b7c7b9e5a";
    const signature = await hmacSha256Hex(
      SECRET,
      signatureBase(TIMESTAMP, "POST", ROUTE, BODY),
    );

    await expect(
      verifyWpSignature({
        secret: SECRET,
        siteId: "f2d5d5bb-5946-49ad-bd65-ce3c9117520f",
        expectedSiteId: siteId,
        timestamp: TIMESTAMP,
        method: "POST",
        route: ROUTE,
        body: BODY,
        signature,
        nowMs: Number(TIMESTAMP) * 1000,
      }),
    ).resolves.toBe(false);

    await expect(
      verifyWpSignature({
        secret: SECRET,
        siteId,
        expectedSiteId: siteId,
        timestamp: TIMESTAMP,
        method: "POST",
        route: ROUTE,
        body: `${BODY} `,
        signature,
        nowMs: Number(TIMESTAMP) * 1000,
      }),
    ).resolves.toBe(false);
  });
});
