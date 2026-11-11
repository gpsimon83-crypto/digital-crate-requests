import { safeEqual } from "@/lib/security/crypto";

/**
 * Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". If CRON_SECRET
 * isn't set, every request is refused — previously an unset secret made
 * the expected header "Bearer undefined", which anyone could send.
 */
export function cronAuthorized(authorization: string | null, secret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < 16 || !authorization) return false;
  return safeEqual(authorization, `Bearer ${secret}`);
}
