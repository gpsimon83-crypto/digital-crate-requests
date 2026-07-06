import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Lazily constructs the Stripe client on first use. Stripe's SDK throws
 * immediately if constructed with an empty key, which crashed Next.js's
 * build-time page-data collection before env vars were configured.
 */
export function getStripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured yet. Add STRIPE_SECRET_KEY to your environment variables.");
  }

  cached = new Stripe(key);
  return cached;
}
