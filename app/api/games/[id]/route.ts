import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const updateGameSchema = z.object({
  title: z.string().min(1).optional(),
  developer: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  status: z
    .enum(["PLAYING", "COMPLETED", "PLAN_TO_PLAY", "DROPPED", "PLATINUM"])
    .optional(),
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
    .optional(),
  emulated: z.boolean().optional(),
  hoursPlayed: z.number().optional(),
  achievementsUnlocked: z.number().int().optional(),
  achievementsTotal: z.number().int().optional().nullable(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  rating: z.number().min(1).max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const game = await db.game.findUnique({ where: { id } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  return NextResponse.json(game);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const game = await db.game.findUnique({ where: { id } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateGameSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const updated = await db.game.update({
    where: { id },
    data: result.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const game = await db.game.findUnique({ where: { id } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  await db.game.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
