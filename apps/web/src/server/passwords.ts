import 'server-only';
import { hash, verify, Algorithm } from '@node-rs/argon2';
const options = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};
const dummy = hash('inkwell-dummy-password-never-valid', options);
export function hashPassword(password: string) {
  return hash(password, options);
}
export async function verifyPassword(password: string, encoded: string | null) {
  const target = encoded ?? (await dummy);
  try {
    const valid = await verify(target, password);
    return encoded !== null && valid;
  } catch {
    return false;
  }
}
