// "October Cut Plan: Day by Day" (16 Oct 2026, updated 22 Oct with the 3ü1 in the shake),
// transcribed as written: 22–31 October, meal by meal, with the plan's own kcal and protein.
// The research, tracking and sources sections stay in the plan; only what to eat is here.
import type { Meal, MealPlan } from "@/lib/meal-plan";

const SHAKE = "Shake: 1 scoop whey + 300 ml SEK protein milk + 1 Nescafé 3ü1";
const shake = (skip: string): Meal => ({ time: "21:00", what: `${SHAKE}. Skip the ${skip}`, kcal: 335, protein: 40 });
const grabEggs = (skip: string): Meal => ({
  time: "07:30–08:40", what: `Take 2 boiled eggs and 1 slice of beyaz peynir with you. Skip the ${skip}`, kcal: null, protein: null,
});
const MULTIVITAMIN: Meal = { time: "11:00", what: "Multivitamin", kcal: null, protein: null };
const CREATINE: Meal = { time: "16:40", what: "Creatine (1 serving, 3–5 g) with water", kcal: null, protein: null };
const GYM: Meal = { time: "After 16:40", what: "Gym (full body). Drink water during the session", kcal: null, protein: null };

export const OCTOBER_2026: MealPlan = {
  title: "October Cut Plan",
  target: { rest: 1800, gym: 2000 },
  water: { rest: 2.5, gym: 3 },
  waterNote: "500 ml before lunch and dinner",
  days: {
    "2026-10-22": {
      kind: "rest",
      meals: [
        grabEggs("simit and the boyoz"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the süt + fruit", kcal: 368, protein: 17 },
        { time: "Lunch", what: "Mercimek çorba (209) + Mantı (322) + yoğurt (122) + salad, no oil (40)", kcal: 693, protein: 30 },
        { time: "16:00", what: "Skip the cheesecake", kcal: null, protein: null },
        { time: "18:30 dinner", what: "Mantarlı et sote (171) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 373, protein: 26 },
        shake("çorba"),
      ],
      total: { kcal: 1769, protein: 113 },
    },
    "2026-10-23": {
      kind: "gym",
      meals: [
        grabEggs("poğaça and the rulo börek"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the yoğurt (skip the granola)", kcal: 322, protein: 17 },
        { time: "Lunch", what: "Şehriye çorba (186) + Hürrem Sultan kebabı (395) + makarna (250) + yoğurt (122) + salad, no oil (40)", kcal: 993, protein: 42 },
        { time: "16:00", what: "Skip the kuruyemiş. Lunch is your fuel for training", kcal: null, protein: null },
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Lahana kapuska (169) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 371, protein: 14 },
        shake("üzümlü kek"),
      ],
      total: { kcal: 2021, protein: 113 },
    },
    "2026-10-24": {
      kind: "rest",
      home: true,
      meals: [
        { time: "Breakfast", what: "2 boiled eggs, yolks only, + 1 slice of beyaz peynir. Skip the simit and the omlet", kcal: 200, protein: 10 },
        MULTIVITAMIN,
        { time: "Lunch", what: "Izgara köfte (345) + yoğurt (122) + salad, no oil (40)", kcal: 507, protein: 34 },
        { time: "16:00", what: "Yoğurt + fruit from the snack table", kcal: 168, protein: 8 },
        { time: "18:30 dinner", what: "Lahmacun (350) + ayran (122) + salad, 1 tsp oil (80)", kcal: 552, protein: 20 },
        shake("kaşarlı sandviç and ayran"),
      ],
      total: { kcal: 1762, protein: 112 },
    },
    "2026-10-25": {
      kind: "rest",
      home: true,
      meals: [
        { time: "Breakfast", what: "2 boiled eggs, yolks only, + 1 slice of beyaz peynir. Skip the poğaça and the menemen", kcal: 200, protein: 10 },
        MULTIVITAMIN,
        { time: "Lunch", what: "Fırında piliç baget (340) + yoğurt (122) + salad, no oil (40)", kcal: 502, protein: 36 },
        { time: "16:00", what: "The süt; skip the kurabiye", kcal: 122, protein: 6 },
        { time: "18:30 dinner", what: "Kayseri köfte (389) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 591, protein: 30 },
        shake("börek and komposto"),
      ],
      total: { kcal: 1750, protein: 123 },
    },
    "2026-10-26": {
      kind: "gym",
      meals: [
        grabEggs("simit and the sucuklu yumurta"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the kefir. Keep the fruit for 16:00", kcal: 320, protein: 17 },
        { time: "Lunch", what: "Tarhana çorba (204) + Paşazade kebabı (350) + ½ bulgur pilavı (105) + yoğurt (122) + salad, no oil (40)", kcal: 821, protein: 38 },
        { time: "16:00", what: "The fruit from 11:00, 30–60 min before training. Skip the çikolatalı milföy", kcal: 46, protein: null },
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Etli kuru fasulye (280) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 482, protein: 24 },
        shake("çorba"),
      ],
      total: { kcal: 2004, protein: 119 },
    },
    "2026-10-27": {
      kind: "rest",
      meals: [
        grabEggs("poğaça and the sigara böreği"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the süt + fruit", kcal: 368, protein: 17 },
        { time: "Lunch", what: "Ezogelin çorba (194) + Samanyolu köfte (300) + yoğurt (122) + salad, no oil (40)", kcal: 656, protein: 36 },
        { time: "16:00", what: "Skip the ağlayan kek", kcal: null, protein: null },
        { time: "18:30 dinner", what: "Piliç roti (197) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 399, protein: 30 },
        shake("tost and ayran"),
      ],
      total: { kcal: 1758, protein: 123 },
    },
    "2026-10-28": {
      kind: "gym",
      meals: [
        grabEggs("simit and the kaşarlı patates"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the yoğurt. Keep the fruit for 16:00", kcal: 322, protein: 17 },
        { time: "Lunch", what: "Etli taze fasulye (289) + erişte (250) + yoğurt (122) + salad, no oil (40)", kcal: 701, protein: 24 },
        { time: "16:00", what: "The fruit from 11:00, 30–60 min before training. Skip the bisküvi pasta", kcal: 46, protein: null },
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Ankara tava (380) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 582, protein: 28 },
        shake("simit and ayran"),
      ],
      total: { kcal: 1986, protein: 110 },
    },
    "2026-10-29": {
      kind: "rest",
      occasion: "Cumhuriyet Bayramı",
      note: "If the menu changes, take a meat main with yogurt and salad and skip soups and sides; if you go home, use Weekends at home.",
      home: true,
      meals: [
        { time: "07:30–08:40", what: "Take 2 boiled eggs and 2 slices of beyaz peynir with you. Skip the poğaça and the pişi", kcal: null, protein: null },
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the süt + fruit", kcal: 458, protein: 22 },
        { time: "Lunch", what: "Mantarlı tavuk sote (300) + yoğurt (122) + salad, no oil (40)", kcal: 462, protein: 34 },
        { time: "16:00", what: "Skip the cheesecake", kcal: null, protein: null },
        { time: "18:30 dinner", what: "Karnıyarık (348) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 550, protein: 20 },
        shake("çorba"),
      ],
      total: { kcal: 1805, protein: 116 },
    },
    "2026-10-30": {
      kind: "gym",
      meals: [
        grabEggs("simit and the menemen"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the yoğurt (skip the granola)", kcal: 322, protein: 17 },
        { time: "Lunch", what: "Hamburger köfte (385) + ayran (122) + salad, no oil (40)", kcal: 547, protein: 30 },
        { time: "16:00", what: "Skip the kuruyemiş", kcal: null, protein: null },
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Orman kebabı (389) + bulgur (210) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 801, protein: 36 },
        shake("üzümlü kek"),
      ],
      total: { kcal: 2005, protein: 123 },
    },
    "2026-10-31": {
      kind: "rest",
      note: "The lowest-protein day (~96 g), so don't skip the shake.",
      home: true,
      meals: [
        { time: "Breakfast", what: "2 boiled eggs, yolks only, + 1 slice of beyaz peynir. Skip the poğaça and the soslu kızartma", kcal: 200, protein: 10 },
        MULTIVITAMIN,
        { time: "Lunch", what: "Etli bezelye (385) + yoğurt (122) + salad, no oil (40)", kcal: 547, protein: 20 },
        { time: "16:00", what: "Yoğurt + fruit from the snack table", kcal: 168, protein: 8 },
        { time: "18:30 dinner", what: "Makarna günü (389) + ayran (122) + salad, 1 tsp oil (80)", kcal: 591, protein: 18 },
        shake("simit and ayran"),
      ],
      total: { kcal: 1841, protein: 96 },
    },
  },
  home: {
    intro: "Keep the breakfast, the shake and the 1,800 kcal. Home portions are harder to count, so these numbers are estimates; when unsure, take the smaller portion.",
    meals: [
      { time: "Breakfast", what: "2 egg yolks + 1 slice of beyaz peynir", kcal: 200, protein: 10 },
      MULTIVITAMIN,
      { time: "Lunch", what: "Palm-sized chicken breast (~150 g cooked) + vegetables with 1 tsp oil + a bowl of yogurt + half a fist of rice, bulgur or pasta (~50 g cooked)", kcal: 535, protein: 54 },
      { time: "Afternoon", what: "1 piece of fruit + a bowl of yogurt", kcal: 180, protein: 7 },
      { time: "Dinner", what: "Palm-sized meat, köfte or fish (~150 g cooked) + vegetables with 1 tsp oil + a bowl of yogurt. No rice or bread", kcal: 560, protein: 45 },
      { time: "21:00", what: "Shake with the 3ü1", kcal: 335, protein: 40 },
    ],
    total: { kcal: 1810, protein: 155 },
    tips: [
      { lead: "Swaps:", text: "chicken, turkey and white fish are the leanest. Red meat or köfte has about 100 kcal more per portion, so if you have it at lunch, skip the rice there." },
      { lead: "Home cooking uses more oil:", text: "a plate of zeytinyağlı or sebze yemeği is about 200–300 kcal. Count it as your vegetables and oil, and take a smaller plate." },
      { lead: "No bread, second helpings, desserts or sweet drinks.", text: "Tea and water are free." },
      { lead: "Learn the portions once:", text: "weigh 150 g of cooked meat and 100 g of cooked rice one time, then eyeball it after that." },
    ],
  },
  rules: [
    { lead: "Take only what the day table lists.", text: "Skip any soup, side, bread, dessert or hot breakfast dish that isn't in it." },
    { lead: "Salad:", text: "plain raw vegetables (lettuce, tomato, cucumber, carrot, peppers). Lunch: lemon or vinegar only, about 40 kcal. Dinner: add 1 teaspoon of oil, about 80 kcal. Skip the prepared salad dish listed next to the yogurt (zeytinyağlı dishes, tarator, pembe sultan, coleslaw, yoğurtlu makarna); the menu's 260 kcal for a salad-bar plate assumes dressings like these." },
    { lead: "Portions:", text: "½ means half of what they serve you. Everything else is one normal serving, no seconds." },
    { lead: "Bread:", text: "none. A slice is 70–80 kcal and isn't in any total." },
    { lead: "Desserts:", text: "none are counted. If you really want one, take it on a gym day instead of that day's rice or pasta, and only if it has fewer calories. Sütlaç (111) is the lightest on the menu." },
    { lead: "Drinks:", text: "water, tea or black coffee. Ayran only where the table lists it." },
    { lead: "Don't skip the breakfast items or the shake.", text: "Without either one, a rest day drops below 1,700 kcal." },
    { lead: "SEK milk:", text: "finish an opened carton within 2 days, as the label says. At 300 ml a day, buy a smaller pack if your shop has one." },
    { lead: "Menu changes:", text: "if a dish is swapped, take the closest match (meat for meat, soup for soup) in the same portion." },
  ],
};
