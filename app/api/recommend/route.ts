import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { recipeImages, recipes, type Recipe } from "@/lib/recipes";

type RequestBody = {
  prompt?: string;
  preferences?: string[];
};

const recipeSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    recipes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          time: { type: "number" },
          calories: { type: "number" },
          cuisine: { type: "string" },
          tags: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string" },
          },
          ingredients: {
            type: "array",
            minItems: 5,
            maxItems: 10,
            items: { type: "string" },
          },
          steps: {
            type: "array",
            minItems: 3,
            maxItems: 6,
            items: { type: "string" },
          },
          why: { type: "string" },
        },
        required: [
          "id",
          "title",
          "summary",
          "time",
          "calories",
          "cuisine",
          "tags",
          "ingredients",
          "steps",
          "why",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["message", "recipes"],
  additionalProperties: false,
};

function localRecommendations(prompt: string, preferences: string[]) {
  const query = `${prompt} ${preferences.join(" ")}`.toLowerCase();
  const scored = recipes
    .map((recipe, index) => {
      const haystack = [
        recipe.title,
        recipe.cuisine,
        recipe.summary,
        ...recipe.tags,
      ]
        .join(" ")
        .toLowerCase();
      const words = query.split(/\W+/).filter((word) => word.length > 2);
      const score =
        words.filter((word) => haystack.includes(word)).length * 10 -
        (query.includes("quick") ? recipe.time : 0) +
        (query.includes("vegetarian") && recipe.tags.includes("Vegetarian")
          ? 20
          : 0) +
        (query.includes("vegan") && recipe.tags.includes("Vegan") ? 20 : 0) +
        index / 100;
      return { recipe, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ recipe }) => recipe);

  return {
    message:
      "Here are three strong matches. I balanced your request with weeknight-friendly prep and ingredients you can actually find.",
    recipes: scored,
    mode: "sample" as const,
  };
}

function readOutputText(payload: {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}) {
  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text")?.text;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Authentication is unavailable." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to ask Dinny." },
      { status: 401 },
    );
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const prompt = body.prompt?.trim().slice(0, 600) || "A quick balanced dinner";
  const preferences = (body.preferences ?? []).slice(0, 8);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(localRecommendations(prompt, preferences));
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6",
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content:
              "You are Dinny, a practical recipe recommender. Return exactly three varied, realistic recipes. Respect every stated dietary restriction. Use common grocery-store ingredients, concise steps, and honest estimated time and calories. Make the explanation warm and direct.",
          },
          {
            role: "user",
            content: `Dinner request: ${prompt}\nSaved preferences: ${
              preferences.join(", ") || "none"
            }`,
          },
        ],
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "recipe_recommendations",
            strict: true,
            schema: recipeSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const payload = await response.json();
    const outputText = readOutputText(payload);
    if (!outputText) throw new Error("No structured output returned.");

    const parsed = JSON.parse(outputText) as {
      message: string;
      recipes: Array<Omit<Recipe, "image">>;
    };

    return NextResponse.json({
      ...parsed,
      recipes: parsed.recipes.map((recipe, index) => ({
        ...recipe,
        image: recipeImages[index % recipeImages.length],
      })),
      mode: "ai",
    });
  } catch (error) {
    console.error("Recommendation fallback:", error);
    return NextResponse.json(localRecommendations(prompt, preferences));
  }
}
