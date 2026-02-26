/**
 * Server-side AES-256-GCM encryption/decryption utilities.
 * Used for encrypted communication between client and server.
 *
 * The client uses Web Crypto API (SubtleCrypto) which appends the
 * 16-byte GCM auth-tag at the end of the ciphertext. This module
 * follows the same convention so both sides are compatible.
 */

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
} from "crypto";

const GCM_TAG_LENGTH = 16; // 128 bits

/** Encrypt arbitrary data as AES-256-GCM. Returns base64-encoded ct+tag and iv. */
export function encryptPayload(
  data: unknown,
  key: Buffer
): { ct: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf-8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // WebCrypto convention: ciphertext‖tag
  const combined = Buffer.concat([encrypted, tag]);

  return {
    ct: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

/** Decrypt AES-256-GCM payload (ct = ciphertext‖tag, base64). */
export function decryptPayload(
  ct: string,
  iv: string,
  key: Buffer
): unknown {
  const combined = Buffer.from(ct, "base64");
  const ivBuf = Buffer.from(iv, "base64");

  if (combined.length < GCM_TAG_LENGTH) {
    throw new Error("Invalid ciphertext — too short");
  }

  const ciphertext = combined.subarray(0, combined.length - GCM_TAG_LENGTH);
  const tag = combined.subarray(combined.length - GCM_TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf-8"));
}

/** Derive a 256-bit key via PBKDF2-SHA256 (matches Web Crypto deriveBits). */
export function deriveKey(
  password: string,
  salt: string,
  iterations = 50_000
): Buffer {
  return pbkdf2Sync(password, salt, iterations, 32, "sha256");
}
