export type PaymentMode =
  | "free"
  | "tips_only"
  | "paid_requests"
  | "priority_requests"
  | "jukebox_credits"
  | "vip_access"
  | "custom";

export interface PricingConfig {
  paymentMode: PaymentMode;
  requestPricing: {
    basePriceCents: number;
    priorityPriceCents: number;
    rushPriceCents: number;
    topOfQueuePriceCents: number;
    dedicationPriceCents: number;
    customMessagePriceCents: number;
    presetCents: number[]; // e.g. [0, 100, 200, 300, 500, 1000] for Free/$1/$2/$3/$5/$10
  };
  tipSettings: {
    presetCents: number[]; // e.g. [200, 500, 1000, 2000, 5000]
    allowCustomAmount: boolean;
    suggestedMessages: string[];
  };
  jukebox: {
    enabled: boolean;
    songCredits: number;
    priorityCredits: number;
    dedicationCredits: number;
    voteCredits: number;
    creditPacks: { credits: number; priceCents: number }[];
  };
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  paymentMode: "paid_requests",
  requestPricing: {
    basePriceCents: 500,
    priorityPriceCents: 1000,
    rushPriceCents: 1500,
    topOfQueuePriceCents: 2000,
    dedicationPriceCents: 300,
    customMessagePriceCents: 200,
    presetCents: [0, 100, 200, 300, 500, 1000],
  },
  tipSettings: {
    presetCents: [200, 500, 1000, 2000, 5000],
    allowCustomAmount: true,
    suggestedMessages: ["Great set!", "Love this song!", "Keep it going!"],
  },
  jukebox: {
    enabled: false,
    songCredits: 5,
    priorityCredits: 10,
    dedicationCredits: 3,
    voteCredits: 1,
    creditPacks: [
      { credits: 10, priceCents: 500 },
      { credits: 25, priceCents: 1000 },
      { credits: 50, priceCents: 1800 },
      { credits: 100, priceCents: 3000 },
    ],
  },
};

export function mergePricingConfig(partial: Partial<PricingConfig> | null | undefined): PricingConfig {
  if (!partial) return DEFAULT_PRICING_CONFIG;
  return {
    paymentMode: partial.paymentMode ?? DEFAULT_PRICING_CONFIG.paymentMode,
    requestPricing: { ...DEFAULT_PRICING_CONFIG.requestPricing, ...partial.requestPricing },
    tipSettings: { ...DEFAULT_PRICING_CONFIG.tipSettings, ...partial.tipSettings },
    jukebox: { ...DEFAULT_PRICING_CONFIG.jukebox, ...partial.jukebox },
  };
}
