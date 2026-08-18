// Enum value tuples mirroring prisma/schema.prisma.
//
// These exist so Zod schemas, searchParams validation and UI dropdowns all read from one
// place. The 12-value Language list used to be copy-pasted into 12 API route files; adding a
// language meant editing all of them, and missing one produced a runtime 400 on a valid value
// with no compile error.
//
// `as const` keeps the literal union, which is what z.enum() needs.

export const BOOK_STATUS_VALUES = ["READ", "READING", "WANT_TO_READ", "DNF"] as const;
export const ANIME_STATUS_VALUES = ["WATCHING", "COMPLETED", "PLAN_TO_WATCH", "DROPPED", "ON_HOLD"] as const;
export const ANIME_SEASON_VALUES = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
export const MOVIE_STATUS_VALUES = ["WATCHED", "WANT_TO_WATCH", "DROPPED"] as const;
export const TV_STATUS_VALUES = ["WATCHING", "COMPLETED", "PLAN_TO_WATCH", "DROPPED", "ON_HOLD"] as const;
export const GAME_STATUS_VALUES = ["PLAYING", "COMPLETED", "PLAN_TO_PLAY", "DROPPED", "PLATINUM"] as const;
export const GAME_PLATFORM_VALUES = ["PC", "MAC", "STEAM_DECK", "PS5", "PS4", "PS3", "PS2", "PS1", "PSP", "PS_VITA", "XBOX_SERIES_X", "XBOX_SERIES_S", "XBOX_ONE_X", "XBOX_ONE_S", "XBOX_ONE", "XBOX_360", "XBOX", "SWITCH_2", "SWITCH", "SWITCH_OLED", "SWITCH_LITE", "WII_U", "WII", "GAMECUBE", "N64", "SNES", "NES", "NINTENDO_3DS", "DS", "GBA", "GBC", "GAMEBOY", "SEGA_DREAMCAST", "SEGA_SATURN", "SEGA_GENESIS", "GAME_GEAR", "IOS", "ANDROID", "OTHER"] as const;
export const MANGA_FORMAT_VALUES = ["MANGA", "MANHWA", "MANHUA"] as const;
export const MANGA_STATUS_VALUES = ["READING", "COMPLETED", "PLAN_TO_READ", "DROPPED", "ON_HOLD"] as const;
export const ARTICLE_STATUS_VALUES = ["READ", "WANT_TO_READ"] as const;
export const GARMENT_TYPE_VALUES = ["TOPS", "BOTTOMS", "OUTERWEAR", "UNDERWEAR", "SOCKS", "ACTIVEWEAR", "FORMALWEAR", "ACCESSORIES", "OTHER"] as const;
export const COLOR_GROUP_VALUES = ["WHITE", "LIGHT", "DARK", "VIVID", "MIXED"] as const;
export const WASH_METHOD_VALUES = ["MACHINE", "HAND", "DRY_CLEAN", "DO_NOT_WASH"] as const;
export const WASH_TEMP_VALUES = ["COLD", "W30", "W40", "W60", "W90"] as const;
export const WASH_CYCLE_VALUES = ["NORMAL", "GENTLE"] as const;
export const SPIN_LEVEL_VALUES = ["NORMAL", "REDUCED", "NONE"] as const;
export const DRY_METHOD_VALUES = ["TUMBLE_HIGH", "TUMBLE_MEDIUM", "TUMBLE_LOW", "AIR_LINE", "AIR_FLAT", "AIR_DRIP", "DRY_CLEAN", "DO_NOT_DRY"] as const;
export const EXPENSE_CATEGORY_VALUES = ["FOOD", "BOOKS", "EDUCATION", "ENTERTAINMENT", "CLOTHING", "SUBSCRIPTIONS", "SELF_CARE", "TRANSPORTATION", "OTHER", "CASH"] as const;
