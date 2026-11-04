// "November Cut Plan: Day by Day" (16 Oct 2026), transcribed as written: 5–30 November, meal by
// meal, with the plan's own kcal and protein. The research, tracking and sources sections stay in
// the plan; only what to eat is here.
//
// The mid-term break (Sat 14 – Sat 21) has no day tables: the plan says to follow At home, the
// rest-day version on Tue, Thu, Sat and Sun and the gym-day version on Mon, Wed and Fri. So those
// days are the at-home rows themselves. The gym-day version is the plan's bullet applied to them
// (a fist of rice at dinner, ~150 kcal, and a fruit before training, ~70); the plan gives no
// protein for it, so the rice's ~3 g is added to the rest-day dinner's.
import type { Meal, MealDay, MealPlan } from "@/lib/meal-plan";

const SHAKE = "Shake: 1 scoop whey + 300 ml SEK protein milk + 1 Nescafé 3ü1";
const shake = (skip: string): Meal => ({ time: "21:00", what: `${SHAKE}. Skip the ${skip}`, kcal: 335, protein: 40 });
const grabEggs = (slices: 1 | 2, skip: string): Meal => ({
  time: "07:30–08:40",
  what: `Take 2 boiled eggs and ${slices === 1 ? "1 slice" : "2 slices"} of beyaz peynir with you. Skip the ${skip}`,
  kcal: null, protein: null,
});
const MULTIVITAMIN: Meal = { time: "11:00", what: "Multivitamin", kcal: null, protein: null };
const CREATINE: Meal = { time: "16:40", what: "Creatine, if you have it (3–5 g with water)", kcal: null, protein: null };
const GYM: Meal = { time: "After 16:40", what: "Gym (full body). Drink water during the session", kcal: null, protein: null };
const PRE_GYM_FRUIT = (skip: string): Meal => ({
  time: "16:00", what: `The fruit from 11:00, 30–60 min before training. Skip the ${skip}`, kcal: 46, protein: null,
});

const HOME_MEALS: Meal[] = [
  { time: "Breakfast", what: "2 egg yolks + 1 slice of beyaz peynir", kcal: 200, protein: 10 },
  MULTIVITAMIN,
  { time: "Lunch", what: "Palm-sized chicken breast (~150 g cooked) + vegetables with 1 tsp oil + a bowl of yogurt + half a fist of rice, bulgur or pasta (~50 g cooked)", kcal: 535, protein: 54 },
  { time: "Afternoon", what: "1 piece of fruit + a bowl of yogurt", kcal: 180, protein: 7 },
  { time: "Dinner", what: "Palm-sized meat, köfte or fish (~150 g cooked) + vegetables with 1 tsp oil + a bowl of yogurt. No rice or bread", kcal: 560, protein: 45 },
  { time: "21:00", what: "Shake with the 3ü1", kcal: 335, protein: 40 },
];

const BREAK_NOTE = "Mid-term break (Sat 14 – Sat 21): the cafeteria is closed, so this is the At home day. A free meal during the break is fine; keep it to one meal a week, not the whole week.";

/** A break day: the at-home rows, with the gym-day additions on Mon, Wed and Fri. */
function breakDay(kind: MealDay["kind"]): MealDay {
  if (kind === "rest") {
    return { kind, note: BREAK_NOTE, meals: HOME_MEALS, total: { kcal: 1810, protein: 155 } };
  }
  const [breakfast, vitamin, lunch, afternoon, , shakeRow] = HOME_MEALS;
  return {
    kind,
    note: BREAK_NOTE,
    meals: [
      breakfast, vitamin, lunch, afternoon,
      { time: "Before training", what: "1 piece of fruit, if you train", kcal: 70, protein: null },
      { time: "Dinner", what: "Palm-sized meat, köfte or fish (~150 g cooked) + vegetables with 1 tsp oil + a bowl of yogurt + a fist of rice, bulgur or pasta (~100 g cooked). No bread", kcal: 710, protein: 48 },
      shakeRow,
    ],
    total: { kcal: 2030, protein: 158 },
  };
}

