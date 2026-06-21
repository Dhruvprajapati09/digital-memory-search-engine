import bcrypt from "bcryptjs";
import { env } from "../config/env";

export const SALT_ROUNDS = env.BCRYPT_SALT_ROUNDS;

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
