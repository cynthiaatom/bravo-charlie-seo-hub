import { describe, expect, it } from "vitest";
import { generateRegistrationCode, hashRegistrationCode } from "./registration-code";

describe("Bravo Charlie registration codes", () => {
  it("generates the expected one-time-code format", () => {
    for (let index = 0; index < 20; index += 1) {
      expect(generateRegistrationCode()).toMatch(
        /^BC-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/,
      );
    }
  });

  it("normalizes case and surrounding whitespace before hashing", async () => {
    const canonical = "BC-A1B2-C3D4-E5F6-0123";
    await expect(hashRegistrationCode(`  ${canonical.toLowerCase()}  `)).resolves.toBe(
      await hashRegistrationCode(canonical),
    );
  });

  it("produces a lowercase SHA-256 hex digest", async () => {
    await expect(hashRegistrationCode("BC-A1B2-C3D4-E5F6-0123")).resolves.toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});
