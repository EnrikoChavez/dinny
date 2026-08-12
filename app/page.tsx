"use client";

import type { User } from "@supabase/supabase-js";
import {
  ArrowUp,
  Ban,
  Check,
  ChefHat,
  ChevronRight,
  Clock3,
  Heart,
  History,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Sparkles,
  Timer,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  dietaryRestrictionOptions,
  emptyPreferenceSnapshot,
  normalizeCuisines,
  normalizeDietaryRestrictions,
  normalizePreferenceText,
  type PreferenceSnapshot,
} from "@/lib/preferences";
import { recipes as initialRecipes, type Recipe } from "@/lib/recipes";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase-browser";

type View = "home" | "cook-again" | "preferences";
type HistoryItem = {
  recipe: Recipe;
  usedAt: string;
  rating: number | null;
};
type StoredPreferenceRow = {
  foods_to_avoid?: string;
  foods_to_prefer?: string;
  cooking_level?: string;
  effort_willing_to_spend?: string;
  flavor_preference?: string;
  top_cuisines?: string[];
  other_preferences?: string;
};
type Profile = {
  displayName: string;
  age: string;
  gender: string;
  location: string;
  restrictions: string[];
  complete: boolean;
};

const emptyProfile: Profile = {
  displayName: "",
  age: "",
  gender: "",
  location: "",
  restrictions: [],
  complete: false,
};

const genderOptions = [
  "Woman",
  "Man",
  "Non-binary",
  "Prefer not to say",
];

