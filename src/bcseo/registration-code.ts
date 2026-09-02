const encoder = new TextEncoder();

export function generateRegistrationCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const token = [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `BC-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}-${token.slice(12, 16)}`;
}

export async function hashRegistrationCode(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(normalized),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
