const encoder = new TextEncoder();
const decoder = new TextDecoder();

function fromBase64(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function importVaultKey(base64UrlKey: string): Promise<CryptoKey> {
  const bytes = fromBase64(base64UrlKey);
  if (bytes.length !== 32) {
    throw new Error("BCSEO_SITE_SECRET_KEY must decode to exactly 32 bytes");
  }
  return crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSiteSecret(
  secret: string,
  base64UrlKey: string,
): Promise<string> {
  const key = await importVaultKey(base64UrlKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(secret),
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptSiteSecret(
  ciphertext: string,
  base64UrlKey: string,
): Promise<string> {
  const [version, ivPart, dataPart] = ciphertext.split(".");
  if (version !== "v1" || !ivPart || !dataPart) {
    throw new Error("Unsupported site-secret ciphertext");
  }
  const key = await importVaultKey(base64UrlKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) },
    key,
    fromBase64(dataPart),
  );
  return decoder.decode(decrypted);
}
