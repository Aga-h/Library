import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const createGameSchema = z.object({
  title: z.string().min(1, "Title is required"),
  developer: z.string().optional(),
  publisher: z.string().optional(),
  status: z
    .enum(["PLAYING", "COMPLETED", "PLAN_TO_PLAY", "DROPPED", "PLATINUM"])
    .default("PLAN_TO_PLAY"),
  platform: z
    .enum([
      "PC", "MAC", "STEAM_DECK",
      "PS5", "PS4", "PS3", "PS2", "PS1", "PSP", "PS_VITA",
      "XBOX_SERIES_X", "XBOX_SERIES_S", "XBOX_ONE_X", "XBOX_ONE_S", "XBOX_ONE", "XBOX_360", "XBOX",
      "SWITCH_2", "SWITCH", "SWITCH_OLED", "SWITCH_LITE",
      "WII_U", "WII", "GAMECUBE", "N64", "SNES", "NES",
      "NINTENDO_3DS", "DS", "GBA", "GBC", "GAMEBOY",
      "SEGA_DREAMCAST", "SEGA_SATURN", "SEGA_GENESIS", "GAME_GEAR",
      "IOS", "ANDROID", "OTHER",
    ])
    .default("PC"),
  emulated: z.boolean().default(false),
  hoursPlayed: z.number().default(0),
  achievementsUnlocked: z.number().int().default(0),
  achievementsTotal: z.number().int().optional(),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (platform) where.platform = platform;

  const games = await db.game.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(games);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = createGameSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const game = await db.game.create({
    data: {
      title: data.title,
      developer: data.developer ?? null,
      publisher: data.publisher ?? null,
      status: data.status,
      platform: data.platform,
      emulated: data.emulated,
      hoursPlayed: data.hoursPlayed,
      achievementsUnlocked: data.achievementsUnlocked,
      achievementsTotal: data.achievementsTotal ?? null,
      coverImage: data.coverImage || null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json(game, { status: 201 });
}
