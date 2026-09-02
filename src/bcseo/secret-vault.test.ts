import { describe, expect, it } from "vitest";
import { decryptSiteSecret, encryptSiteSecret } from "./secret-vault";

function toBase64Url(bytes: Uint8Array) {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

describe("Bravo Charlie site-secret vault", () => {
  it("round-trips a site secret with AES-GCM", async () => {
    const key = toBase64Url(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
    const secret = "wordpress-site-secret-value";
    const ciphertext = await encryptSiteSecret(secret, key);

    expect(ciphertext).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    await expect(decryptSiteSecret(ciphertext, key)).resolves.toBe(secret);
  });

  it("uses a fresh IV for each encryption", async () => {
    const key = toBase64Url(Uint8Array.from({ length: 32 }, (_, index) => 255 - index));
    const secret = "same-secret";

    const first = await encryptSiteSecret(secret, key);
    const second = await encryptSiteSecret(secret, key);

    expect(first).not.toBe(second);
  });

  it("rejects an invalid vault key length", async () => {
    const shortKey = toBase64Url(new Uint8Array(16));
    await expect(encryptSiteSecret("secret", shortKey)).rejects.toThrow(
      "BCSEO_SITE_SECRET_KEY must decode to exactly 32 bytes",
    );
  });

  it("rejects unsupported ciphertext versions", async () => {
    const key = toBase64Url(new Uint8Array(32));
    await expect(decryptSiteSecret("v2.a.b", key)).rejects.toThrow(
      "Unsupported site-secret ciphertext",
    );
  });
});
