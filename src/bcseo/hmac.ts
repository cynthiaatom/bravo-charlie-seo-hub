const encoder = new TextEncoder();

export function signatureBase(
  timestamp: string,
  method: string,
  route: string,
  body = "",
): string {
  return `${timestamp}\n${method.toUpperCase()}\n${route}\n${body}`;
}

export async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyWpSignature(input: {
  secret: string;
  siteId: string;
  expectedSiteId: string;
  timestamp: string;
  method: string;
  route: string;
  body?: string;
  signature: string;
  nowMs?: number;
}): Promise<boolean> {
  if (input.siteId !== input.expectedSiteId || !/^\d+$/.test(input.timestamp)) {
    return false;
  }
  const now = input.nowMs ?? Date.now();
  const ageMs = Math.abs(now - Number(input.timestamp) * 1000);
  if (ageMs > 5 * 60 * 1000) return false;

  const expected = await hmacSha256Hex(
    input.secret,
    signatureBase(input.timestamp, input.method, input.route, input.body ?? ""),
  );
  if (expected.length !== input.signature.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ input.signature.charCodeAt(i);
  }
  return diff === 0;
}
