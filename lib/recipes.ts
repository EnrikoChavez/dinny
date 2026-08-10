export type Recipe = {
  id: string;
  title: string;
  summary: string;
  time: number;
  calories: number;
  cuisine: string;
  tags: string[];
  dietary?: string[];
  ingredients: string[];
  steps: string[];
  why: string;
};

export const recipes: Recipe[] = [
  {
    id: "harissa-salmon-bowl",
    title: "Harissa salmon bowl",
    summary:
      "Roasted salmon, lemony grains, cucumber, herbs, and a quick yogurt drizzle.",
    time: 28,
    calories: 590,
    cuisine: "Mediterranean",
    tags: ["High protein", "Gluten-free"],
    dietary: ["Gluten-free", "Nut-free", "Halal"],
    ingredients: [
      "2 salmon fillets",
      "2 tbsp harissa paste",
      "2 cups cooked quinoa",
      "1 cucumber, sliced",
      "½ cup Greek yogurt",
      "1 lemon",
      "Fresh dill and mint",
    ],
    steps: [
      "Brush the salmon with harissa and roast at 425°F for 10–12 minutes.",
      "Toss warm quinoa with lemon juice, olive oil, dill, and a pinch of salt.",
      "Stir yogurt with lemon zest and a spoonful of water.",
      "Build the bowls with quinoa, cucumber, salmon, herbs, and yogurt sauce.",
    ],
    why: "Big flavor, minimal prep, and enough protein to keep dinner satisfying.",
  },
  {
    id: "silky-tomato-pasta",
    title: "Silky tomato basil pasta",
    summary:
      "A glossy one-pan tomato sauce with basil, parmesan, and a little pasta water magic.",
    time: 24,
    calories: 540,
    cuisine: "Italian",
    tags: ["Vegetarian", "Pantry-friendly"],
    dietary: ["Vegetarian", "Nut-free"],
    ingredients: [
      "8 oz rigatoni",
      "1 pint cherry tomatoes",
      "3 garlic cloves",
      "⅓ cup grated parmesan",
      "1 handful fresh basil",
      "2 tbsp olive oil",
      "Red pepper flakes",
    ],
    steps: [
      "Boil the pasta until just shy of al dente; save a cup of pasta water.",
      "Burst the tomatoes in olive oil with garlic and pepper flakes.",
      "Toss in the pasta, parmesan, and splashes of pasta water until glossy.",
      "Fold in torn basil and finish with black pepper.",
    ],
    why: "It tastes slow-cooked but comes together in the time it takes to boil pasta.",
  },
  {
    id: "miso-chicken-traybake",
    title: "Miso honey chicken",
    summary:
      "Caramelized chicken thighs and sesame vegetables on one very useful sheet pan.",
    time: 35,
    calories: 620,
    cuisine: "Japanese-inspired",
    tags: ["High protein", "One pan"],
    dietary: ["Dairy-free", "Nut-free"],
    ingredients: [
      "4 boneless chicken thighs",
      "2 tbsp white miso",
      "1 tbsp honey",
      "1 tbsp rice vinegar",
      "1 head broccoli",
      "2 carrots",
      "Sesame seeds",
    ],
    steps: [
      "Whisk miso, honey, rice vinegar, and a splash of water.",
      "Coat chicken in half the glaze and arrange on a lined sheet pan.",
      "Add chopped vegetables, oil, and salt; roast at 425°F for 25 minutes.",
      "Brush with the remaining glaze and broil until the edges caramelize.",
    ],
    why: "A hands-off dinner with a savory-sweet glaze and almost no cleanup.",
  },
  {
    id: "green-goddess-tacos",
    title: "Green goddess tacos",
    summary:
      "Crispy spiced chickpeas, avocado, crunchy cabbage, and a bright herb sauce.",
    time: 22,
    calories: 510,
    cuisine: "Mexican-inspired",
    tags: ["Vegan", "High fiber"],
    dietary: [
      "Vegetarian",
      "Vegan",
      "Gluten-free",
      "Dairy-free",
      "Nut-free",
      "Halal",
      "Kosher",
    ],
    ingredients: [
      "1 can chickpeas",
      "8 corn tortillas",
      "1 avocado",
      "2 cups shredded cabbage",
      "1 bunch cilantro",
      "1 lime",
      "1 jalapeño",
    ],
    steps: [
      "Pat chickpeas dry and crisp them in a skillet with cumin and smoked paprika.",
      "Blend cilantro, lime, jalapeño, avocado, salt, and a little water.",
      "Warm the tortillas directly over a burner or in a dry pan.",
      "Fill with cabbage and chickpeas, then spoon over the herb sauce.",
    ],
    why: "Crunchy, creamy, bright, and fully plant-based without feeling like a compromise.",
  },
  {
    id: "tahini-crunch-salad",
    title: "Tahini crunch salad",
    summary:
      "Roasted sweet potato, avocado, greens, herbs, and a lemon-tahini dressing.",
    time: 30,
    calories: 480,
    cuisine: "Middle Eastern-inspired",
    tags: ["Vegan", "Gluten-free"],
    dietary: [
      "Vegetarian",
      "Vegan",
      "Gluten-free",
      "Dairy-free",
      "Nut-free",
      "Halal",
      "Kosher",
    ],
    ingredients: [
      "1 large sweet potato",
      "4 cups mixed greens",
      "1 avocado",
      "¼ cup pumpkin seeds",
      "2 tbsp tahini",
      "1 lemon",
      "Fresh parsley",
    ],
    steps: [
      "Cube and roast the sweet potato at 425°F until browned and tender.",
      "Whisk tahini with lemon juice, water, and salt until pourable.",
      "Layer greens, sweet potato, avocado, parsley, and pumpkin seeds.",
      "Dress generously and toss just before serving.",
    ],
    why: "It balances cozy roasted vegetables with fresh crunch and a deeply savory dressing.",
  },
  {
    id: "lemony-pea-orzo",
    title: "Lemony pea orzo",
    summary:
      "Creamy orzo with sweet peas, spinach, lemon, and a shower of pecorino.",
    time: 20,
    calories: 500,
    cuisine: "Italian",
    tags: ["Vegetarian", "20 minutes"],
    dietary: ["Vegetarian", "Nut-free"],
    ingredients: [
      "1 cup orzo",
      "1½ cups vegetable stock",
      "1 cup frozen peas",
      "2 cups baby spinach",
      "½ cup grated pecorino",
      "1 lemon",
      "2 garlic cloves",
    ],
    steps: [
      "Toast orzo and sliced garlic in olive oil for two minutes.",
      "Add stock and simmer, stirring often, until the orzo is creamy.",
      "Fold in peas and spinach until bright and tender.",
      "Finish with lemon zest, lemon juice, pecorino, and black pepper.",
    ],
    why: "Fast enough for a tired Tuesday, but creamy and bright enough to feel special.",
  },
];
