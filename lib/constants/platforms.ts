export const PLATFORM_LABELS: Record<string, string> = {
  PC: "PC", MAC: "Mac", STEAM_DECK: "Steam Deck",
  PS5: "PS5", PS4: "PS4", PS3: "PS3", PS2: "PS2", PS1: "PS1", PSP: "PSP", PS_VITA: "PS Vita",
  XBOX_SERIES_X: "Xbox Series X", XBOX_SERIES_S: "Xbox Series S",
  XBOX_ONE_X: "Xbox One X", XBOX_ONE_S: "Xbox One S", XBOX_ONE: "Xbox One",
  XBOX_360: "Xbox 360", XBOX: "Xbox",
  SWITCH_2: "Switch 2", SWITCH: "Switch", SWITCH_OLED: "Switch OLED", SWITCH_LITE: "Switch Lite",
  WII_U: "Wii U", WII: "Wii", GAMECUBE: "GameCube", N64: "N64", SNES: "SNES", NES: "NES",
  NINTENDO_3DS: "3DS", DS: "DS", GBA: "Game Boy Advance", GBC: "Game Boy Color", GAMEBOY: "Game Boy",
  SEGA_DREAMCAST: "Dreamcast", SEGA_SATURN: "Saturn", SEGA_GENESIS: "Sega Genesis", GAME_GEAR: "Game Gear",
  IOS: "iOS", ANDROID: "Android", OTHER: "Other",
};

export const PLATFORM_GROUPS = [
  { label: "PC & Digital", options: ["PC", "MAC", "STEAM_DECK"] },
  { label: "PlayStation", options: ["PS5", "PS4", "PS3", "PS2", "PS1", "PSP", "PS_VITA"] },
  { label: "Xbox", options: ["XBOX_SERIES_X", "XBOX_SERIES_S", "XBOX_ONE_X", "XBOX_ONE_S", "XBOX_ONE", "XBOX_360", "XBOX"] },
  { label: "Nintendo", options: ["SWITCH_2", "SWITCH", "SWITCH_OLED", "SWITCH_LITE", "WII_U", "WII", "GAMECUBE", "N64", "SNES", "NES", "NINTENDO_3DS", "DS", "GBA", "GBC", "GAMEBOY"] },
  { label: "Sega", options: ["SEGA_DREAMCAST", "SEGA_SATURN", "SEGA_GENESIS", "GAME_GEAR"] },
  { label: "Mobile", options: ["IOS", "ANDROID"] },
  { label: "Other", options: ["OTHER"] },
];