function rankRecipes(
  preferences: PreferenceSnapshot,
  restrictions: string[],
  history: HistoryItem[] = [],
) {
  const recentIds = new Set(history.slice(0, 10).map((item) => item.recipe.id));
  const compatible = initialRecipes.filter((recipe) =>
    restrictions.every((restriction) =>
      recipe.dietary?.some(
        (item) => item.toLowerCase() === restriction.toLowerCase(),
      ),
    ),
  );

  return compatible
    .map((recipe, index) => ({
      recipe,
      score:
        (preferences.topCuisines.some((cuisine) =>
          recipe.cuisine.toLowerCase().includes(cuisine.toLowerCase()),
        )
          ? 20
          : 0) -
        restrictions.length * 10 -
        (recentIds.has(recipe.id) ? 100 : 0) -
        index / 100,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ recipe }) => recipe);
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export default function Home() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [view, setView] = useState<View>("home");
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [profileDraft, setProfileDraft] = useState<Profile>(emptyProfile);
  const [preferences, setPreferences] = useState<PreferenceSnapshot>(
    emptyPreferenceSnapshot,
  );
  const [preferenceDraft, setPreferenceDraft] = useState<PreferenceSnapshot>(
    emptyPreferenceSnapshot,
  );
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [recommendations, setRecommendations] = useState<Recipe[]>(
    initialRecipes.slice(0, 3),
  );
  const [assistantMessage, setAssistantMessage] = useState("");
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [cookedRecipes, setCookedRecipes] = useState<HistoryItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => {
        setAuthReady(true);
        setProfileReady(true);
      });
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setProfileReady(!data.user);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setProfileReady(!session?.user);
      setAuthReady(true);
      if (session?.user) setAuthOpen(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!authReady) return;

    if (!user || !supabase) {
      queueMicrotask(() => {
        setProfile(emptyProfile);
        setProfileDraft(emptyProfile);
        setPreferences(emptyPreferenceSnapshot);
        setPreferenceDraft(emptyPreferenceSnapshot);
        setPreferencesMessage("");
        setProfileReady(true);
        setRecommendations(initialRecipes.slice(0, 3));
        setCookedRecipes([]);
      });
      return;
    }

    let cancelled = false;
    const accountSupabase = supabase;
    const accountUser = user;

    async function loadAccount() {
      const [
        { data: profileData },
        { data: preferenceData },
        { data: historyData },
      ] = await Promise.all([
        accountSupabase
          .from("profiles")
          .select(
            "display_name, age, gender, location, dietary_restrictions, onboarding_complete",
          )
          .eq("id", accountUser.id)
          .maybeSingle(),
        accountSupabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", accountUser.id)
          .maybeSingle<StoredPreferenceRow>(),
        accountSupabase
          .from("recipe_history")
          .select("recipe, used_at, rating")
          .eq("user_id", accountUser.id)
          .order("used_at", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      const localComplete =
        window.localStorage.getItem(`dinny-onboarding-${accountUser.id}`) ===
        "done";
      const nextPreferences: PreferenceSnapshot = {
        foodsToAvoid: preferenceData?.foods_to_avoid ?? "",
        foodsToPrefer: preferenceData?.foods_to_prefer ?? "",
        cookingLevel: preferenceData?.cooking_level ?? "",
        effortWillingToSpend:
          preferenceData?.effort_willing_to_spend ?? "",
        flavorPreference: preferenceData?.flavor_preference ?? "",
        topCuisines: preferenceData?.top_cuisines ?? [],
        otherPreferences: preferenceData?.other_preferences ?? "",
      };
      const nextProfile: Profile = {
        displayName:
          profileData?.display_name ||
          accountUser.user_metadata.full_name ||
          accountUser.user_metadata.name ||
          "",
        age: profileData?.age ? String(profileData.age) : "",
        gender: profileData?.gender || "",
        location: profileData?.location || "",
        restrictions: normalizeDietaryRestrictions(
          Array.isArray(profileData?.dietary_restrictions)
            ? profileData.dietary_restrictions
            : [],
        ),
        complete: Boolean(profileData?.onboarding_complete || localComplete),
      };

      const cloudHistory = (historyData ?? []).map((item) => ({
        recipe: item.recipe as Recipe,
        usedAt: item.used_at as string,
        rating: typeof item.rating === "number" ? item.rating : null,
      }));

      setProfile(nextProfile);
      setProfileDraft(nextProfile);
      setPreferences(nextPreferences);
      setPreferenceDraft(nextPreferences);
      setRecommendations(
        rankRecipes(nextPreferences, nextProfile.restrictions, cloudHistory),
      );
      setCookedRecipes(cloudHistory);
      setProfileReady(true);
    }

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [authReady, supabase, user]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!user || !supabase || profileBusy) return;

    const age = Number(profileDraft.age);
    if (!profileDraft.displayName.trim() || !age || !profileDraft.location.trim()) {
      setProfileMessage("Complete the required fields.");
      return;
    }

    setProfileBusy(true);
    setProfileMessage("");
    const nextProfile: Profile = {
      ...profileDraft,
      displayName: profileDraft.displayName.trim(),
      location: profileDraft.location.trim(),
      complete: true,
    };

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        display_name: nextProfile.displayName,
        age,
        gender: nextProfile.gender || null,
        location: nextProfile.location,
        dietary_restrictions: nextProfile.restrictions,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    setProfileBusy(false);
    if (error) {
      setProfileMessage("Couldn’t save yet. Try again.");
      return;
    }

    window.localStorage.setItem(`dinny-onboarding-${user.id}`, "done");
    setProfile(nextProfile);
    setProfileDraft(nextProfile);
    setRecommendations(rankRecipes(preferences, nextProfile.restrictions, cookedRecipes));
    setProfileOpen(false);
  }

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    if (!user || !supabase || preferencesBusy) return false;

    const nextPreferences: PreferenceSnapshot = {
      foodsToAvoid: normalizePreferenceText(preferenceDraft.foodsToAvoid),
      foodsToPrefer: normalizePreferenceText(preferenceDraft.foodsToPrefer),
      cookingLevel: normalizePreferenceText(preferenceDraft.cookingLevel),
      effortWillingToSpend: normalizePreferenceText(
        preferenceDraft.effortWillingToSpend,
      ),
      flavorPreference: normalizePreferenceText(
        preferenceDraft.flavorPreference,
      ),
      topCuisines: normalizeCuisines(preferenceDraft.topCuisines),
      otherPreferences: normalizePreferenceText(
        preferenceDraft.otherPreferences,
        6000,
      ),
    };

    setPreferencesBusy(true);
    setPreferencesMessage("");
    const { error } = await supabase.from("user_preferences").upsert(
      {
        user_id: user.id,
        foods_to_avoid: nextPreferences.foodsToAvoid,
        foods_to_prefer: nextPreferences.foodsToPrefer,
        cooking_level: nextPreferences.cookingLevel,
        effort_willing_to_spend: nextPreferences.effortWillingToSpend,
        flavor_preference: nextPreferences.flavorPreference,
        top_cuisines: nextPreferences.topCuisines,
        other_preferences: nextPreferences.otherPreferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    setPreferencesBusy(false);

    if (error) {
      setPreferencesMessage("Couldn’t save yet. Try again.");
      return false;
    }

    setPreferences(nextPreferences);
    setPreferenceDraft(nextPreferences);
    setRecommendations(rankRecipes(nextPreferences, profile.restrictions, cookedRecipes));
    setPreferencesMessage("Preferences saved.");
    return true;
  }

  function toggleRestriction(restriction: string) {
    setProfileDraft((current) => ({
      ...current,
      restrictions: current.restrictions.includes(restriction)
        ? current.restrictions.filter((item) => item !== restriction)
        : [...current.restrictions, restriction],
    }));
  }

  async function rememberRecipe(recipe: Recipe) {
    const existing = cookedRecipes.find((item) => item.recipe.id === recipe.id);
    const entry: HistoryItem = {
      recipe,
      usedAt: new Date().toISOString(),
      rating: existing?.rating ?? null,
    };
    setCookedRecipes((current) => [
      entry,
      ...current.filter((item) => item.recipe.id !== recipe.id),
    ].slice(0, 20));

    if (user && supabase) {
      await supabase.from("recipe_history").upsert(
        {
          user_id: user.id,
          recipe_id: recipe.id,
          recipe,
          used_at: entry.usedAt,
          rating: entry.rating,
        },
        { onConflict: "user_id,recipe_id" },
      );
    }
  }

  async function updateRecipeReflection(
    recipeId: string,
    rating: number,
  ) {
    const previous = cookedRecipes;
    setCookedRecipes((current) =>
      current.map((item) =>
        item.recipe.id === recipeId ? { ...item, rating } : item,
      ),
    );

    if (!user || !supabase) return;

    const { error } = await supabase
      .from("recipe_history")
      .update({ rating })
      .eq("user_id", user.id)
      .eq("recipe_id", recipeId);

    if (error) setCookedRecipes(previous);
  }

  function openRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);
  }

  async function runRecommendation(
    requestPrompt: string,
    refresh = false,
  ) {
    if (!user) {
      setAuthMessage("Sign in to ask Dinny.");
      setAuthOpen(true);
      return;
    }

    if (!requestPrompt || recommendationLoading) return;

    setRecommendationLoading(true);
    setAssistantMessage("");

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: requestPrompt,
          refresh,
          excludeRecipes: refresh
            ? recommendations.map((recipe) => recipe.title)
            : [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Try again.");

      setRecommendations(data.recipes);
      setAssistantMessage(data.message);
      if (data.preferences) {
        const nextPreferences = data.preferences as PreferenceSnapshot;
        setPreferences(nextPreferences);
        setPreferenceDraft(nextPreferences);
      }
      if (!data.preferencesUpdated || view !== "preferences") {
        setView("home");
      }
    } catch {
      setAssistantMessage("Try again in a moment.");
    } finally {
      setRecommendationLoading(false);
    }
  }

  async function requestRecommendations(event: FormEvent) {
    event.preventDefault();
    const requestPrompt = prompt.trim();
    if (!requestPrompt) return;

    await runRecommendation(requestPrompt);
    setPrompt("");
  }

  async function refreshRecommendations() {
    await runRecommendation("Show me three more options.", true);
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setAuthMessage("Sign-in is not configured.");
      return;
    }

    setAuthBusy(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setAuthMessage(error.message);
      setAuthBusy(false);
    }
  }

  async function signInWithEmail(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !supabase) return;

    setAuthBusy(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setAuthBusy(false);
    setAuthMessage(
      error ? error.message : "Check your email for the sign-in link.",
    );
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null);
    setView("home");
    setProfileOpen(false);
  }

  const needsOnboarding =
    authReady && Boolean(user) && profileReady && !profile.complete;
  const visibleName = profile.displayName.split(" ")[0];

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="wordmark" onClick={() => setView("home")}>
          Dinny
        </button>

        <nav aria-label="Primary navigation">
          <button
            className={view === "home" ? "nav-link active" : "nav-link"}
            onClick={() => setView("home")}
          >
            Home
          </button>
          <button
            className={view === "cook-again" ? "nav-link active" : "nav-link"}
            onClick={() => setView("cook-again")}
          >
            Cook again
          </button>
          {user && (
            <button
              className={
                view === "preferences" ? "nav-link active" : "nav-link"
              }
              onClick={() => setView("preferences")}
            >
              Preferences
            </button>
          )}
        </nav>

        <div className="account">
          {user ? (
            <>
              <button
                className="avatar-button"
                onClick={() => {
                  setProfileDraft(profile);
                  setProfileMessage("");
                  setProfileOpen(true);
                }}
                aria-label="Edit profile"
              >
                {(profile.displayName || user.email || "D").slice(0, 1).toUpperCase()}
              </button>
              <button className="bare-icon" onClick={signOut} aria-label="Sign out">
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <button className="sign-in" onClick={() => setAuthOpen(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className={view === "home" ? "home-main" : "history-main"}>
        {view === "home" ? (
          <section className="home-stage">
            <div className="home-heading">
              {visibleName && <p>For {visibleName}</p>}
              <div className="home-heading-line">
                <h1>Explore a recipe?</h1>
                <button
                  className={
                    recommendationLoading
                      ? "refresh-recipes loading"
                      : "refresh-recipes"
                  }
                  onClick={() => void refreshRecommendations()}
                  disabled={recommendationLoading}
                  aria-label="Refresh recipe options"
                  title="More recipes"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            <div className="recipe-options" aria-label="Recipe ideas">
              {recommendations.map((recipe) => (
                <RecipeOption
                  key={recipe.id}
                  recipe={recipe}
                  onOpen={openRecipe}
                />
              ))}
            </div>

            {assistantMessage && (
              <p className="assistant-message">{assistantMessage}</p>
            )}
          </section>
        ) : view === "cook-again" ? (
          <section className="history-view">
            <div className="view-heading">
              <History size={18} />
              <div>
                <h1>Cook again</h1>
                <p>Your made recipes, with the notes that make the next time better.</p>
              </div>
            </div>

            {cookedRecipes.length ? (
              <div className="history-list">
                {cookedRecipes.map((item) => (
                  <article
                    key={`${item.recipe.id}-${item.usedAt}`}
                    className="cook-again-card"
                  >
                    <div className="cook-again-card-top">
                      <span>
                        <strong>{item.recipe.title}</strong>
                        <small>
                        {item.recipe.time} min · {item.recipe.cuisine}
                        </small>
                      </span>
                      <div className="cooked-date">
                        <time>Made {formatHistoryDate(item.usedAt)}</time>
                        <button onClick={() => openRecipe(item.recipe)}>Cook again</button>
                      </div>
                    </div>
                    <div className="reflection-row">
                      <span>Rating</span>
                      <div className="rating-buttons" aria-label={`Rate ${item.recipe.title}`}>
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            className={item.rating && rating <= item.rating ? "rated" : ""}
                            onClick={() => void updateRecipeReflection(item.recipe.id, rating)}
                            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                          >
                            <Star size={16} fill="currentColor" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-copy">Recipes you make will live here—ready for an easy repeat.</p>
            )}
          </section>
        ) : (
          <PreferencesView
            preferences={preferences}
            draft={preferenceDraft}
            busy={preferencesBusy}
            message={preferencesMessage || assistantMessage}
            onChange={setPreferenceDraft}
            onSave={savePreferences}
          />
        )}
      </main>

      {view !== "cook-again" && (
        <div className="chat-dock">
          {recommendationLoading && (
            <p className="finding-recipes">finding recipes</p>
          )}
          <form className="chat-form" onSubmit={requestRecommendations}>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onFocus={() => {
                if (!user) setAuthOpen(true);
              }}
              placeholder={
                user
                  ? view === "preferences"
                    ? "Update a preference"
                    : "Ask Dinny or update preferences"
                  : "Sign in to ask Dinny"
              }
              aria-label="Ask Dinny or update preferences"
              readOnly={!user}
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!user || !prompt.trim() || recommendationLoading}
            >
              {recommendationLoading ? <span className="spinner" /> : <ArrowUp size={18} />}
            </button>
          </form>
        </div>
      )}

      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onCooked={
            user
              ? () => {
                  void rememberRecipe(selectedRecipe);
                }
              : undefined
          }
          cooked={cookedRecipes.some(
            (item) => item.recipe.id === selectedRecipe.id,
          )}
        />
      )}

      {authOpen && !user && (
        <AuthModal
          email={email}
          setEmail={setEmail}
          message={authMessage}
          busy={authBusy}
          configured={hasSupabaseConfig}
          onGoogle={signInWithGoogle}
          onEmail={signInWithEmail}
          onClose={() => {
            setAuthOpen(false);
            setAuthMessage("");
          }}
        />
      )}

      {(needsOnboarding || profileOpen) && user && (
        <ProfileForm
          profile={profileDraft}
          onboarding={needsOnboarding}
          busy={profileBusy}
          message={profileMessage}
          onChange={setProfileDraft}
          onToggleRestriction={toggleRestriction}
          onSubmit={saveProfile}
          onClose={
            needsOnboarding
              ? undefined
              : () => {
                  setProfileOpen(false);
                  setProfileDraft(profile);
                }
          }
        />
      )}
    </div>
  );
}

function PreferencesView({
  preferences,
  draft,
  busy,
  message,
  onChange,
  onSave,
}: {
  preferences: PreferenceSnapshot;
  draft: PreferenceSnapshot;
  busy: boolean;
  message: string;
  onChange: (preferences: PreferenceSnapshot) => void;
  onSave: (event: FormEvent) => Promise<boolean>;
}) {
  const [editingField, setEditingField] = useState<keyof PreferenceSnapshot | null>(
    null,
  );
  const groups: Array<{
    title: string;
    description: string;
    fields: Array<{
      key: keyof PreferenceSnapshot;
      label: string;
      placeholder: string;
      icon: ReactNode;
    }>;
  }> = [
    {
      title: "Taste profile",
      description: "The ingredients and flavors you reach for.",
      fields: [
        {
          key: "foodsToAvoid",
          label: "Food I avoid",
          placeholder: "e.g. mushrooms, shellfish",
          icon: <Ban size={17} />,
        },
        {
          key: "foodsToPrefer",
          label: "Food I prefer",
          placeholder: "e.g. salmon, leafy greens",
          icon: <Heart size={17} />,
        },
        {
          key: "flavorPreference",
          label: "Flavor preference",
          placeholder: "e.g. spicy, bright, savory",
          icon: <Sparkles size={17} />,
        },
      ],
    },
    {
      title: "In the kitchen",
      description: "How you like to cook on a typical day.",
      fields: [
        {
          key: "cookingLevel",
          label: "Cooking level",
          placeholder: "e.g. beginner, confident home cook",
          icon: <ChefHat size={17} />,
        },
        {
          key: "effortWillingToSpend",
          label: "Effort willing to spend",
          placeholder: "e.g. quick weeknight meals",
          icon: <Timer size={17} />,
        },
      ],
    },
    {
      title: "Cuisine & extras",
      description: "The cuisines and details that make a recipe feel right.",
      fields: [
        {
          key: "topCuisines",
          label: "Top cuisines",
          placeholder: "e.g. Italian, Thai, Mexican",
          icon: <SlidersHorizontal size={17} />,
        },
        {
          key: "otherPreferences",
          label: "Others",
          placeholder: "Anything else Dinny should know",
          icon: <MessageCircle size={17} />,
        },
      ],
    },
  ];

  type PreferenceField = {
    key: keyof PreferenceSnapshot;
    label: string;
    placeholder: string;
    icon: ReactNode;
  };

  const savedValue = (key: keyof PreferenceSnapshot) => {
    const value = preferences[key];
    return Array.isArray(value) ? value.join(", ") : value;
  };

  async function submit(event: FormEvent) {
    const saved = await onSave(event);
    if (saved) setEditingField(null);
  }

  function updateField(key: keyof PreferenceSnapshot, value: string) {
    if (key === "topCuisines") {
      onChange({ ...draft, topCuisines: value.split(",") });
      return;
    }

    onChange({ ...draft, [key]: value });
  }

  function renderField(field: PreferenceField) {
    const value = savedValue(field.key);
    const editing = editingField === field.key;

    if (value && !editing) {
      return (
        <button
          className="preference-card saved"
          type="button"
          key={field.key}
          onClick={() => setEditingField(field.key)}
        >
          <span className="preference-card-icon">{field.icon}</span>
          <span className="preference-card-copy">
            <small>{field.label}</small>
            <strong>{value}</strong>
          </span>
          <Pencil className="preference-card-edit" size={15} />
        </button>
      );
    }

    return (
      <label className="preference-card" key={field.key}>
        <span className="preference-card-icon">{field.icon}</span>
        <span className="preference-card-copy">
          <small>{field.label}</small>
          <input
            value={
              field.key === "topCuisines"
                ? draft.topCuisines.join(", ")
                : (draft[field.key] as string)
            }
            onChange={(event) => updateField(field.key, event.target.value)}
            placeholder={field.placeholder}
          />
        </span>
      </label>
    );
  }

  return (
    <section className="preferences-view">
      <div className="view-heading">
        <SlidersHorizontal size={18} />
        <h1>Preferences</h1>
      </div>

      <form className="preference-form" onSubmit={submit}>
        {groups.map((group) => (
          <section className="preference-group" key={group.title}>
            <div className="preference-group-heading">
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            <div className="preference-card-grid">
              {group.fields.map(renderField)}
            </div>
          </section>
        ))}
        <button type="submit" className="save-preferences" disabled={busy}>
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </form>

      {message && <p className="assistant-message">{message}</p>}
    </section>
  );
}

function RecipeOption({
  recipe,
  onOpen,
}: {
  recipe: Recipe;
  onOpen: (recipe: Recipe) => void;
}) {
  return (
    <button className="recipe-option" onClick={() => onOpen(recipe)}>
      <span>
        <strong>{recipe.title}</strong>
        <small>
          <Clock3 size={13} /> {recipe.time} min · {recipe.cuisine}
        </small>
      </span>
      <ChevronRight size={17} />
    </button>
  );
}

function RecipeDetail({
  recipe,
  onClose,
  onCooked,
  cooked,
}: {
  recipe: Recipe;
  onClose: () => void;
  onCooked?: () => void;
  cooked: boolean;
}) {
  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <article
        className="recipe-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close-button" onClick={onClose} aria-label="Close">
          <X size={19} />
        </button>
        <p className="detail-meta">
          {recipe.time} min · {recipe.cuisine} · {recipe.calories} cal
        </p>
        <h2 id="recipe-title">{recipe.title}</h2>
        <p className="detail-summary">{recipe.summary}</p>

        <div className="recipe-columns">
          <section>
            <h3>Ingredients</h3>
            <ul>
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Method</h3>
            <ol>
              {recipe.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </div>
        {onCooked && (
          <button
            className={cooked ? "cooked-button complete" : "cooked-button"}
            onClick={onCooked}
            disabled={cooked}
          >
            {cooked && <Check size={15} />}
            {cooked ? "Made" : "Made this"}
          </button>
        )}
      </article>
    </div>
  );
}

function AuthModal({
  email,
  setEmail,
  message,
  busy,
  configured,
  onGoogle,
  onEmail,
  onClose,
}: {
  email: string;
  setEmail: (value: string) => void;
  message: string;
  busy: boolean;
  configured: boolean;
  onGoogle: () => void;
  onEmail: (event: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close-button" onClick={onClose} aria-label="Close">
          <X size={19} />
        </button>
        <h2 id="auth-title">Sign in</h2>
        <button className="google-button" onClick={onGoogle} disabled={busy}>
          <span>G</span>
          Continue with Google
        </button>
        <div className="or-divider">or</div>
        <form onSubmit={onEmail}>
          <label htmlFor="email">Email</label>
          <div className="email-input">
            <Mail size={16} />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <button className="primary-action" disabled={busy || !configured}>
            Email sign-in link
          </button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </section>
    </div>
  );
}

function ProfileForm({
  profile,
  onboarding,
  busy,
  message,
  onChange,
  onToggleRestriction,
  onSubmit,
  onClose,
}: {
  profile: Profile;
  onboarding: boolean;
  busy: boolean;
  message: string;
  onChange: (profile: Profile) => void;
  onToggleRestriction: (restriction: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose?: () => void;
}) {
  return (
    <div className="onboarding-screen">
      <header className="onboarding-header">
        <span>Dinny</span>
        {onClose && (
          <button onClick={onClose} aria-label="Close profile">
            <X size={19} />
          </button>
        )}
      </header>

      <form className="profile-form" onSubmit={onSubmit}>
        <div className="profile-heading">
          <UserRound size={21} />
          <h1>{onboarding ? "Tell us about you" : "Your profile"}</h1>
          <p>Used to tailor your recipes.</p>
        </div>

        <div className="field-grid">
          <label>
            <span>Name</span>
            <input
              value={profile.displayName}
              onChange={(event) =>
                onChange({ ...profile, displayName: event.target.value })
              }
              autoComplete="name"
              required
            />
          </label>
          <label>
            <span>Age</span>
            <input
              type="number"
              min="1"
              max="120"
              value={profile.age}
              onChange={(event) =>
                onChange({ ...profile, age: event.target.value })
              }
              required
            />
          </label>
          <label>
            <span>Gender</span>
            <select
              value={profile.gender}
              onChange={(event) =>
                onChange({ ...profile, gender: event.target.value })
              }
              required
            >
              <option value="">Select</option>
              {genderOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Location</span>
            <input
              value={profile.location}
              onChange={(event) =>
                onChange({ ...profile, location: event.target.value })
              }
              placeholder="City, country"
              autoComplete="address-level2"
              required
            />
          </label>
        </div>

        {onboarding && (
          <fieldset>
            <legend>Dietary restrictions</legend>
            <div className="restriction-grid">
              {dietaryRestrictionOptions.map((restriction) => {
                const selected = profile.restrictions.includes(restriction);
                return (
                  <button
                    type="button"
                    key={restriction}
                    className={
                      selected ? "restriction selected" : "restriction"
                    }
                    onClick={() => onToggleRestriction(restriction)}
                    aria-pressed={selected}
                  >
                    <span>{selected && <Check size={14} />}</span>
                    {restriction}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {message && <p className="form-message">{message}</p>}
        <button className="continue-button" disabled={busy}>
          {busy ? "Saving…" : onboarding ? "Continue" : "Save"}
        </button>
      </form>
    </div>
  );
}
