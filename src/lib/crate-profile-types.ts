export interface CrateProfileSummary {
  category: string | null;
  is_elite: boolean;
  elite_category: string | null;
  is_shared: boolean;
  energy_sections: { key: string; section: string }[];
  dismissed_keys: string[];
}
