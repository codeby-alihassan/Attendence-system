/**
 * Cryptographic utility functions for secure QR Token generation and hashing.
 * Tokens are opaque random strings. Database only stores their SHA-256 digests.
 */

/**
 * Generate a cryptographically secure random token string for a student ID card.
 * Format: edupulse_sec_<random-hex-64>
 */
export function generateSecureQRToken(): string {
  const array = new Uint8Array(24);
  window.crypto.getRandomValues(array);
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `edupulse_sec_${hex}`;
}

/**
 * Compute SHA-256 hex digest of a raw token string.
 * Matches PostgreSQL encode(digest(token, 'sha256'), 'hex').
 */
export async function computeSHA256Hash(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token.trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
