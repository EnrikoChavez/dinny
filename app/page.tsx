"use client";

import Image from "next/image";
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChefHat,
  Clock3,
  Compass,
  Flame,
  History,
  LogOut,
  Mail,
  MessageCircle,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { recipes as initialRecipes, type Recipe } from "@/lib/recipes";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase-browser";

type Tab = "discover" | "ask" | "last-used";
type HistoryItem = { recipe: Recipe; usedAt: string };

const preferenceOptions = [
  "Vegetarian",
  "High protein",
  "Under 30 min",
  "Gluten-free",
  "Vegan",
];

const suggestionPrompts = [
  "Something cozy in 30 minutes",
  "High-protein and fresh",
  "Use up vegetables",
  "A meatless crowd-pleaser",
];

function formatHistoryDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return isToday
    ? `Today, ${date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export default function Home() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [lastUsed, setLastUsed] = useState<HistoryItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState("");
  const [recommendations, setRecommendations] =
    useState<Recipe[]>(initialRecipes.slice(0, 3));
  const [assistantMessage, setAssistantMessage] = useState(
    "What are you in the mood for?",
  );
  const [recommendationMode, setRecommendationMode] = useState<
    "idle" | "loading" | "ai" | "sample"
  >("idle");

  useEffect(() => {
    queueMicrotask(() => {
      const savedPreferences =
        window.localStorage.getItem("dinny-preferences") ??
        window.localStorage.getItem("mise-preferences");
      const savedHistory =
        window.localStorage.getItem("dinny-last-used") ??
        window.localStorage.getItem("mise-last-used");

      if (savedPreferences) {
        try {
          setPreferences(JSON.parse(savedPreferences));
        } catch {
          window.localStorage.removeItem("dinny-preferences");
          window.localStorage.removeItem("mise-preferences");
        }
      }

      if (savedHistory) {
        try {
          setLastUsed(JSON.parse(savedHistory));
        } catch {
          window.localStorage.removeItem("dinny-last-used");
          window.localStorage.removeItem("mise-last-used");
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setAuthOpen(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user || !supabase) return;

    supabase
      .from("recipe_history")
      .select("recipe, used_at")
      .order("used_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data?.length) return;
        const cloudHistory = data.map((item) => ({
          recipe: item.recipe as Recipe,
          usedAt: item.used_at as string,
        }));
        setLastUsed(cloudHistory);
        window.localStorage.setItem("dinny-last-used", JSON.stringify(cloudHistory));
      });
  }, [supabase, user]);

  function togglePreference(preference: string) {
    const next = preferences.includes(preference)
      ? preferences.filter((item) => item !== preference)
      : [...preferences, preference];
    setPreferences(next);
    window.localStorage.setItem("dinny-preferences", JSON.stringify(next));
  }

  async function rememberRecipe(recipe: Recipe) {
    const entry = { recipe, usedAt: new Date().toISOString() };
    const next = [
      entry,
      ...lastUsed.filter((item) => item.recipe.id !== recipe.id),
    ].slice(0, 20);
    setLastUsed(next);
    window.localStorage.setItem("dinny-last-used", JSON.stringify(next));

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

  async function requestRecommendations(
    event?: FormEvent,
    suggestedPrompt?: string,
  ) {
    event?.preventDefault();
    if (!user) {
      setAuthMessage("Sign in to ask Dinny.");
      setAuthOpen(true);
      return;
    }

    const requestPrompt = (suggestedPrompt ?? prompt).trim();
    if (!requestPrompt || recommendationMode === "loading") return;

    setPrompt(requestPrompt);
    setActiveTab("ask");
    setRecommendationMode("loading");
    setAssistantMessage("Finding three good matches…");

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: requestPrompt, preferences }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Try again.");
      setRecommendations(data.recipes);
      setAssistantMessage(data.message);
      setRecommendationMode(data.mode === "ai" ? "ai" : "sample");
    } catch {
      setAssistantMessage(
        "I couldn’t refresh the list. Try again in a moment.",
      );
      setRecommendations(initialRecipes.slice(0, 3));
      setRecommendationMode("sample");
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setAuthMessage(
        "Google sign-in is ready for your Supabase keys in the deployment settings.",
      );
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
    if (!email.trim()) return;

    if (!supabase) {
      setAuthMessage(
        "Email verification is ready for your Supabase keys in the deployment settings.",
      );
      return;
    }

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
      error
        ? error.message
        : "Check your inbox for a secure sign-in link. You can close this window.",
    );
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null);
    setActiveTab("discover");
  }

  function openAsk() {
    if (!user) {
      setAuthMessage("Sign in to ask Dinny.");
      setAuthOpen(true);
      return;
    }
    setActiveTab("ask");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setActiveTab("discover")}
          aria-label="Go to Dinny home"
        >
          <span className="brand-mark">
            <ChefHat size={18} strokeWidth={2.4} />
          </span>
          <span>Dinny</span>
        </button>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <NavButton
            active={activeTab === "discover"}
            onClick={() => setActiveTab("discover")}
          >
            Discover
          </NavButton>
          <NavButton
            active={activeTab === "ask"}
            onClick={openAsk}
          >
            Ask
          </NavButton>
          <NavButton
            active={activeTab === "last-used"}
            onClick={() => setActiveTab("last-used")}
          >
            Last used
          </NavButton>
        </nav>

        <div className="account-actions">
          {user ? (
            <>
              <button className="user-pill" onClick={() => setAuthOpen(true)}>
                <span>{user.email?.slice(0, 1).toUpperCase()}</span>
                <span className="user-email">{user.email}</span>
              </button>
              <button
                className="icon-button"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button className="sign-in-button" onClick={() => setAuthOpen(true)}>
              <UserRound size={17} />
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="main-content">
        {activeTab === "discover" && (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <p className="eyebrow">
                  <Sparkles size={15} />
                  Dinner, decided
                </p>
                <h1>What sounds good tonight?</h1>
                <p className="hero-description">
                  Say what you want. Dinny finds three good options.
                </p>

                <form
                  className="prompt-box hero-prompt"
                  onSubmit={requestRecommendations}
                >
                  <div className="prompt-input-row">
                    <MessageCircle size={20} aria-hidden="true" />
                    <input
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="e.g. quick dinner with chicken and greens"
                      aria-label="Describe what you want to cook"
                    />
                    <button
                      type="submit"
                      className="submit-prompt"
                      aria-label="Get recommendations"
                      disabled={!prompt.trim()}
                    >
                      <ArrowUp size={18} />
                    </button>
                  </div>
                </form>

                <div className="preference-row" aria-label="Recipe preferences">
                  <span className="preference-label">
                    <SlidersHorizontal size={15} />
                    Tune your picks
                  </span>
                  {preferenceOptions.slice(0, 4).map((preference) => (
                    <button
                      key={preference}
                      className={
                        preferences.includes(preference)
                          ? "preference-chip selected"
                          : "preference-chip"
                      }
                      onClick={() => togglePreference(preference)}
                      aria-pressed={preferences.includes(preference)}
                    >
                      {preferences.includes(preference) && <Check size={13} />}
                      {preference}
                    </button>
                  ))}
                </div>
              </div>

              <FeaturedRecipe recipe={initialRecipes[0]} onOpen={openRecipe} />
            </section>

            <section className="content-section">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Made for real weeknights</p>
                  <h2>Popular recipes</h2>
                </div>
                <button className="text-button" onClick={openAsk}>
                  Get personal picks <ArrowRight size={16} />
                </button>
              </div>
              <div className="recipe-grid">
                {initialRecipes.slice(1, 4).map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onOpen={openRecipe}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "ask" && (
          <section className="ask-layout">
            <div className="ask-intro">
              <p className="eyebrow">
                <Sparkles size={15} /> Personal picks
              </p>
              <h1>Ask Dinny</h1>
              <p>
                Tell me what you have, want, or avoid.
              </p>
              <div className="suggestion-list">
                {suggestionPrompts.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() =>
                      requestRecommendations(undefined, suggestion)
                    }
                  >
                    {suggestion}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </div>

            <div className="ask-workspace">
              <form className="prompt-box" onSubmit={requestRecommendations}>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="I have spinach and half a rotisserie chicken. I want something fresh and filling in under 25 minutes…"
                  aria-label="Describe your dinner request"
                  rows={3}
                />
                <div className="prompt-footer">
                  <div className="active-preferences">
                    {preferences.length
                      ? preferences.map((preference) => (
                          <span key={preference}>{preference}</span>
                        ))
                      : "No dietary filters set"}
                  </div>
                  <button
                    className="primary-button"
                    disabled={
                      !prompt.trim() || recommendationMode === "loading"
                    }
                  >
                    {recommendationMode === "loading" ? (
                      <span className="loading-dot" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    Find dinner
                  </button>
                </div>
              </form>

              <div className="assistant-note">
                <span className="assistant-avatar">
                  <ChefHat size={17} />
                </span>
                <div>
                  <strong>Dinny</strong>
                  <p>{assistantMessage}</p>
                  {recommendationMode === "sample" && (
                    <small>Sample picks · connect OpenAI for live generation</small>
                  )}
                </div>
              </div>

              <div className="recipe-grid compact">
                {recommendations.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onOpen={openRecipe}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "last-used" && (
          <section className="history-section">
            <div className="history-heading">
              <div>
                <p className="eyebrow">
                  <History size={15} /> Your history
                </p>
                <h1>Last used</h1>
                <p>
                  Recipes you opened are saved here
                  {user ? " and synced to your account." : "."}
                </p>
              </div>
              {!user && (
                <button
                  className="secondary-button"
                  onClick={() => setAuthOpen(true)}
                >
                  Sign in to sync
                </button>
              )}
            </div>

            {lastUsed.length ? (
              <div className="history-list">
                {lastUsed.map((item, index) => (
                  <button
                    className="history-card"
                    key={`${item.recipe.id}-${item.usedAt}`}
                    onClick={() => openRecipe(item.recipe)}
                  >
                    <span className="history-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="history-image">
                      <Image
                        src={item.recipe.image}
                        alt=""
                        fill
                        sizes="88px"
                      />
                    </span>
                    <span className="history-copy">
                      <strong>{item.recipe.title}</strong>
                      <span>
                        {item.recipe.cuisine} · {item.recipe.time} min
                      </span>
                    </span>
                    <time>{formatHistoryDate(item.usedAt)}</time>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span>
                  <History size={26} />
                </span>
                <h2>Nothing here yet</h2>
                <p>Open a recipe and it will show up here.</p>
                <button
                  className="primary-button"
                  onClick={() => setActiveTab("discover")}
                >
                  Discover recipes
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <MobileNavButton
          label="Discover"
          active={activeTab === "discover"}
          onClick={() => setActiveTab("discover")}
          icon={<Compass size={20} />}
        />
        <MobileNavButton
          label="Ask"
          active={activeTab === "ask"}
          onClick={openAsk}
          icon={<Sparkles size={20} />}
        />
        <MobileNavButton
          label="Last used"
          active={activeTab === "last-used"}
          onClick={() => setActiveTab("last-used")}
          icon={<History size={20} />}
        />
      </nav>

      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      {authOpen && (
        <AuthModal
          email={email}
          setEmail={setEmail}
          message={authMessage}
          busy={authBusy}
          user={user}
          configured={hasSupabaseConfig}
          onGoogle={signInWithGoogle}
          onEmail={signInWithEmail}
          onClose={() => {
            setAuthOpen(false);
            setAuthMessage("");
          }}
          onSignOut={signOut}
        />
      )}
    </div>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>
      {children}
    </button>
  );
}

function MobileNavButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      className={active ? "mobile-nav-button active" : "mobile-nav-button"}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FeaturedRecipe({
  recipe,
  onOpen,
}: {
  recipe: Recipe;
  onOpen: (recipe: Recipe) => void;
}) {
  return (
    <article className="featured-card">
      <Image
        src={recipe.image}
        alt={recipe.title}
        fill
        priority
        sizes="(max-width: 800px) 100vw, 44vw"
      />
      <div className="featured-shade" />
      <div className="featured-badge">
        <Sparkles size={14} /> Tonight’s match
      </div>
      <div className="featured-content">
        <div className="recipe-meta light">
          <span>
            <Clock3 size={15} /> {recipe.time} min
          </span>
          <span>
            <Flame size={15} /> {recipe.calories} cal
          </span>
        </div>
        <h2>{recipe.title}</h2>
        <p>{recipe.summary}</p>
        <button onClick={() => onOpen(recipe)}>
          View recipe <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}

function RecipeCard({
  recipe,
  onOpen,
}: {
  recipe: Recipe;
  onOpen: (recipe: Recipe) => void;
}) {
  return (
    <article className="recipe-card">
      <button
        className="recipe-image"
        onClick={() => onOpen(recipe)}
        aria-label={`Open ${recipe.title}`}
      >
        <Image
          src={recipe.image}
          alt={recipe.title}
          fill
          sizes="(max-width: 760px) 100vw, 33vw"
        />
        <span className="time-pill">
          <Clock3 size={13} /> {recipe.time} min
        </span>
      </button>
      <div className="recipe-card-content">
        <div className="tag-row">
          {recipe.tags.slice(0, 2).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <button className="recipe-title" onClick={() => onOpen(recipe)}>
          {recipe.title}
        </button>
        <p>{recipe.summary}</p>
        <div className="recipe-card-footer">
          <span>{recipe.cuisine}</span>
          <span>{recipe.calories} cal</span>
        </div>
      </div>
    </article>
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
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <article
        className="recipe-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close recipe">
          <X size={20} />
        </button>
        <div className="detail-hero">
          <Image
            src={recipe.image}
            alt={recipe.title}
            fill
            sizes="(max-width: 760px) 100vw, 680px"
          />
        </div>
        <div className="detail-content">
          <p className="section-kicker">{recipe.cuisine}</p>
          <h2 id="recipe-title">{recipe.title}</h2>
          <p className="detail-summary">{recipe.summary}</p>
          <div className="detail-stats">
            <span>
              <Clock3 size={16} /> {recipe.time} minutes
            </span>
            <span>
              <Flame size={16} /> {recipe.calories} calories
            </span>
          </div>
          <div className="why-box">
            <Sparkles size={18} />
            <div>
              <strong>Why this works</strong>
              <p>{recipe.why}</p>
            </div>
          </div>
          <div className="detail-columns">
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
  user,
  configured,
  onGoogle,
  onEmail,
  onClose,
  onSignOut,
}: {
  email: string;
  setEmail: (value: string) => void;
  message: string;
  busy: boolean;
  user: User | null;
  configured: boolean;
  onGoogle: () => void;
  onEmail: (event: FormEvent) => void;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="modal-backdrop auth-backdrop" onMouseDown={onClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close sign in">
          <X size={20} />
        </button>
        <span className="auth-brand-mark">
          <ChefHat size={23} />
        </span>
        {user ? (
          <>
            <p className="section-kicker">You’re signed in</p>
            <h2 id="auth-title">Welcome back.</h2>
            <p className="auth-description">
              Your preferences and recently used recipes can follow you across
              devices.
            </p>
            <div className="signed-in-card">
              <span>{user.email?.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{user.user_metadata.full_name || "Home cook"}</strong>
                <p>{user.email}</p>
              </div>
            </div>
            <button className="secondary-button full" onClick={onSignOut}>
              <LogOut size={16} /> Sign out
            </button>
          </>
        ) : (
          <>
            <p className="section-kicker">Welcome</p>
            <h2 id="auth-title">Sign in to Dinny.</h2>
            <p className="auth-description">
              Ask for recipes and keep your history.
            </p>
            <button
              className="google-button"
              onClick={onGoogle}
              disabled={busy}
            >
              <span className="google-g">G</span>
              Continue with Google
            </button>
            <div className="auth-divider">
              <span>or use email</span>
            </div>
            <form onSubmit={onEmail}>
              <label htmlFor="email">Email address</label>
              <div className="email-field">
                <Mail size={17} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <button className="primary-button full" disabled={busy}>
                Email me a verification link
              </button>
            </form>
            {message && (
              <p className={configured ? "auth-message" : "auth-message setup"}>
                {message}
              </p>
            )}
            <p className="auth-legal">
              Password-free. Your data stays yours.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
