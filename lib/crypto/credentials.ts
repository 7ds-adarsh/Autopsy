import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length === 64) {
    return Buffer.from(envKey, "hex");
  }

  // Fallback to deterministic key derived from NEXTAUTH_SECRET or development constant
  const secret = process.env.NEXTAUTH_SECRET || "api-autopsy-default-development-encryption-key-salt";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext credential string using AES-256-GCM.
 * Returns colon-separated hex format: "iv:tag:ciphertext"
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext}`;
}

/**
 * Decrypts an encrypted credential string formatted as "iv:tag:ciphertext".
 * Returns original plaintext string.
 */
export function decrypt(stored: string): string {
  if (!stored) return "";

  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted credential format. Expected iv:tag:ciphertext");
  }

  const [ivHex, tagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(ciphertextHex, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}
