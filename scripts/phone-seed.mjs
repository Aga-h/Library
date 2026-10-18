// Seeds the local `lib_phone` database with one of each kind of page the phone audit visits.
// IDs are fixed so the audit can hit detail URLs without querying first.
import "dotenv/config";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth() + 1;

async function main() {
  if (await db.book.count()) {
    console.log("already seeded");
    return;
  }

  await db.bookUniverse.create({ data: { id: "bu1", name: "A very long universe name that should wrap on a narrow phone" } });
  await db.bookSeries.create({ data: { id: "bs1", name: "A series whose name also wraps", universeId: "bu1" } });
  await db.book.create({
    data: {
      id: "b1",
      title: "The Longest Book Title In The Library For Overflow Testing",
      author: "Someone With A Extremely Long Name-Hyphenated",
      pages: 412,
      pagesRead: 40,
      seriesId: "bs1",
    },
  });

  await db.animeUniverse.create({ data: { id: "au1", name: "Attack on Titan world" } });
  await db.animeSeries.create({ data: { id: "as1", name: "Attack on Titan", universeId: "au1" } });
  await db.anime.create({
    data: {
      id: "a1",
      title: "Attack on Titan | Season 1",
      episodes: 25,
      episodesWatched: 12,
      seasonNumber: 1,
      seriesId: "as1",
      year: 2013,
    },
  });

  await db.movieUniverse.create({ data: { id: "mu1", name: "MCU" } });
  await db.movie.create({
    data: { id: "m1", title: "Iron Man", runtime: 126, year: 2008, universeId: "mu1" },
  });

  await db.tvUniverse.create({ data: { id: "tu1", name: "The Office franchise" } });
  await db.tvSeries.create({ data: { id: "ts1", name: "The Office", universeId: "tu1" } });
  await db.tvShow.create({
    data: {
      id: "t1",
      title: "The Office | Season 1",
      totalEpisodes: 6,
      episodesWatched: 3,
      seasonNumber: 1,
      seriesId: "ts1",
      year: 2005,
    },
  });

  await db.game.create({ data: { id: "g1", title: "Hades", hoursPlayed: 40 } });
  await db.manga.create({
    data: { id: "mg1", title: "Berserk", author: "Kentaro Miura", totalChapters: 364, chaptersRead: 12 },
  });

  await db.comicPublisher.create({ data: { id: "cp1", name: "Marvel" } });
  await db.comicUniverse.create({ data: { id: "cu1", name: "Earth-616", publisherId: "cp1" } });
  await db.comicTitle.create({ data: { id: "ct1", name: "Amazing Spider-Man (1963)", universeId: "cu1" } });
  await db.comicIssue.create({ data: { id: "ci1", titleId: "ct1", issueNumber: 1, name: "Spider-Man!" } });

  await db.article.create({
    data: { id: "ar1", title: "A longform article with a wrapping headline", wordCount: 4000 },
  });

  await db.garment.create({
    data: { id: "w1", name: "Navy merino jumper", materials: "100% merino wool", wornCount: 4 },
  });

  await db.shop.create({
    data: {
      id: "sh1",
      name: "Zara",
      url: "https://www.zara.com/",
      category: "Clothing",
      liked: "cuts",
      disliked: "quality drops after a wash",
    },
  });
  await db.shopProduct.create({
    data: { id: "sp1", shopId: "sh1", name: "Wool overcoat", comment: "warm, sleeves a bit short" },
  });

  await db.financeConfig.create({ data: { id: "global", monthlyBudget: 50000 } });
  await db.expense.create({
    data: {
      year,
      month,
      category: "FOOD",
      amount: 247.5,
      description: "A very long grocery description that used to make the month page scroll sideways",
    },
  });
  await db.additionalIncome.create({ data: { year, month, amount: 1500, description: "side work" } });
  await db.subscription.create({ data: { name: "Spotify", amount: 59.99, startYear: year, startMonth: 1 } });
  await db.installment.create({
    data: { name: "Laptop", total: 36000, count: 12, startYear: year, startMonth: month },
  });

  await db.module.create({
    data: { id: "mod1", title: "SAT vocabulary", stats: ["INTELLIGENCE", "WISDOM"], weeklyGoalMinutes: 180 },
  });
  await db.studyConfig.create({ data: { id: "global", weeklyGoalMinutes: 600 } });

  const word = await db.vocabWord.create({
    data: {
      id: "vw1",
      word: "abate",
      meanings: { create: [{ id: "vm1", text: "to become less intense", position: 1 }] },
    },
  });
  await db.vocabWord.create({
    data: {
      word: "benevolent",
      meanings: { create: [{ text: "well meaning and kindly", position: 1 }] },
    },
  });
  await db.vocabWord.create({
    data: {
      word: "candid",
      meanings: { create: [{ text: "truthful and straightforward", position: 1 }] },
    },
  });
  await db.vocabWord.create({
    data: {
      word: "diligent",
      meanings: { create: [{ text: "having or showing care in one's work", position: 1 }] },
    },
  });
  await db.vocabCard.create({ data: { wordId: word.id, newOrder: 1 } });

  await db.apCourse.create({
    data: {
      id: "ap1",
      name: "AP Statistics",
      shortName: "Stats",
      position: 1,
      units: { create: [{ number: 1, title: "Exploring One-Variable Data", weighting: "15-23%" }] },
    },
  });

  console.log("seeded", { year, month });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