export const NOVEMBER_2026: MealPlan = {
  title: "November Cut Plan",
  target: { rest: 1800, gym: 2000 },
  water: { rest: 2.5, gym: 3 },
  waterNote: "500 ml before lunch and dinner",
  days: {
    // Week 1
    "2026-11-05": {
      kind: "rest",
      meals: [
        grabEggs(2, "simit and the pişi"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the süt + fruit", kcal: 458, protein: 22 },
        { time: "Lunch", what: "Yayla çorba (173) + Lahmacun (247) + yoğurt (122) + salad, no oil (40)", kcal: 582, protein: 26 },
        { time: "16:00", what: "Skip the cheesecake", kcal: null, protein: null },
        { time: "18:30 dinner", what: "Kıymalı ıspanak (241) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 443, protein: 20 },
        shake("çorba"),
      ],
      total: { kcal: 1818, protein: 108 },
    },
    "2026-11-06": {
      kind: "gym",
      meals: [
        grabEggs(1, "poğaça and the menemen"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the yoğurt (skip the granola)", kcal: 322, protein: 17 },
        { time: "Lunch", what: "Karnıyarık (300) + ½ pirinç pilavı (125) + ayran (122) + salad, no oil (40)", kcal: 587, protein: 20 },
        { time: "16:00", what: "Skip the kuruyemiş", kcal: null, protein: null },
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Mantar çorba (179) + Hasanpaşa köf/püre (250) + ½ mıs.pirinç pilavı (125) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 756, protein: 32 },
        shake("tost and ayran"),
      ],
      total: { kcal: 2000, protein: 109 },
    },
    "2026-11-07": {
      kind: "rest",
      home: true,
      meals: [
        { time: "Breakfast", what: "2 boiled eggs, yolks only, + 1 slice of beyaz peynir. Skip the simit and the soslu kızartma", kcal: 200, protein: 10 },
        MULTIVITAMIN,
        { time: "Lunch", what: "Tavuk fajita/lavaş (300) + yoğurt (122) + salad, no oil (40)", kcal: 462, protein: 30 },
        { time: "16:00", what: "Yoğurt + fruit from the snack table", kcal: 168, protein: 8 },
        { time: "18:30 dinner", what: "Karışık pide (436) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 638, protein: 28 },
        shake("kaşarlı sandviç and ayran"),
      ],
      total: { kcal: 1803, protein: 116 },
    },
    "2026-11-08": {
      kind: "rest",
      home: true,
      meals: [
        { time: "Breakfast", what: "2 boiled eggs, yolks only, + 2 slices of beyaz peynir. Skip the poğaça and the patates kızartma", kcal: 290, protein: 15 },
        MULTIVITAMIN,
        { time: "Lunch", what: "Mantarlı et sote (169) + yoğurt (122) + salad, no oil (40)", kcal: 331, protein: 26 },
        { time: "16:00", what: "The süt; skip the kurabiye", kcal: 122, protein: 6 },
        { time: "18:30 dinner", what: "Düğün çorba (209) + Kıymalı yeşil merc. (299) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 710, protein: 32 },
        shake("börek and komposto"),
      ],
      total: { kcal: 1788, protein: 120 },
    },
    // Week 2
    "2026-11-09": {
      kind: "gym",
      meals: [
        grabEggs(1, "simit and the sucuklu yumurta"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the kefir. Keep the fruit for 16:00", kcal: 320, protein: 17 },
        { time: "Lunch", what: "Kadınbudu köf/püre (472) + ½ soslu spagetti (105) + yoğurt (122) + salad, no oil (40)", kcal: 739, protein: 33 },
        PRE_GYM_FRUIT("çikolatalı milföy"),
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Mantarlı piliç sote (385) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 587, protein: 36 },
        shake("çorba"),
      ],
      total: { kcal: 2027, protein: 127 },
    },
    "2026-11-10": {
      kind: "rest",
      meals: [
        grabEggs(2, "poğaça and the patates kızartma"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the süt + fruit", kcal: 458, protein: 22 },
        { time: "Lunch", what: "Kıymalı taze fasulye (322) + yoğurt (122) + salad, no oil (40)", kcal: 484, protein: 18 },
        { time: "16:00", what: "Skip the ağlayan kek", kcal: null, protein: null },
        { time: "18:30 dinner", what: "Çoban kavurma (350) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 552, protein: 34 },
        shake("çiğ köfte and ayran"),
      ],
      total: { kcal: 1829, protein: 114 },
    },
    "2026-11-11": {
      kind: "gym",
      meals: [
        grabEggs(1, "simit and the su böreği"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the yoğurt. Keep the fruit for 16:00", kcal: 322, protein: 17 },
        { time: "Lunch", what: "Mercimek çorba (204) + Izgara balık (380) + ½ meyhane pilavı (105) + salad, no oil (40). The menu lists no yogurt at this lunch", kcal: 729, protein: 42 },
        PRE_GYM_FRUIT("bisküvi pasta"),
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Etli türlü (348) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 550, protein: 24 },
        shake("tuzlu kurabiye"),
      ],
      total: { kcal: 1982, protein: 123 },
    },
    "2026-11-12": {
      kind: "rest",
      meals: [
        grabEggs(1, "poğaça and the kaşarlı patates"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the süt + fruit", kcal: 368, protein: 17 },
        { time: "Lunch", what: "Hindi ızgara (380) + yoğurt (122) + salad, no oil (40)", kcal: 542, protein: 40 },
        { time: "16:00", what: "Skip the cheesecake", kcal: null, protein: null },
        { time: "18:30 dinner", what: "Çıt. tavuk/elma d.pat (360) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 562, protein: 30 },
        shake("çorba"),
      ],
      total: { kcal: 1807, protein: 128 },
    },
    "2026-11-13": {
      kind: "gym",
      note: "The last school day before the break.",
      meals: [
        grabEggs(1, "simit and the rulo börek"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the yoğurt (skip the granola)", kcal: 322, protein: 17 },
        { time: "Lunch", what: "Güveç etli kuru fasulye (396) + pirinç pilavı (259) + cacık (100) + salad, no oil (40)", kcal: 795, protein: 22 },
        { time: "16:00", what: "Skip the kuruyemiş", kcal: null, protein: null },
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "İzmir köfte (344) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 546, protein: 28 },
        shake("tost and ayran"),
      ],
      total: { kcal: 1998, protein: 108 },
    },
    // Mid-term break
    "2026-11-14": breakDay("rest"),
    "2026-11-15": breakDay("rest"),
    "2026-11-16": breakDay("gym"),
    "2026-11-17": breakDay("rest"),
    "2026-11-18": breakDay("gym"),
    "2026-11-19": breakDay("rest"),
    "2026-11-20": breakDay("gym"),
    "2026-11-21": breakDay("rest"),
    // Week 3
    "2026-11-22": {
      kind: "rest",
      note: "The day you come back.",
      home: true,
      meals: [
        { time: "Breakfast", what: "2 boiled egg yolks + 1 slice of beyaz peynir (at home or on the way back)", kcal: 200, protein: 10 },
        MULTIVITAMIN,
        { time: "Lunch", what: "Mercimek çorba (209) + Piliç ızgara/pat.kız. (275) + yoğurt (122) + salad, no oil (40)", kcal: 646, protein: 44 },
        { time: "16:00", what: "The süt; skip the kurabiye", kcal: 122, protein: 6 },
        { time: "18:30 dinner", what: "Nohut (~280, no kcal on the menu) + yoğurt (120) + salad, 1 tsp oil (80)", kcal: 480, protein: 20 },
        shake("börek and komposto"),
      ],
      total: { kcal: 1783, protein: 121 },
    },
    "2026-11-23": {
      kind: "gym",
      meals: [
        grabEggs(1, "poğaça and the sucuklu yumurta"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the kefir. Keep the fruit for 16:00", kcal: 320, protein: 17 },
        { time: "Lunch", what: "Arnavut ciğer (370) + bulgur pilavı (210) + yoğurt (122) + salad, no oil (40)", kcal: 742, protein: 38 },
        PRE_GYM_FRUIT("çikolatalı milföy"),
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Yayla çorba (105) + Mevsim türlü (247) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 554, protein: 18 },
        shake("çorba"),
      ],
      total: { kcal: 1997, protein: 114 },
    },
    "2026-11-24": {
      kind: "rest",
      meals: [
        grabEggs(1, "simit and the patates kızartma"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the süt + fruit", kcal: 368, protein: 17 },
        { time: "Lunch", what: "Kar.ızg.tavuk&köfte&sucuk (355) + ½ pirinç pilavı (130) + yoğurt (122) + salad, no oil (40)", kcal: 647, protein: 36 },
        { time: "16:00", what: "Skip the ağlayan kek", kcal: null, protein: null },
        { time: "18:30 dinner", what: "Kıymalı karnabahar (240) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 442, protein: 18 },
        shake("çiğ köfte and ayran"),
      ],
      total: { kcal: 1792, protein: 111 },
    },
    "2026-11-25": {
      kind: "gym",
      meals: [
        grabEggs(2, "poğaça and the kaşarlı patates"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the yoğurt. Keep the fruit for 16:00", kcal: 412, protein: 22 },
        { time: "Lunch", what: "Etli nohut (386) + ½ pirinç pilavı (130) + cacık (122) + salad, no oil (40)", kcal: 678, protein: 23 },
        PRE_GYM_FRUIT("bisküvi pasta"),
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Fırın tavuk (358) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 560, protein: 36 },
        shake("tuzlu kurabiye"),
      ],
      total: { kcal: 2031, protein: 122 },
    },
    "2026-11-26": {
      kind: "rest",
      note: "No yogurt at dinner so the day fits. The lowest-protein day (~99 g), so don't skip the shake.",
      meals: [
        grabEggs(1, "simit and the pişi"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the süt + fruit", kcal: 368, protein: 17 },
        { time: "Lunch", what: "Samanyolu köfte (477) + yoğurt (122) + salad, no oil (40)", kcal: 639, protein: 28 },
        { time: "16:00", what: "Skip the cheesecake", kcal: null, protein: null },
        { time: "18:30 dinner", what: "Kıymalı patates (383) + salad, 1 tsp oil (80). Skip the yogurt today", kcal: 463, protein: 14 },
        shake("çorba"),
      ],
      total: { kcal: 1805, protein: 99 },
    },
    "2026-11-27": {
      kind: "gym",
      meals: [
        grabEggs(2, "poğaça and the rulo börek"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the yoğurt (skip the granola)", kcal: 412, protein: 22 },
        { time: "Lunch", what: "Lebeniye çorba (204) + Tavuk döner (380) + ½ noh. pirinç pilavı (130) + yoğurt (122) + salad, no oil (40)", kcal: 876, protein: 44 },
        { time: "16:00", what: "Skip the kuruyemiş", kcal: null, protein: null },
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Mantı (171) + yoğurt (122) + salad, 1 tsp oil (80). Skip the zy ıspanak", kcal: 373, protein: 16 },
        shake("tost and ayran"),
      ],
      total: { kcal: 1996, protein: 122 },
    },
    "2026-11-28": {
      kind: "rest",
      home: true,
      meals: [
        { time: "Breakfast", what: "2 boiled eggs, yolks only, + 2 slices of beyaz peynir. Skip the simit and the omlet", kcal: 290, protein: 15 },
        MULTIVITAMIN,
        { time: "Lunch", what: "Orman kebabı (288) + yoğurt (122) + salad, no oil (40)", kcal: 450, protein: 30 },
        { time: "16:00", what: "Yoğurt + fruit from the snack table", kcal: 168, protein: 8 },
        { time: "18:30 dinner", what: "Makarna günü (380) + ayran (75) + salad, 1 tsp oil (80)", kcal: 535, protein: 18 },
        shake("kaşarlı sandviç and ayran"),
      ],
      total: { kcal: 1778, protein: 110 },
    },
    "2026-11-29": {
      kind: "rest",
      home: true,
      meals: [
        { time: "Breakfast", what: "2 boiled eggs, yolks only, + 2 slices of beyaz peynir. Skip the poğaça and the menemen", kcal: 290, protein: 15 },
        MULTIVITAMIN,
        { time: "Lunch", what: "Etli kuru fasulye (350) + yoğurt (122) + salad, no oil (40)", kcal: 512, protein: 20 },
        { time: "16:00", what: "The süt; skip the kurabiye", kcal: 122, protein: 6 },
        { time: "18:30 dinner", what: "Arn. tavuk/pat.kız (380) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 582, protein: 34 },
        shake("börek and komposto"),
      ],
      total: { kcal: 1841, protein: 115 },
    },
    "2026-11-30": {
      kind: "gym",
      meals: [
        grabEggs(1, "simit and the boyoz"),
        { time: "11:00", what: "Multivitamin + 2 egg yolks + the cheese, with the kefir. Keep the fruit for 16:00", kcal: 320, protein: 17 },
        { time: "Lunch", what: "Toyga çorba (201) + Hamburger köfte (356) + ½ şehr.pirinç pilavı (130) + yoğurt (122) + salad, no oil (40)", kcal: 849, protein: 41 },
        PRE_GYM_FRUIT("çikolatalı milföy"),
        CREATINE,
        GYM,
        { time: "18:30 dinner", what: "Etli kuru fasulye (247) + yoğurt (122) + salad, 1 tsp oil (80)", kcal: 449, protein: 20 },
        shake("çorba"),
      ],
      total: { kcal: 1999, protein: 119 },
    },
  },
  home: {
    intro: "Keep the breakfast, the multivitamin, the shake and 1,800 kcal. Home portions are harder to count, so these numbers are estimates; when unsure, take the smaller portion. This is the rest-day version; see the first tip below for gym days.",
    meals: HOME_MEALS,
    total: { kcal: 1810, protein: 155 },
    tips: [
      { lead: "Gym days at home (about 2,000 kcal):", text: "add a fist of rice, bulgur or pasta (~100 g cooked, ~150 kcal) at dinner and a piece of fruit (~70 kcal) before training." },
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
    { lead: "More protein (optional):", text: "make the shake 1½ scoops (48 g of whey): +62 kcal and +12 g of protein a day. The day totals don't include this." },
  ],
};
