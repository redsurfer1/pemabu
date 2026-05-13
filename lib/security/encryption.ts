import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm" as const;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function requireMasterKey(): string {
  const k = process.env.MASTER_VAULT_KEY;
  if (!k || k.length < 16) {
    throw new Error(
      "MASTER_VAULT_KEY must be set (min 16 chars) in the operator environment — never commit it.",
    );
  }
  return k;
}

function kdfSalt(): string {
  return process.env.MASTER_VAULT_KDF_SALT ?? "pemabu.vault.kdf.v1";
}

/** Derive a 32-byte AES key from MASTER_VAULT_KEY (scrypt). */
export function deriveAes256Key(masterKey?: string): Buffer {
  const mk = masterKey ?? requireMasterKey();
  return scryptSync(mk, kdfSalt(), KEY_LENGTH);
}

export interface EncryptedPayload {
  ciphertextB64: string;
  ivB64: string;
  authTagB64: string;
}

export function encryptUtf8(plainText: string, key?: Buffer): EncryptedPayload {
  const k = key ?? deriveAes256Key();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, k, iv, { authTagLength: 16 });
  const enc = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertextB64: enc.toString("base64"),
    ivB64: iv.toString("base64"),
    authTagB64: authTag.toString("base64"),
  };
}

export function decryptUtf8(payload: EncryptedPayload, key?: Buffer): string {
  const k = key ?? deriveAes256Key();
  const iv = Buffer.from(payload.ivB64, "base64");
  const authTag = Buffer.from(payload.authTagB64, "base64");
  const decipher = createDecipheriv(ALGO, k, iv, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  const dec = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
