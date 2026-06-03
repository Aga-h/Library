# MyPortal — Complete Codebase Reference

Personal media-tracking + wardrobe management portal. Deployed on Vercel, backed by Supabase PostgreSQL, with cover images hosted in Supabase Storage.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Authentication](#2-authentication)
3. [Database Schema](#3-database-schema)
4. [API Routes](#4-api-routes)
5. [Pages & Layouts](#5-pages--layouts)
6. [Components](#6-components)
7. [Library Utilities](#7-library-utilities-lib)
8. [Key Design Patterns](#8-key-design-patterns)
9. [Environment Variables](#9-environment-variables)
10. [Complete File Listing](#10-complete-file-listing)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.3 (App Router) |
| UI | React 19, TypeScript 5, Tailwind CSS v4 |
| Database | Supabase PostgreSQL via Prisma 7.7.0 + `@prisma/adapter-pg` |
| Validation | Zod 4.3.6 (all API routes) |
| Icons | Lucide React 1.8.0 |
| Image storage | Supabase Storage (REST API, no npm package) |
| Hosting | Vercel |

---

## 2. Authentication

### `middleware.ts`

Runs on every request. Guards all routes except `/login` and `/api/auth`.

- Reads the `session` cookie
- Compares its value against the `AUTH_SECRET` environment variable
- Unauthenticated requests are redirected to `/login?from=[original-path]`
- Next.js internal paths (`/_next`, `favicon.ico`) always pass through

### `POST /api/auth`

Login endpoint. Accepts `{ password: string }`. Validates against `AUTH_PASSWORD` env var. On success sets an HttpOnly `session` cookie with `AUTH_SECRET` as the value. Returns `{ ok: true }`.

### `DELETE /api/auth`

Logout. Clears the `session` cookie. Returns `{ ok: true }`.

---

## 3. Database Schema

All models are defined in `prisma/schema.prisma` and use PostgreSQL. Every model has `createdAt` and `updatedAt` timestamps (automatic).

### Enums

#### `Language`
`ENGLISH` | `SPANISH` | `FRENCH` | `GERMAN` | `ITALIAN` | `PORTUGUESE` | `TURKISH` | `ARABIC` | `RUSSIAN` | `JAPANESE` | `CHINESE` | `KOREAN`

#### `BookStatus`
`READ` | `READING` | `WANT_TO_READ` | `DNF`

#### `AnimeStatus`
`WATCHING` | `COMPLETED` | `PLAN_TO_WATCH` | `DROPPED` | `ON_HOLD`

#### `AnimeSeason`
`WINTER` | `SPRING` | `SUMMER` | `FALL`

#### `MovieStatus`
`WATCHED` | `WANT_TO_WATCH` | `DROPPED`

#### `TvStatus`
`WATCHING` | `COMPLETED` | `PLAN_TO_WATCH` | `DROPPED` | `ON_HOLD`

#### `GameStatus`
`PLAYING` | `COMPLETED` | `PLAN_TO_PLAY` | `DROPPED` | `PLATINUM`

#### `GamePlatform` (44 values)
`PC` | `MAC` | `STEAM_DECK` | `PS1`–`PS5` | `PS_VITA` | `PSP` | `XBOX` | `XBOX_360` | `XBOX_ONE` | `XBOX_SERIES` | `SWITCH` | `SWITCH_2` | `WII` | `WII_U` | `GAMECUBE` | `N64` | `SNES` | `NES` | `3DS` | `DS` | `GBA` | `GBC` | `GAMEBOY` | `SEGA_SATURN` | `SEGA_DREAMCAST` | `SEGA_GENESIS` | `SEGA_GAME_GEAR` | `IOS` | `ANDROID` | `OTHER`

#### `MangaStatus`
`READING` | `COMPLETED` | `PLAN_TO_READ` | `DROPPED` | `ON_HOLD`

#### `MangaFormat`
`MANGA` | `MANHWA` | `MANHUA`

#### `ComicStatus`
`READING` | `COMPLETED` | `PLAN_TO_READ` | `DROPPED`

#### `ArticleStatus`
`READ` | `WANT_TO_READ`

#### `GarmentType`
`TOPS` | `BOTTOMS` | `OUTERWEAR` | `UNDERWEAR` | `SOCKS` | `ACTIVEWEAR` | `FORMALWEAR` | `ACCESSORIES` | `OTHER`

#### `ColorGroup`
`WHITE` | `LIGHT` | `DARK` | `VIVID` | `MIXED`

#### `WashMethod`
`MACHINE` | `HAND` | `DRY_CLEAN` | `DO_NOT_WASH`

#### `MaxTemp`
`COLD` | `W30` | `W40` | `W60` | `W90`

#### `WashCycle`
`NORMAL` | `GENTLE`

#### `SpinLevel`
`NORMAL` | `REDUCED` | `NONE`

#### `DryMethod`
`TUMBLE_HIGH` | `TUMBLE_MEDIUM` | `TUMBLE_LOW` | `AIR_LINE` | `AIR_FLAT` | `AIR_DRIP` | `DRY_CLEAN` | `DO_NOT_DRY`

---

### Models

#### `Book`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `title` | String | Required |
| `author` | String | Required |
| `status` | BookStatus | Default: `WANT_TO_READ` |
| `owned` | Boolean | Default: false |
| `language` | Language | Default: `ENGLISH` |
| `publisher` | String? | Optional |
| `pages` | Int | Required |
| `coverImage` | String? | URL |
| `rating` | Float? | 1–10 |
| `notes` | String? | |
| `timesReread` | Int | Default: 0 |

#### `Anime`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `title` | String | Required |
| `studio` | String? | |
| `status` | AnimeStatus | Default: `PLAN_TO_WATCH` |
| `episodes` | Int? | Total episodes |
| `episodesWatched` | Int | Default: 0 |
| `episodeDuration` | Int | Default: 24 (minutes) |
| `season` | AnimeSeason? | |
| `year` | Int? | |
| `language` | Language | Default: `JAPANESE` |
| `coverImage` | String? | |
| `rating` | Float? | |
| `notes` | String? | |
| `timesRewatched` | Int | Default: 0 |
| `seriesName` | String? | Groups anime into multi-season series |

#### `Movie`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `title` | String | Required |
| `director` | String? | |
| `studio` | String? | |
| `status` | MovieStatus | Default: `WANT_TO_WATCH` |
| `runtime` | Int | Minutes, required |
| `year` | Int? | |
| `language` | Language | Default: `ENGLISH` |
| `coverImage` | String? | |
| `rating` | Float? | |
| `notes` | String? | |
| `timesRewatched` | Int | Default: 0 |

#### `TvShow`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `title` | String | Required |
| `creator` | String? | |
| `network` | String? | |
| `status` | TvStatus | Default: `PLAN_TO_WATCH` |
| `totalEpisodes` | Int? | |
| `episodesWatched` | Int | Default: 0 |
| `episodeRuntime` | Int | Default: 45 (minutes) |
| `year` | Int? | |
| `language` | Language | Default: `ENGLISH` |
| `coverImage` | String? | |
| `rating` | Float? | |
| `notes` | String? | |
| `timesRewatched` | Int | Default: 0 |
| `seriesName` | String? | Groups seasons into a series |

#### `Game`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `title` | String | Required |
| `developer` | String? | |
| `publisher` | String? | |
| `status` | GameStatus | Default: `PLAN_TO_PLAY` |
| `platform` | GamePlatform | Default: `PC` |
| `emulated` | Boolean | Default: false |
| `hoursPlayed` | Float | Default: 0 |
| `achievementsUnlocked` | Int | Default: 0 |
| `achievementsTotal` | Int? | |
| `coverImage` | String? | |
| `rating` | Float? | |
| `notes` | String? | |
| `steamAppId` | Int? | Unique; links to Steam game |

#### `Manga`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `title` | String | Required |
| `author` | String | Required |
| `artist` | String? | |
| `publisher` | String? | |
| `status` | MangaStatus | Default: `PLAN_TO_READ` |
| `format` | MangaFormat | Default: `MANGA` |
| `totalVolumes` | Int? | |
| `volumesRead` | Int | Default: 0 |
| `totalChapters` | Int? | |
| `chaptersRead` | Int | Default: 0 |
| `language` | Language | Default: `JAPANESE` |
| `coverImage` | String? | |
| `rating` | Float? | |
| `notes` | String? | |
| `timesReread` | Int | Default: 0 |

#### `Comic`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `title` | String | Required |
| `author` | String? | |
| `artist` | String? | |
| `publisher` | String? | |
| `universe` | String? | e.g. "Marvel", "DC" |
| `status` | ComicStatus | Default: `PLAN_TO_READ` |
| `totalIssues` | Int? | |
| `issuesRead` | Int | Default: 0 |
| `language` | Language | Default: `ENGLISH` |
| `coverImage` | String? | |
| `rating` | Float? | |
| `notes` | String? | |
| `timesReread` | Int | Default: 0 |

#### `Article`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `title` | String | Required |
| `author` | String? | |
| `publication` | String? | |
| `url` | String? | External link |
| `status` | ArticleStatus | Default: `WANT_TO_READ` |
| `wordCount` | Int | Required |
| `language` | Language | Default: `ENGLISH` |
| `coverImage` | String? | |
| `rating` | Float? | |
| `notes` | String? | |
| `timesReread` | Int | Default: 0 |

#### `Garment`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `name` | String | Required |
| `type` | GarmentType | Default: `OTHER` |
| `brand` | String? | |
| `color` | String? | Free text |
| `colorGroup` | ColorGroup | Default: `MIXED`; used for wash grouping |
| `materials` | String | Required; free text e.g. "80% cotton, 20% polyester" |
| `washMethod` | WashMethod | Default: `MACHINE` |
| `maxTemp` | MaxTemp | Default: `W40` |
| `washCycle` | WashCycle | Default: `NORMAL` |
| `spinLevel` | SpinLevel | Default: `NORMAL` |
| `dryMethod` | DryMethod | Default: `TUMBLE_LOW` |
| `wornCount` | Int | Default: 0; incremented on wear, reset on wash |
| `lastWashed` | DateTime? | Set when marked as washed |
| `image` | String? | |
| `notes` | String? | |

#### `AnimeSeries`
Lookup table for unique series names used to group multi-season anime.

| Field | Type |
|---|---|
| `id` | String (cuid) |
| `name` | String (unique) |
| `createdAt` | DateTime |

#### `TvSeries`
Lookup table for unique series names used to group TV show seasons.

| Field | Type |
|---|---|
| `id` | String (cuid) |
| `name` | String (unique) |
| `createdAt` | DateTime |

---

## 4. API Routes

All routes return JSON. POST/PATCH bodies are validated with Zod — invalid input returns `{ error: string }` with status 400. Successful deletes return `{ ok: true }`.

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth` | Login — validates password, sets session cookie |
| DELETE | `/api/auth` | Logout — clears session cookie |

### Books

| Method | Path | Description |
|---|---|---|
| GET | `/api/books` | List all books (sorted by `createdAt` desc) |
| POST | `/api/books` | Create book. Required: `title`, `author`, `pages`. Optional: `status`, `owned`, `language`, `publisher`, `coverImage` (URL), `rating` (1–10), `notes`, `timesReread` |
| GET | `/api/books/[id]` | Get single book |
| PATCH | `/api/books/[id]` | Partial update — all fields optional |
| DELETE | `/api/books/[id]` | Delete book |

### Anime

| Method | Path | Description |
|---|---|---|
| GET | `/api/anime` | List all anime |
| POST | `/api/anime` | Create anime. Required: `title`. Optional: `studio`, `status`, `episodes`, `episodesWatched`, `episodeDuration`, `season`, `year`, `language`, `coverImage`, `rating`, `notes`, `timesRewatched`, `seriesName` |
| GET | `/api/anime/[id]` | Get single anime |
| PATCH | `/api/anime/[id]` | Partial update |
| DELETE | `/api/anime/[id]` | Delete |
| GET | `/api/anime-series` | List all anime series names (sorted A–Z) |
| POST | `/api/anime-series` | Create series. Required: `name`. Returns 409 if name already exists |

### Movies

| Method | Path | Description |
|---|---|---|
| GET | `/api/movies` | List all movies |
| POST | `/api/movies` | Create movie. Required: `title`, `runtime`. Optional: `director`, `studio`, `status`, `year`, `language`, `coverImage`, `rating`, `notes`, `timesRewatched` |
| GET | `/api/movies/[id]` | Get single movie |
| PATCH | `/api/movies/[id]` | Partial update |
| DELETE | `/api/movies/[id]` | Delete |

### TV Shows

| Method | Path | Description |
|---|---|---|
| GET | `/api/tv` | List all TV shows |
| POST | `/api/tv` | Create show. Required: `title`. Optional: `creator`, `network`, `status`, `totalEpisodes`, `episodesWatched`, `episodeRuntime`, `year`, `language`, `coverImage`, `rating`, `notes`, `timesRewatched`, `seriesName` |
| GET | `/api/tv/[id]` | Get single show |
| PATCH | `/api/tv/[id]` | Partial update |
| DELETE | `/api/tv/[id]` | Delete |
| GET | `/api/tv-series` | List all TV series names |
| POST | `/api/tv-series` | Create series. Returns 409 if name exists |

### Games

| Method | Path | Description |
|---|---|---|
| GET | `/api/games` | List all games |
| POST | `/api/games` | Create game. Required: `title`. Optional: `developer`, `publisher`, `status`, `platform`, `emulated`, `hoursPlayed`, `achievementsUnlocked`, `achievementsTotal`, `coverImage`, `rating`, `notes` |
| GET | `/api/games/[id]` | Get single game |
| PATCH | `/api/games/[id]` | Partial update |
| DELETE | `/api/games/[id]` | Delete |
| POST | `/api/games/steam-sync` | Steam library sync (see below) |
| POST | `/api/games/mirror-covers` | Incremental Supabase cover migration (see below) |

#### `POST /api/games/steam-sync`

Full Steam library synchronisation pipeline.

**Requires env vars:** `STEAM_API_KEY`, `STEAM_USER_ID`. Optional: `STEAMGRIDDB_API_KEY`.

**Pipeline:**
1. Fetches owned games from `IPlayerService/GetOwnedGames` (Steam API)
2. Deletes any DB games whose title matches `BLOCKED_STEAM_GAME_NAMES` (`"Dungeon Baller Playtest"`, `"FINAL FANTASY VII"`) and filters them from the sync
3. Runs three parallel batch fetches (batch size 5) for all games:
   - Achievements from `ISteamUserStats/GetPlayerAchievements`
   - Developer/publisher from Steam store API (`/api/appdetails`)
   - Cover art from SteamGridDB (600×900 static, if key present)
4. Upserts each game:
   - **Existing game:** updates `hoursPlayed`, `coverImage` (upgrades if needed), `achievementsUnlocked/Total`, `status` (→ `PLATINUM` if all achievements done while `PLAYING`), fills in missing developer/publisher
   - **New game:** creates with all fields; status = `PLATINUM` if 100%, `PLAYING` if any playtime, else `PLAN_TO_PLAY`
5. Cover selection (`pickCover`): prefers SteamGridDB URL; falls back to `cdn.cloudflare.steamstatic.com/steam/apps/{id}/library_600x900.jpg`. Upgrades any cover that isn't `https://` or still has `library_600x900` in the URL

**Returns:** `{ created, updated, sgdbEnabled, covers: { sgdb, fallback } }`

#### `POST /api/games/mirror-covers`

Incremental batch operation that uploads game covers from external URLs to Supabase Storage.

**Requires env vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Flow:**
1. Fetches all games; filters to those whose `coverImage` is not already a Supabase URL
2. Takes first 10 (batch) and concurrently downloads + uploads each to `covers/games/{steamAppId}.jpg`
3. Updates DB with new Supabase URL on success; silently skips failures
4. If all uploads in the batch fail, returns 502 with the error message

**Returns:** `{ mirrored, remaining }` — the client loops calling this until `remaining === 0`

### Manga

| Method | Path | Description |
|---|---|---|
| GET | `/api/manga` | List all manga |
| POST | `/api/manga` | Create. Required: `title`, `author`. Optional: `artist`, `publisher`, `status`, `format`, `totalVolumes`, `volumesRead`, `totalChapters`, `chaptersRead`, `language`, `coverImage`, `rating`, `notes`, `timesReread` |
| GET | `/api/manga/[id]` | Get single |
| PATCH | `/api/manga/[id]` | Partial update |
| DELETE | `/api/manga/[id]` | Delete |

### Comics

| Method | Path | Description |
|---|---|---|
| GET | `/api/comics` | List all comics |
| POST | `/api/comics` | Create. Required: `title`. Optional: `author`, `artist`, `publisher`, `universe`, `status`, `totalIssues`, `issuesRead`, `language`, `coverImage`, `rating`, `notes`, `timesReread` |
| GET | `/api/comics/[id]` | Get single |
| PATCH | `/api/comics/[id]` | Partial update |
| DELETE | `/api/comics/[id]` | Delete |

### Articles

| Method | Path | Description |
|---|---|---|
| GET | `/api/articles` | List all articles |
| POST | `/api/articles` | Create. Required: `title`, `wordCount`. Optional: `author`, `publication`, `url` (validated URL), `status`, `language`, `coverImage`, `rating`, `notes`, `timesReread` |
| GET | `/api/articles/[id]` | Get single |
| PATCH | `/api/articles/[id]` | Partial update |
| DELETE | `/api/articles/[id]` | Delete |

### Wardrobe

| Method | Path | Description |
|---|---|---|
| GET | `/api/wardrobe` | List all garments. Accepts `?type=` filter |
| POST | `/api/wardrobe` | Create. Required: `name`, `materials`. Optional: all wash/dry settings, `type`, `brand`, `color`, `colorGroup`, `image`, `notes` |
| GET | `/api/wardrobe/[id]` | Get single garment |
| PATCH | `/api/wardrobe/[id]` | Partial update |
| DELETE | `/api/wardrobe/[id]` | Delete |
| POST | `/api/wardrobe/[id]/wear` | Increment `wornCount` by 1 |
| POST | `/api/wardrobe/[id]/wash` | Set `wornCount` to 0 and `lastWashed` to now |

### File Upload

| Method | Path | Description |
|---|---|---|
| POST | `/api/upload` | Accepts `multipart/form-data` with `file` + `path`. Calls `uploadCover()`. Returns `{ url: string }` |
| DELETE | `/api/upload?path=` | Calls `deleteCover(path)`. Returns `{ ok: true }` |

---

## 5. Pages & Layouts

### Root Layout (`app/layout.tsx`)
Sets `<html>` and `<body>` with global CSS. Title: "MyPortal".

### Portal Page (`app/page.tsx`)
Entry point. Shows cards for Library and Wardrobe sections. No data fetching.

### Login Page (`app/login/page.tsx`)
Password field form. Submits to `POST /api/auth`. On success redirects to `?from=` parameter or `/library`.

---

### Library Layout (`app/library/layout.tsx`)
Two-column layout: `Sidebar` on the left + main content area. All library pages inherit this.

### Library Dashboard (`app/library/page.tsx`)
Server Component. Fetches all 8 content types in parallel and computes aggregate statistics:
- Count per status for each type
- Total time (reading + watching + gaming) in minutes
- Passes everything to `DashboardClient` for interactive grid/chart display

---

### Per-Category Pages (Books, Anime, Movies, TV, Games, Manga, Comics, Articles)

Each category follows an identical structure:

| Route | Component | Description |
|---|---|---|
| `/library/{type}` | `page.tsx` | Server Component. Fetches all rows, filters in-memory by `status`, `language`/`platform`, and `q` (search). Renders Stats + Filters + Card grid |
| `/library/{type}/new` | `new/page.tsx` | Server Component. Fetches dropdown option lists (authors, developers, etc), renders the Form in create mode |
| `/library/{type}/[id]` | `[id]/page.tsx` | Server Component. Fetches single record. Renders detail view with all fields + edit/delete buttons |
| `/library/{type}/[id]/edit` | `[id]/edit/page.tsx` | Server Component. Fetches record + option lists, renders Form in edit mode pre-filled |

**Search fields by type:**
- Books: `title`, `author`
- Anime: `title`, `studio`
- Movies: `title`, `director`, `studio`
- TV: `title`, `creator`, `network`
- Games: `title`, `developer`
- Manga: `title`, `author`
- Comics: `title`, `author`, `universe`
- Articles: `title`, `author`, `publication`

---

### Wardrobe Layout (`app/wardrobe/layout.tsx`)
Header with back button (→ `/`) + "Wardrobe" title. Gray background.

### Wardrobe List (`app/wardrobe/page.tsx`)
Server Component. Two toggle views:
- **Items** — grid of all garments, filterable by type (9 categories)
- **Wash Loads** — `WashGroupsView` groups garments by `(colorGroup, washMethod, washCycle)` tuple; shows wash urgency for each item

Wash urgency logic:
- Underwear/Socks: `wornCount > 0` → "wash now"
- Others: `wornCount >= 5` → "wash now"; `wornCount >= 3` → "wash soon"

| Route | Description |
|---|---|
| `/wardrobe` | List / wash groups |
| `/wardrobe/new` | Create garment form |
| `/wardrobe/[id]` | Detail view — shows wash recommendation from `wash-calculator.ts`, wear/wash action buttons |
| `/wardrobe/[id]/edit` | Edit garment form |

---

## 6. Components

### `components/ui/`

#### `SearchInput.tsx`
Props: `defaultValue: string`, `onSearch: (q: string) => void`, `placeholder?: string`

Controlled input with 300ms debounce on `onSearch`. State updates immediately on keypress (responsive feel); the callback fires after the user pauses. Uses `router.replace()` in the parent so keystrokes don't pollute browser history. Has a Lucide `Search` icon inset.

#### `ComboboxField.tsx`
Props: `label`, `value`, `onChange`, `options: string[]`, `placeholder?`, `required?`

Text input with a filtered dropdown. Typing narrows the option list. Clicking an option sets the value. Used for Author, Developer, Publisher, Studio fields across all forms.

#### `ImageUpload.tsx`
Props: `value: string`, `onChange: (url: string) => void`, `fieldName?: string`

Three states:
- **Empty** — dashed "Upload image" button + "Or paste a URL" text input
- **Has image** — 64×80 preview thumbnail + URL input (editable) + "Change" + "Remove" buttons
- **Uploading** — disabled state with "Uploading…" label

On file select: generates a storage path `{fieldName}/{timestamp}-{random}.{ext}`, POSTs to `/api/upload`, gets back a Supabase URL. If the old value was already a Supabase cover, calls `DELETE /api/upload?path=` to remove the orphaned object. On remove: clears field and deletes old Supabase object if applicable.

---

### `components/layout/`

#### `Sidebar.tsx`
Navigation links to all 8 library sections + dashboard. Highlights the current section based on `usePathname()`. Has a "← Portal" link back to `/`.

---

### `components/dashboard/`

#### `DashboardClient.tsx`
Props: `sections: SectionData[]`, `totalMinutes: number`

Two view modes toggled by a button:

**Grid view** — one card per media type showing status counts and total time.

**Chart view** — hand-built SVG donut chart:
- Slices sized by total item count per section
- Hover highlights the slice and shows percentage + label
- Color coded: blue=books, pink=anime, purple=movies, orange=TV, green=games, cyan=manga, yellow=comics, gray=articles
- Legend below the chart with same colors
- Center text shows total formatted time (or hovered section name)

---

### Per-media-type Components

Each media type has five standard components. Patterns are identical across all 8 types.

#### `[Type]Card.tsx`
Renders a single item in the grid. Displays: cover image (with `loading="lazy"`), title, primary metadata (author/developer/director/etc.), status badge, progress/time metrics, rating. Game covers use CSS `background-image` instead of `<img>`. Cover images served through `thumbUrl(url, 300)` — if the URL is a Supabase Storage URL, this transforms it to a 300px-wide WebP via Supabase's image transform API.

#### `[Type]Form.tsx`
Props: `initialData?`, `mode: "create" | "edit"`, plus optional option arrays for autocomplete fields.

Controlled form using `useState`. On submit: builds payload, calls `POST /api/{type}` or `PATCH /api/{type}/{id}`, redirects to detail page on success. Cover image field uses `ImageUpload` component. All forms have a `Field` wrapper component for consistent label+input layout.

Reading/watching time is previewed live as relevant fields change (pages, episodes × duration, word count).

#### `[Type]Filters.tsx`
Client Component. Reads current filters from `useSearchParams()`, writes them back via `router.push()` (status/platform/language tabs) or `router.replace()` (search input). Filter state lives entirely in the URL — no local state for filter values.

#### `[Type]Stats.tsx`
Props: the full array of items. Computes and displays status-bucket counts + aggregate time metrics using helpers from `lib/reading-time.ts`.

#### `Delete[Type]Button.tsx`
Client Component. Two-state button: idle → confirm → calls `DELETE /api/{type}/{id}` → navigates away. Has a loading spinner during the request.

---

### Anime-specific extras

#### `AnimeSeriesManager.tsx`
Modal-based UI for managing multi-season anime groupings. Two modes:
- **Add Series** — text input + submit, POSTs to `/api/anime-series`
- **Add to Series** — thumbnail grid of all anime; clicking an item toggles it into the selected series by PATCHing its `seriesName`

#### `AnimeGroupedView.tsx`
Renders anime grouped by `seriesName` using collapsible `<details>` elements. Items without a series appear in an "Other" section. Shows series name + episode count in the summary row.

### TV-specific extras

#### `TvSeriesManager.tsx` / `TvGroupedView.tsx`
Identical pattern to the Anime series components, but for TV shows grouping seasons of the same show.

---

### Games-specific extras

#### `SteamSyncButton.tsx`
Client Component. Calls `POST /api/games/steam-sync`. Shows loading state, then a success summary ("+N created / ~N updated · N SGDB, N CDN") or error message for 6 seconds before resetting.

#### `MirrorCoversButton.tsx`
Client Component. Calls `POST /api/games/mirror-covers` in a loop until `remaining === 0`. Shows live progress: "Mirroring… N done, N left". Stops immediately with an error message if a batch returns `mirrored: 0` (indicates an upload failure). On completion shows "N covers mirrored" for 6 seconds.

---

### Wardrobe-specific components

#### `GarmentCard.tsx`
Displays garment photo, name, type badge, brand, and a wash-urgency badge (green/gray/amber/red based on `wornCount` and type).

#### `GarmentForm.tsx`
Three-section form: Basic info, Washing instructions, Drying instructions. Washing section is conditional on `washMethod === MACHINE`. Cover uses `ImageUpload`.

#### `WardrobeActions.tsx`
Props: `garmentId`, `wornCount`. Two buttons: "Wore Today" (POST `/wear`) and "Mark as Washed" (POST `/wash`). "Mark as Washed" only appears when `wornCount > 0`.

#### `WashGroupsView.tsx`
Groups garments by the tuple `(colorGroup, washMethod, washCycle)`. Each group shows: color swatch, wash settings, max-safe temperature, max-safe spin speed, count of items needing washing. Items within each group are sorted by urgency. Collapsible.

#### `WashRecommendation.tsx`
Props: wash calculation result from `wash-calculator.ts`. Displays temperature, spin RPM, cycle, and detergent type in a 2×2 grid. Shows dryer recommendation with alternatives. Shows pre-soak suggestion if applicable. Lists care notes/tips.

---

## 7. Library Utilities (`lib/`)

### `db.ts`

Prisma singleton. Uses `@prisma/adapter-pg` with a `pg.Pool` (max 2 connections). Reuses the global instance across hot-reloads in development to avoid exhausting connections. Exports a single `db` constant.

### `covers.ts`

Supabase Storage helpers. All functions read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from environment at module load.

```typescript
isSupabaseCover(url: string | null): boolean
// Returns true if the URL contains '/storage/v1/object/public/covers/'

thumbUrl(url: string | null, width: number, quality = 75): string | null
// If the URL is a Supabase cover, rewrites it to the image transform endpoint:
// /storage/v1/object/public/... → /storage/v1/render/image/public/...?width=N&quality=Q&format=webp
// Returns the URL unchanged for non-Supabase URLs, null for null.

mirrorCover(sourceUrl: string, path: string): Promise<string>
// Downloads the image from sourceUrl, then calls uploadCover()

uploadCover(buffer: ArrayBuffer, path: string, contentType: string): Promise<string>
// POSTs to SUPABASE_URL/storage/v1/object/covers/{path} with Authorization + apikey headers
// Uses x-upsert: true (idempotent). Returns the public URL.

deleteCover(path: string): Promise<void>
// DELETEs SUPABASE_URL/storage/v1/object/covers/{path}
```

Stored URL format: `{SUPABASE_URL}/storage/v1/object/public/covers/{path}`

### `reading-time.ts`

Language-aware time estimation for all media types.

```typescript
calculateReadingTime(pages: number, language: LanguageKey): ReadingTime
// Uses LANGUAGE_CONFIG WPM and words-per-page to compute total minutes

calculateAnimeTime(episodesWatched: number, episodeDuration: number): ReadingTime
calculateVideoTime(totalMinutes: number): ReadingTime
calculateMangaTime(chaptersRead: number, language: LanguageKey): ReadingTime
// Fixed benchmark: 8.7 min/chapter

calculateComicTime(issuesRead: number, language: LanguageKey): ReadingTime
// Same 8.7 min/issue benchmark

calculateArticleTime(wordCount: number, language: LanguageKey): ReadingTime

formatReadingTime(totalMinutes: number): string
// "45m" | "6h 18m" | "1d 4h"

// Summing helpers (take arrays of items):
sumReadingTime(books, language?)
sumVideoTime(items)
sumMangaTime(mangas)
sumComicTime(comics)
sumArticleTime(articles)
```

`ReadingTime` interface: `{ minutes, hours, days, formatted }`.

### `wash-calculator.ts`

Expert laundry recommendation engine.

Input (`WashInput`): garment materials string, washMethod, maxTemp, washCycle, spinLevel, dryMethod, wornCount.

Output (`WashRecommendation`): temperature (°C), cycle, spinRPM, detergent type, preSoak (bool), dryer recommendation, care notes array, urgency level.

**Logic:**
- Parses materials string for fabric keywords (silk, wool, cashmere, linen, cotton, synthetic, etc.)
- Classifies sensitivity: `very_delicate` (silk/cashmere) → `delicate` (wool/linen) → `normal` → `sturdy` (cotton/denim)
- Temperature: garment max-temp capped by fabric sensitivity; lowered further if lightly worn
- Spin RPM: 400 (very delicate) / 600 (delicate) / 800 (normal) / 1200 (sturdy)
- Detergent: delicate liquid / color-safe / standard
- Dryer: recommends tumble (low heat) for most; air dry for delicates; flat dry for knits
- Urgency: `fresh` (0 wears) / `can_wait` / `wash_soon` / `wash_now`

### `lib/constants/languages.ts`

Maps each `LanguageKey` to reading speed config:

| Language | WPM | Words/Page |
|---|---|---|
| English | 238 | 300 |
| Japanese | 357 | 600 |
| Arabic | 138 | 300 |
| Russian | 184 | 300 |
| Chinese | 255 | 500 |
| Korean | 200 | 400 |
| (others) | 200–238 | 250–300 |

Also exports `LANGUAGE_OPTIONS` — `{ value, label }[]` for select dropdowns.

### `lib/constants/platforms.ts`

`PLATFORM_LABELS` — maps `GamePlatform` enum values to human-readable names.

`PLATFORM_GROUPS` — array of `{ label: string, options: GamePlatform[] }` used to render `<optgroup>` elements in the platform selector:
- PC & Digital (PC, Mac, Steam Deck)
- PlayStation (PS1–PS5, PSP, PS Vita)
- Xbox (Xbox, 360, One, Series)
- Nintendo (Switch, Switch 2, Wii, Wii U, GameCube, N64, SNES, NES, 3DS, DS, GBA, GBC, Game Boy)
- Sega (Saturn, Dreamcast, Genesis, Game Gear)
- Mobile (iOS, Android)
- Other

---

## 8. Key Design Patterns

### Data Flow
- **Server Components** do all database reads (`db.game.findMany`, etc.) at request time
- **Client Components** handle interactivity (forms, filters, buttons)
- No client-side data fetching for page content — data is passed as props from server to client

### URL-based Filter State
All active filters live in the URL (`?status=PLAYING&platform=PC&q=zelda`). This means:
- Back/forward navigation preserves filter state
- Sharing a URL shares the exact view
- No `useState` needed for filter values — read from `searchParams`

Filter components use `router.push()` for status/platform/language (adds history entry) and `router.replace()` for search (replaces current entry, no history spam per keystroke).

### In-memory Filtering
Pages fetch all rows with a single `findMany`, then `.filter()` in JavaScript. Rationale: libraries are small (hundreds of items), so a DB query with a WHERE clause adds latency without meaningful benefit. Simple, fast for the use case.

### Form Pattern
Every form component follows:
```typescript
// Shared input class
const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 ...";

// Generic field wrapper
function Field({ label, children }: ...) { ... }

// State
const [form, setForm] = useState<FormData>({ ...DEFAULT, ...initialData });
function update(key, value) { setForm(p => ({ ...p, [key]: value })); }

// Submit
async function handleSubmit(e) {
  e.preventDefault();
  const res = await fetch(url, { method, body: JSON.stringify(payload) });
  if (!res.ok) { setError(...); return; }
  router.push(`/library/{type}/{id}`);
}
```

### API Route Pattern
Every route handler:
1. Parses and validates input with a Zod schema
2. Performs a single Prisma operation
3. Returns JSON with appropriate HTTP status

---

## 9. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase) |
| `AUTH_SECRET` | Yes | Value stored in the session cookie; checked by middleware |
| `AUTH_PASSWORD` | Yes | Password the user types on the login page |
| `STEAM_API_KEY` | For Steam sync | Steam Web API key |
| `STEAM_USER_ID` | For Steam sync | Steam 64-bit user ID |
| `STEAMGRIDDB_API_KEY` | Optional | SteamGridDB API key for higher-quality cover art |
| `SUPABASE_URL` | For image upload | Supabase project URL (`https://{ref}.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | For image upload | Supabase secret/service-role key for storage writes |

---

## 10. Complete File Listing

```
AGENTS.md
CLAUDE.md
CODEBASE.md
README.md
app/
  favicon.ico
  globals.css
  layout.tsx
  page.tsx
  login/
    page.tsx
  library/
    layout.tsx
    loading.tsx
    page.tsx
    anime/
      loading.tsx
      page.tsx
      new/page.tsx
      [id]/
        page.tsx
        edit/page.tsx
    articles/
      loading.tsx
      page.tsx
      new/page.tsx
      [id]/
        page.tsx
        edit/page.tsx
    books/
      loading.tsx
      page.tsx
      new/page.tsx
      [id]/
        page.tsx
        edit/page.tsx
    comics/
      loading.tsx
      page.tsx
      new/page.tsx
      [id]/
        page.tsx
        edit/page.tsx
    games/
      loading.tsx
      page.tsx
      new/page.tsx
      [id]/
        page.tsx
        edit/page.tsx
    manga/
      loading.tsx
      page.tsx
      new/page.tsx
      [id]/
        page.tsx
        edit/page.tsx
    movies/
      loading.tsx
      page.tsx
      new/page.tsx
      [id]/
        page.tsx
        edit/page.tsx
    tv/
      loading.tsx
      page.tsx
      new/page.tsx
      [id]/
        page.tsx
        edit/page.tsx
  wardrobe/
    layout.tsx
    loading.tsx
    page.tsx
    new/page.tsx
    [id]/
      loading.tsx
      page.tsx
      edit/page.tsx
  api/
    auth/route.ts
    anime/
      route.ts
      [id]/route.ts
    anime-series/route.ts
    articles/
      route.ts
      [id]/route.ts
    books/
      route.ts
      [id]/route.ts
    comics/
      route.ts
      [id]/route.ts
    games/
      route.ts
      [id]/route.ts
      mirror-covers/route.ts
      steam-sync/route.ts
    manga/
      route.ts
      [id]/route.ts
    movies/
      route.ts
      [id]/route.ts
    tv/
      route.ts
      [id]/route.ts
    tv-series/route.ts
    upload/route.ts
    wardrobe/
      route.ts
      [id]/
        route.ts
        wash/route.ts
        wear/route.ts
components/
  layout/
    Sidebar.tsx
  dashboard/
    DashboardClient.tsx
  ui/
    ComboboxField.tsx
    ImageUpload.tsx
    SearchInput.tsx
  anime/
    AnimeCard.tsx
    AnimeFilters.tsx
    AnimeForm.tsx
    AnimeGroupedView.tsx
    AnimeSeriesManager.tsx
    AnimeStats.tsx
    DeleteAnimeButton.tsx
  articles/
    ArticleCard.tsx
    ArticleFilters.tsx
    ArticleForm.tsx
    ArticleStats.tsx
    DeleteArticleButton.tsx
  books/
    BookCard.tsx
    BookFilters.tsx
    BookForm.tsx
    BooksStats.tsx
    DeleteBookButton.tsx
  comics/
    ComicCard.tsx
    ComicFilters.tsx
    ComicForm.tsx
    ComicStats.tsx
    DeleteComicButton.tsx
  games/
    DeleteGameButton.tsx
    GameCard.tsx
    GameFilters.tsx
    GameForm.tsx
    GameStats.tsx
    MirrorCoversButton.tsx
    SteamSyncButton.tsx
  manga/
    DeleteMangaButton.tsx
    MangaCard.tsx
    MangaFilters.tsx
    MangaForm.tsx
    MangaStats.tsx
  movies/
    DeleteMovieButton.tsx
    MovieCard.tsx
    MovieFilters.tsx
    MovieForm.tsx
    MovieStats.tsx
  tv/
    DeleteTvButton.tsx
    TvCard.tsx
    TvFilters.tsx
    TvForm.tsx
    TvGroupedView.tsx
    TvSeriesManager.tsx
    TvStats.tsx
  wardrobe/
    DeleteGarmentButton.tsx
    GarmentCard.tsx
    GarmentForm.tsx
    WardrobeActions.tsx
    WashGroupsView.tsx
    WashRecommendation.tsx
lib/
  constants/
    languages.ts
    platforms.ts
  covers.ts
  db.ts
  reading-time.ts
  wash-calculator.ts
middleware.ts
next.config.ts
package.json
package-lock.json
postcss.config.mjs
prisma/
  schema.prisma
prisma.config.ts
public/
  file.svg
  globe.svg
  next.svg
  vercel.svg
  window.svg
tsconfig.json
```
