import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function secretHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function encryptionKey() {
  const key = process.env.SEPAY_TOKEN_ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('SEPAY_NOT_CONFIGURED');
  return Buffer.from(key, 'hex');
}

export function encryptSepaySecret(value: string, ownerId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(ownerId));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function decryptSepaySecret(value: string, ownerId: string) {
  const data = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(ownerId));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
