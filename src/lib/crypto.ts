import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetric encryption for the one genuinely sensitive value this app stores:
 * the user's LEETCODE_SESSION cookie.
 *
 * That cookie is a bearer credential — anyone holding it can act as the user on
 * leetcode.com until it expires. It therefore must not sit in the database in
 * plaintext, where a leaked backup, a shared Neon connection string or a stray
 * `SELECT *` in a log would hand it over.
 *
 * AES-256-GCM, with the key derived from AUTH_SECRET (which the app already
 * requires and already treats as secret). GCM is authenticated, so a tampered
 * ciphertext fails to decrypt rather than silently yielding garbage.
 *
 * What this does and does not protect against:
 *
 *   ✓ Database contents leaking without the application's environment.
 *   ✗ An attacker who has both the database and AUTH_SECRET — at that point
 *     they can already mint session tokens for any user anyway.
 *
 * Rotating AUTH_SECRET invalidates every stored cookie. That is the correct
 * behaviour: `decrypt` returns null, the sync reports the cookie as expired,
 * and the user re-pastes it.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for.
const VERSION = "v1";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set — it is required to encrypt stored LeetCode session cookies.",
    );
  }
  // AUTH_SECRET is an arbitrary-length string; SHA-256 gives the 32 bytes AES-256 needs.
  return createHash("sha256").update(secret).digest();
}

/** Encrypts to `v1.<iv>.<authTag>.<ciphertext>`, all base64url. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Reverses `encrypt`. Returns null rather than throwing for any unusable input —
 * wrong format, wrong key, tampered ciphertext — because every caller's correct
 * response is the same: treat the cookie as gone and ask for a new one.
 */
export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  try {
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
