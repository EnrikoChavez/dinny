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
  dietaryRestrictions: string[];
  highProtein: boolean;
  maxCookMinutes: number | null;
  spiceLevel: number | null;
  calorieGoal: number | null;
  favoriteCuisines: string[];
  preferenceNotes: string;
};

export const emptyPreferenceSnapshot: PreferenceSnapshot = {
  dietaryRestrictions: [],
  highProtein: false,
  maxCookMinutes: null,
  spiceLevel: null,
  calorieGoal: null,
  favoriteCuisines: [],
  preferenceNotes: "",
};

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
    .map((value) => value.trim().replace(/\s+/g, " ").slice(0, 40))
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export function normalizePreferenceNotes(value: string) {
  return value.trim().replace(/\n{3,}/g, "\n\n").slice(0, 6000);
}
