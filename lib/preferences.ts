export const dietaryRestrictionOptions = [
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Dairy-free",
  "Nut-free",
  "Halal",
  "Kosher",
] as const;

export type DietaryRestriction = (typeof dietaryRestrictionOptions)[number];

export type PreferenceSnapshot = {
  foodsToAvoid: string;
  foodsToPrefer: string;
  cookingLevel: string;
  effortWillingToSpend: string;
  flavorPreference: string;
  topCuisines: string[];
  otherPreferences: string;
};

export const emptyPreferenceSnapshot: PreferenceSnapshot = {
  foodsToAvoid: "",
  foodsToPrefer: "",
  cookingLevel: "",
  effortWillingToSpend: "",
  flavorPreference: "",
  topCuisines: [],
  otherPreferences: "",
};

export function normalizePreferenceText(value: string, maximum = 600) {
  return value.trim().replace(/\s+/g, " ").slice(0, maximum);
}

export function normalizeDietaryRestrictions(values: string[]) {
  const allowed = new Map(
    dietaryRestrictionOptions.map((item) => [item.toLowerCase(), item]),
  );

  return [
    ...new Set(
      values
        .map((value) => allowed.get(value.trim().toLowerCase()))
        .filter((value): value is DietaryRestriction => Boolean(value)),
    ),
  ];
}

export function normalizeCuisines(values: string[]) {
  const seen = new Set<string>();

  return values
    .map((value) => normalizePreferenceText(value, 40))
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
