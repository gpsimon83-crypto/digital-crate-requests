import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM for email account passwords at rest. Output is
 * base64(iv):base64(authTag):base64(ciphertext) so decrypt doesn't need
 * anything beyond the stored string and the server-side key.
 */
function getKey() {
  const key = process.env.EMAIL_CREDENTIALS_KEY;
  if (!key) throw new Error("EMAIL_CREDENTIALS_KEY is not set");
  return Buffer.from(key, "base64");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plain.toString("utf8");
}
