"use client";

import type { User } from "@supabase/supabase-js";
import {
  ArrowUp,
  Check,
  ChevronRight,
  Clock3,
  History,
  LogOut,
  Mail,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { recipes as initialRecipes, type Recipe } from "@/lib/recipes";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase-browser";

type View = "home" | "last-used";
type HistoryItem = { recipe: Recipe; usedAt: string };
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

const restrictionOptions = [
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Dairy-free",
  "Nut-free",
  "Halal",
  "Kosher",
];

const genderOptions = [
  "Woman",
  "Man",
  "Non-binary",
  "Prefer not to say",
];

function rankRecipes(restrictions: string[]) {
  return [...initialRecipes]
    .map((recipe, index) => ({
      recipe,
      score:
        restrictions.filter((restriction) =>
          recipe.tags.some(
            (tag) => tag.toLowerCase() === restriction.toLowerCase(),
          ),
        ).length *
          10 -
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
  const [lastUsed, setLastUsed] = useState<HistoryItem[]>([]);
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
        setProfileReady(true);
        setRecommendations(initialRecipes.slice(0, 3));
        setLastUsed([]);
      });
      return;
    }

    let cancelled = false;
    const accountSupabase = supabase;
    const accountUser = user;

    async function loadAccount() {
      const [{ data: profileData }, { data: historyData }] = await Promise.all([
        accountSupabase
          .from("profiles")
          .select(
            "display_name, age, gender, location, dietary_restrictions, onboarding_complete",
          )
          .eq("id", accountUser.id)
          .maybeSingle(),
        accountSupabase
          .from("recipe_history")
          .select("recipe, used_at")
          .order("used_at", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      const localComplete =
        window.localStorage.getItem(`dinny-onboarding-${accountUser.id}`) ===
        "done";
      const nextProfile: Profile = {
        displayName:
          profileData?.display_name ||
          accountUser.user_metadata.full_name ||
          accountUser.user_metadata.name ||
          "",
        age: profileData?.age ? String(profileData.age) : "",
        gender: profileData?.gender || "",
        location: profileData?.location || "",
        restrictions: Array.isArray(profileData?.dietary_restrictions)
          ? profileData.dietary_restrictions
          : [],
        complete: Boolean(profileData?.onboarding_complete || localComplete),
      };

      const cloudHistory = (historyData ?? []).map((item) => ({
        recipe: item.recipe as Recipe,
        usedAt: item.used_at as string,
      }));

      setProfile(nextProfile);
      setProfileDraft(nextProfile);
      setRecommendations(rankRecipes(nextProfile.restrictions));
      setLastUsed(cloudHistory);
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
    setRecommendations(rankRecipes(nextProfile.restrictions));
    setProfileOpen(false);
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
    const entry = { recipe, usedAt: new Date().toISOString() };
    setLastUsed((current) => [
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
        },
        { onConflict: "user_id,recipe_id" },
      );
    }
  }

  async function openRecipe(recipe: Recipe) {
    await rememberRecipe(recipe);
    setSelectedRecipe(recipe);
  }

  async function requestRecommendations(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      setAuthMessage("Sign in to ask Dinny.");
      setAuthOpen(true);
      return;
    }

    const requestPrompt = prompt.trim();
    if (!requestPrompt || recommendationLoading) return;

    setRecommendationLoading(true);
    setAssistantMessage("");

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: requestPrompt,
          preferences: profile.restrictions,
          profile: {
            age: profile.age,
            gender: profile.gender,
            location: profile.location,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Try again.");

      setRecommendations(data.recipes);
      setAssistantMessage(data.message);
      setPrompt("");
      setView("home");
    } catch {
      setAssistantMessage("Try again in a moment.");
    } finally {
      setRecommendationLoading(false);
    }
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
            className={view === "last-used" ? "nav-link active" : "nav-link"}
            onClick={() => setView("last-used")}
          >
            Last used
          </button>
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
              <h1>Explore a recipe?</h1>
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
        ) : (
          <section className="history-view">
            <div className="view-heading">
              <History size={18} />
              <h1>Last used</h1>
            </div>

            {lastUsed.length ? (
              <div className="history-list">
                {lastUsed.map((item) => (
                  <button
                    key={`${item.recipe.id}-${item.usedAt}`}
                    className="history-row"
                    onClick={() => openRecipe(item.recipe)}
                  >
                    <span>
                      <strong>{item.recipe.title}</strong>
                      <small>
                        {item.recipe.time} min · {item.recipe.cuisine}
                      </small>
                    </span>
                    <time>{formatHistoryDate(item.usedAt)}</time>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-copy">No recipes yet.</p>
            )}
          </section>
        )}
      </main>

      {view === "home" && (
        <div className="chat-dock">
          <form className="chat-form" onSubmit={requestRecommendations}>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onFocus={() => {
                if (!user) setAuthOpen(true);
              }}
              placeholder={user ? "Ask Dinny" : "Sign in to ask Dinny"}
              aria-label="Ask Dinny for a recipe"
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
}: {
  recipe: Recipe;
  onClose: () => void;
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

        <fieldset>
          <legend>Dietary restrictions</legend>
          <div className="restriction-grid">
            {restrictionOptions.map((restriction) => {
              const selected = profile.restrictions.includes(restriction);
              return (
                <button
                  type="button"
                  key={restriction}
                  className={selected ? "restriction selected" : "restriction"}
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

        {message && <p className="form-message">{message}</p>}
        <button className="continue-button" disabled={busy}>
          {busy ? "Saving…" : onboarding ? "Continue" : "Save"}
        </button>
      </form>
    </div>
  );
}
