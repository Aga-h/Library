# Graph Report - Library  (2026-08-19)

## Corpus Check
- 282 files · ~85,364 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1398 nodes · 2620 edges · 154 communities (117 shown, 37 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 132 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Finance API — Expenses & Income
- Media Entry Forms
- Finance Config & Subscriptions
- Media CRUD & Derived Status
- Cover Mirroring Routes
- Comics Drill-Down Pages
- Offline Expense Logger (PWA)
- Series & Universe API
- TypeScript Ambient Types
- Universe & Issue Pages
- Games Section
- Books API
- Movies Section
- Wardrobe List
- Wardrobe Detail
- Auth & Rate Limiting
- Anime Section
- List Filter Controls
- Dev Dependencies
- Project Docs & Rationale
- TV Section
- Games Steam
- Manga Id Derive
- Runtime Dependencies
- Movies Id Articles
- Anime U Books
- Books Bookfilters Status
- Manga Mangaform Id
- Imageupload Ui Comics
- Dashboardclient Dashboard C
- Movies Movieform Id
- Hierarchy Options Leaf
- Anime Animeform Id
- Tv Tvform Id
- Anime S Animecard
- Articles Articlefilters Status
- Comics Publisherid Titleform
- Booksstats Books Reading
- Manga Mangastats Mangacard
- Anime Id Deleteanimebutton
- Articles Articleform Id
- Comics Issuerow Publisherid
- Games Gameform Id
- Movies Id Deletemoviebutton
- Articles Articlestats Articlecard
- Package Name Private
- Anime Series
- Anime Universes
- Articles Id
- Books Series
- Books Universes
- Comics Issues
- Comics Publishers
- Comics Universes
- Games Id
- Movies Universes
- Tv Series
- Tv Universes
- Wardrobe Id
- Anime S Hierarchy
- Articles Id Deletearticlebutton
- Books Id New
- Books Id Deletebookbutton
- Games Id Deletegamebutton
- Manga Id Deletemangabutton
- Tv Id Deletetvbutton
- Wardrobe Garmentform Id
- Books S Hierarchy
- Layout Logoutbutton Sidebar
- Tv S Hierarchy
- Comics Issueform Publisherid
- Bookcard Books Constants
- Books Series
- Comics Issues
- Comics Publishers
- Comics Titles
- Comics Universes
- Finances Subscriptions
- Games
- Movies Universes
- Tv Series
- Tv Universes
- Layout Serviceworkerregistrar Metadata
- Hierarchyform Movies U
- Tvstats Tv Statpill
- Anime U
- Anime U
- Books U
- Books U
- Comics Publisherid
- Comics Publisherid
- Comics Publisherid
- Movies U
- Tv U
- Tv U
- Login Loginform Loginpage
- Next Config Nextconfig
- Vercel Ref Hnd1
- Anime U
- Books U
- Comics New
- Tv U
- Portalpage Sections
- Cover Image Fix
- Claude Hooks Session
- Eslint Config Eslintconfig
- React Package Dependencies
- Types Pg Package
- Vercel Functions Package
- Tailwindcss Package Devdependencies
- Config Postcss
- Agents Nextjs Differs
- Codebase Schema Reference
- Manga
- Manual Migrations
- Manual Migrations
- Manual Migrations
- Manual Migrations
- Manual Migrations
- Manual Migrations
- Manual Migrations
- Manual Migrations
- Readme Create Next

## God Nodes (most connected - your core abstractions)
1. `db` - 124 edges
2. `withErrors()` - 61 edges
3. `isUniqueViolation()` - 45 edges
4. `formatReadingTime()` - 45 edges
5. `deriveStatus()` - 26 edges
6. `HierarchyForm()` - 24 edges
7. `LANGUAGE_VALUES` - 19 edges
8. `mirrorCover()` - 19 edges
9. `LanguageKey` - 18 edges
10. `Breadcrumb()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `SSR Hydration Race on Image onError` --semantically_similar_to--> `Assert The Database, Not The Screen`  [INFERRED] [semantically similar]
  cover-image-fix-report.md → .claude/PROGRESS.md
- `Assert The Database, Not The Screen` --semantically_similar_to--> `Migration Run Order Depends On Direction`  [INFERRED] [semantically similar]
  .claude/PROGRESS.md → prisma/manual-migrations/README.md
- `PATCHHandler()` --calls--> `isUniqueViolation()`  [EXTRACTED]
  app/api/anime/series/[id]/route.ts → lib/prisma-errors.ts
- `PATCHHandler()` --calls--> `isUniqueViolation()`  [EXTRACTED]
  app/api/anime/universes/[id]/route.ts → lib/prisma-errors.ts
- `PATCHHandler()` --calls--> `isUniqueViolation()`  [EXTRACTED]
  app/api/books/series/[id]/route.ts → lib/prisma-errors.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Media Hierarchy Implementation** — _claude_progress_media_hierarchy, lib_hierarchy_options, components_ui_hierarchyform, components_ui_attachexistingbutton [INFERRED 0.85]
- **Verification And Migration Discipline** — _claude_progress_assert_the_database, prisma_manual_migrations_readme_migration_run_order, prisma_manual_migrations_readme_idempotent_migrations, agents_session_continuity [INFERRED 0.75]

## Communities (154 total, 37 thin omitted)

### Community 0 - "Finance API — Expenses & Income"
Cohesion: 0.06
Nodes (38): expenseSchema, POST, POSTHandler(), incomeSchema, POST, POSTHandler(), GET, GETHandler() (+30 more)

### Community 1 - "Media Entry Forms"
Cohesion: 0.10
Nodes (38): AnimeFormData, DEFAULT, Props, STATUS_LABELS, ArticleFormData, DEFAULT, Props, BookFormData (+30 more)

### Community 2 - "Finance Config & Subscriptions"
Cohesion: 0.07
Nodes (19): deltaSchema, GET, POST, DELETE, DELETE, POST, DELETE, createMovieSchema (+11 more)

### Community 3 - "Media CRUD & Derived Status"
Cohesion: 0.08
Nodes (27): Status Derived From Progress Counts, DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateAnimeSchema, createAnimeSchema (+19 more)

### Community 4 - "Cover Mirroring Routes"
Cohesion: 0.10
Nodes (28): POST, POSTHandler(), POST, POSTHandler(), POST, POSTHandler(), POST, POSTHandler() (+20 more)

### Community 5 - "Comics Drill-Down Pages"
Cohesion: 0.15
Nodes (27): ComicsPage(), dynamic, dynamic, PageProps, PublisherPage(), dynamic, PageProps, UniversePage() (+19 more)

### Community 6 - "Offline Expense Logger (PWA)"
Cohesion: 0.13
Nodes (24): Idempotency Must Be Server-Side, dynamic, metadata, CATEGORY_LABEL, CATEGORY_OPTIONS, fmt(), Logged, QuickExpenseForm() (+16 more)

### Community 7 - "Series & Universe API"
Cohesion: 0.09
Nodes (19): createSchema, GET, POST, POSTHandler(), createSchema, GET, POST, POSTHandler() (+11 more)

### Community 8 - "TypeScript Ambient Types"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 9 - "Universe & Issue Pages"
Cohesion: 0.12
Nodes (20): BookUniversePage(), count(), dynamic, PageProps, dynamic, PageProps, count(), dynamic (+12 more)

### Community 10 - "Games Section"
Cohesion: 0.08
Nodes (21): dynamic, GameContent(), PageProps, Game, GameStats(), State, SteamSyncButton(), ANIME_SEASON_VALUES (+13 more)

### Community 11 - "Books API"
Cohesion: 0.09
Nodes (17): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateBookSchema, createBookSchema, GET (+9 more)

### Community 12 - "Movies Section"
Cohesion: 0.10
Nodes (17): Buckets(), CARD_FIELDS, count(), dynamic, MovieContent(), MoviesPage(), PageProps, formatRuntime() (+9 more)

### Community 13 - "Wardrobe List"
Cohesion: 0.09
Nodes (21): dynamic, GarmentType, TYPE_LABELS, TYPES, Garment, GarmentCard(), TYPE_LABELS, urgencyFromWornCount() (+13 more)

### Community 14 - "Wardrobe Detail"
Cohesion: 0.11
Nodes (17): dynamic, GarmentDetailPage(), RouteContext, TYPE_LABELS, URGENCY_STYLES, DeleteGarmentButton(), WardrobeActions(), HEAT_LABELS (+9 more)

### Community 15 - "Auth & Rate Limiting"
Cohesion: 0.13
Nodes (20): attempts, DELETE, POST, POSTHandler(), rateLimited(), Signed HMAC Session Token, b64urlDecode(), b64urlEncode() (+12 more)

### Community 16 - "Anime Section"
Cohesion: 0.12
Nodes (15): AnimeContent(), AnimePage(), Buckets(), CARD_FIELDS, count(), dynamic, PageProps, dynamic (+7 more)

### Community 17 - "List Filter Controls"
Cohesion: 0.12
Nodes (8): AnimeFilters(), STATUS_OPTIONS, MangaFilters(), STATUS_OPTIONS, STATUS_OPTIONS, TvFilters(), SearchInput(), SearchInputProps

### Community 18 - "Dev Dependencies"
Cohesion: 0.11
Nodes (19): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, prisma (+11 more)

### Community 19 - "Project Docs & Rationale"
Cohesion: 0.13
Nodes (13): Assert The Database, Not The Screen, Session Continuity Via PROGRESS.md, Project Instructions Entry Point, Game, GameCard(), STATUS_STYLES, GameFilters(), STATUS_OPTIONS (+5 more)

### Community 20 - "TV Section"
Cohesion: 0.15
Nodes (13): count(), dynamic, TvPage(), count(), dynamic, PageProps, TvSeriesPage(), STATUS_STYLES (+5 more)

### Community 21 - "Games Steam"
Cohesion: 0.18
Nodes (15): AchievementResult, AppDetailsSchema, BLOCKED_STEAM_GAME_NAMES, fetchAchievements(), fetchOwnedGames(), fetchResilient(), fetchSteamGridDbCover(), fetchStoreDetails() (+7 more)

### Community 22 - "Manga Id Derive"
Cohesion: 0.14
Nodes (12): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateMangaSchema, createMangaSchema, GET (+4 more)

### Community 23 - "Runtime Dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, next, dependencies, lucide-react, next, pg, @prisma/adapter-pg, @prisma/client (+9 more)

### Community 24 - "Movies Id Articles"
Cohesion: 0.12
Nodes (9): createArticleSchema, GET, POST, DELETE, GET, PATCH, RouteContext, updateMovieSchema (+1 more)

### Community 25 - "Anime U Books"
Cohesion: 0.18
Nodes (11): AnimeUniversePage(), count(), dynamic, PageProps, BookSeriesPage(), count(), dynamic, PageProps (+3 more)

### Community 26 - "Books Bookfilters Status"
Cohesion: 0.16
Nodes (10): BookContent(), BooksPage(), Buckets(), CARD_FIELDS, count(), dynamic, PageProps, BookFilters() (+2 more)

### Community 27 - "Manga Mangaform Id"
Cohesion: 0.15
Nodes (8): dynamic, PageProps, dynamic, DEFAULT, MangaForm(), MangaFormData, Props, STATUS_LABELS

### Community 28 - "Imageupload Ui Comics"
Cohesion: 0.18
Nodes (12): DEFAULT, IssueFormData, Props, deleteOldCover(), ImageUpload(), handleFile(), handleRemove(), Props (+4 more)

### Community 29 - "Dashboardclient Dashboard C"
Cohesion: 0.21
Nodes (11): c(), dynamic, getDashboardData, HomePage(), total(), ChartView(), DashboardClient(), META (+3 more)

### Community 30 - "Movies Movieform Id"
Cohesion: 0.19
Nodes (9): dynamic, EditMoviePage(), PageProps, dynamic, NewMoviePage(), PageProps, formatRuntime(), MovieForm() (+1 more)

### Community 31 - "Hierarchy Options Leaf"
Cohesion: 0.18
Nodes (11): Universe / Series / Entry Hierarchy, LEAF, LEAF_ORDER, LeafRow, PARENTED, PARENTED_ORDER, ParentedRow, ROOT (+3 more)

### Community 32 - "Anime Animeform Id"
Cohesion: 0.21
Nodes (8): dynamic, EditAnimePage(), PageProps, dynamic, NewAnimePage(), PageProps, AnimeForm(), animeSeriesOptions()

### Community 33 - "Tv Tvform Id"
Cohesion: 0.21
Nodes (8): dynamic, EditTvPage(), PageProps, dynamic, NewTvPage(), PageProps, TvForm(), tvSeriesOptions()

### Community 34 - "Anime S Animecard"
Cohesion: 0.24
Nodes (9): AnimeSeriesPage(), count(), dynamic, PageProps, Anime, AnimeCard(), STATUS_STYLES, Crumb (+1 more)

### Community 35 - "Articles Articlefilters Status"
Cohesion: 0.20
Nodes (6): ArticleContent(), dynamic, PageProps, ArticleFilters(), STATUS_OPTIONS, ARTICLE_STATUS_VALUES

### Community 36 - "Comics Publisherid Titleform"
Cohesion: 0.18
Nodes (5): dynamic, PageProps, dynamic, PageProps, TitleForm()

### Community 37 - "Booksstats Books Reading"
Cohesion: 0.31
Nodes (7): Book, BooksStats(), BooksStatsProps, calculateReadingTime(), makeReadingTime(), ReadingTime, sumReadingTime()

### Community 38 - "Manga Mangastats Mangacard"
Cohesion: 0.24
Nodes (7): Manga, MangaCard(), STATUS_STYLES, Manga, MangaStats(), LanguageKey, calculateMangaTime()

### Community 39 - "Anime Id Deleteanimebutton"
Cohesion: 0.22
Nodes (6): AnimeDetailPage(), dynamic, PageProps, SEASON_LABELS, STATUS_STYLES, DeleteAnimeButton()

### Community 40 - "Articles Articleform Id"
Cohesion: 0.20
Nodes (4): dynamic, PageProps, dynamic, ArticleForm()

### Community 41 - "Comics Issuerow Publisherid"
Cohesion: 0.24
Nodes (7): dynamic, EditIssuePage(), PageProps, IssueDetailPage(), Issue, IssueRow(), formatIssueNumber()

### Community 42 - "Games Gameform Id"
Cohesion: 0.20
Nodes (4): dynamic, PageProps, dynamic, GameForm()

### Community 43 - "Movies Id Deletemoviebutton"
Cohesion: 0.24
Nodes (6): dynamic, formatRuntime(), MovieDetailPage(), PageProps, STATUS_STYLES, DeleteMovieButton()

### Community 44 - "Articles Articlestats Articlecard"
Cohesion: 0.24
Nodes (6): Article, ArticleCard(), STATUS_STYLES, Article, ArticleStats(), calculateArticleTime()

### Community 45 - "Package Name Private"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, typecheck (+1 more)

### Community 46 - "Anime Series"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateSchema

### Community 47 - "Anime Universes"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateSchema

### Community 48 - "Articles Id"
Cohesion: 0.22
Nodes (5): DELETE, GET, PATCH, RouteContext, updateArticleSchema

### Community 49 - "Books Series"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateSchema

### Community 50 - "Books Universes"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateSchema

### Community 51 - "Comics Issues"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateIssueSchema

### Community 52 - "Comics Publishers"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updatePublisherSchema

### Community 53 - "Comics Universes"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateUniverseSchema

### Community 54 - "Games Id"
Cohesion: 0.22
Nodes (5): DELETE, GET, PATCH, RouteContext, updateGameSchema

### Community 55 - "Movies Universes"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateSchema

### Community 56 - "Tv Series"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateSchema

### Community 57 - "Tv Universes"
Cohesion: 0.22
Nodes (6): DELETE, GET, PATCH, PATCHHandler(), RouteContext, updateSchema

### Community 58 - "Wardrobe Id"
Cohesion: 0.22
Nodes (5): DELETE, GET, PATCH, patchSchema, RouteContext

### Community 59 - "Anime S Hierarchy"
Cohesion: 0.28
Nodes (7): dynamic, NewAnimeSeriesPage(), dynamic, EditAnimeSeriesPage(), PageProps, animeUniverseOptions(), shapeRoot()

### Community 60 - "Articles Id Deletearticlebutton"
Cohesion: 0.25
Nodes (5): ArticleDetailPage(), dynamic, PageProps, STATUS_STYLES, DeleteArticleButton()

### Community 61 - "Books Id New"
Cohesion: 0.28
Nodes (7): dynamic, EditBookPage(), PageProps, dynamic, NewBookPage(), PageProps, bookSeriesOptions()

### Community 62 - "Books Id Deletebookbutton"
Cohesion: 0.25
Nodes (5): BookDetailPage(), dynamic, PageProps, STATUS_STYLES, DeleteBookButton()

### Community 63 - "Games Id Deletegamebutton"
Cohesion: 0.25
Nodes (4): dynamic, PageProps, STATUS_STYLES, DeleteGameButton()

### Community 64 - "Manga Id Deletemangabutton"
Cohesion: 0.25
Nodes (5): dynamic, MangaDetailPage(), PageProps, STATUS_STYLES, DeleteMangaButton()

### Community 65 - "Tv Id Deletetvbutton"
Cohesion: 0.25
Nodes (5): dynamic, PageProps, STATUS_STYLES, TvDetailPage(), DeleteTvButton()

### Community 66 - "Wardrobe Garmentform Id"
Cohesion: 0.22
Nodes (3): dynamic, RouteContext, GarmentForm()

### Community 67 - "Books S Hierarchy"
Cohesion: 0.32
Nodes (6): dynamic, NewBookSeriesPage(), dynamic, EditBookSeriesPage(), PageProps, bookUniverseOptions()

### Community 68 - "Layout Logoutbutton Sidebar"
Cohesion: 0.32
Nodes (3): LogoutButton(), NAV_ITEMS, Sidebar()

### Community 69 - "Tv S Hierarchy"
Cohesion: 0.32
Nodes (6): dynamic, NewTvSeriesPage(), dynamic, EditTvSeriesPage(), PageProps, tvUniverseOptions()

### Community 70 - "Comics Issueform Publisherid"
Cohesion: 0.29
Nodes (3): dynamic, PageProps, IssueForm()

### Community 71 - "Bookcard Books Constants"
Cohesion: 0.33
Nodes (5): Book, BookCard(), STATUS_STYLES, LANGUAGE_CONFIG, LanguageConfig

### Community 72 - "Books Series"
Cohesion: 0.33
Nodes (4): createSchema, GET, POST, POSTHandler()

### Community 73 - "Comics Issues"
Cohesion: 0.33
Nodes (4): createIssueSchema, GET, POST, POSTHandler()

### Community 74 - "Comics Publishers"
Cohesion: 0.33
Nodes (4): createPublisherSchema, GET, POST, POSTHandler()

### Community 75 - "Comics Titles"
Cohesion: 0.33
Nodes (4): createTitleSchema, GET, POST, POSTHandler()

### Community 76 - "Comics Universes"
Cohesion: 0.33
Nodes (4): createUniverseSchema, GET, POST, POSTHandler()

### Community 77 - "Finances Subscriptions"
Cohesion: 0.33
Nodes (3): createSchema, GET, POST

### Community 78 - "Games"
Cohesion: 0.33
Nodes (3): createGameSchema, GET, POST

### Community 79 - "Movies Universes"
Cohesion: 0.33
Nodes (4): createSchema, GET, POST, POSTHandler()

### Community 80 - "Tv Series"
Cohesion: 0.33
Nodes (4): createSchema, GET, POST, POSTHandler()

### Community 81 - "Tv Universes"
Cohesion: 0.33
Nodes (4): createSchema, GET, POST, POSTHandler()

### Community 82 - "Layout Serviceworkerregistrar Metadata"
Cohesion: 0.40
Nodes (3): metadata, viewport, ServiceWorkerRegistrar()

### Community 96 - "Next Config Nextconfig"
Cohesion: 0.50
Nodes (3): nextConfig, remotePatterns, supabaseHost

### Community 97 - "Vercel Ref Hnd1"
Cohesion: 0.50
Nodes (3): hnd1, regions, $schema

### Community 103 - "Cover Image Fix"
Cohesion: 0.67
Nodes (3): Mirror Covers To Own Storage, IStoreBrowseService Is Not A Public API, Steam Cover Art Resolution

## Knowledge Gaps
- **548 isolated node(s):** `session-start.sh script`, `updateAnimeSchema`, `RouteContext`, `GET`, `PATCH` (+543 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db` connect `Finance Config & Subscriptions` to `Finance API — Expenses & Income`, `Media CRUD & Derived Status`, `Cover Mirroring Routes`, `Comics Drill-Down Pages`, `Series & Universe API`, `Universe & Issue Pages`, `Games Section`, `Books API`, `Movies Section`, `Wardrobe List`, `Wardrobe Detail`, `Anime Section`, `TV Section`, `Games Steam`, `Manga Id Derive`, `Movies Id Articles`, `Anime U Books`, `Books Bookfilters Status`, `Manga Mangaform Id`, `Dashboardclient Dashboard C`, `Movies Movieform Id`, `Hierarchy Options Leaf`, `Anime Animeform Id`, `Tv Tvform Id`, `Anime S Animecard`, `Articles Articlefilters Status`, `Comics Publisherid Titleform`, `Anime Id Deleteanimebutton`, `Articles Articleform Id`, `Comics Issuerow Publisherid`, `Games Gameform Id`, `Movies Id Deletemoviebutton`, `Anime Series`, `Anime Universes`, `Articles Id`, `Books Series`, `Books Universes`, `Comics Issues`, `Comics Publishers`, `Comics Universes`, `Games Id`, `Movies Universes`, `Tv Series`, `Tv Universes`, `Wardrobe Id`, `Anime S Hierarchy`, `Articles Id Deletearticlebutton`, `Books Id New`, `Books Id Deletebookbutton`, `Games Id Deletegamebutton`, `Manga Id Deletemangabutton`, `Tv Id Deletetvbutton`, `Wardrobe Garmentform Id`, `Books S Hierarchy`, `Tv S Hierarchy`, `Comics Issueform Publisherid`, `Books Series`, `Comics Issues`, `Comics Publishers`, `Comics Titles`, `Comics Universes`, `Finances Subscriptions`, `Games`, `Movies Universes`, `Tv Series`, `Tv Universes`, `Anime U`, `Anime U`, `Books U`, `Books U`, `Comics Publisherid`, `Comics Publisherid`, `Comics Publisherid`, `Movies U`, `Tv U`, `Tv U`?**
  _High betweenness centrality (0.260) - this node is a cross-community bridge._
- **Why does `withErrors()` connect `Finance Config & Subscriptions` to `Finance API — Expenses & Income`, `Media CRUD & Derived Status`, `Cover Mirroring Routes`, `Series & Universe API`, `Books API`, `Auth & Rate Limiting`, `Games Steam`, `Manga Id Derive`, `Movies Id Articles`, `Anime Series`, `Anime Universes`, `Articles Id`, `Books Series`, `Books Universes`, `Comics Issues`, `Comics Publishers`, `Comics Universes`, `Games Id`, `Movies Universes`, `Tv Series`, `Tv Universes`, `Wardrobe Id`, `Books Series`, `Comics Issues`, `Comics Publishers`, `Comics Titles`, `Comics Universes`, `Finances Subscriptions`, `Games`, `Movies Universes`, `Tv Series`, `Tv Universes`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `formatReadingTime()` connect `Comics Drill-Down Pages` to `Manga Id Deletemangabutton`, `Tv Id Deletetvbutton`, `Anime S Animecard`, `Media Entry Forms`, `Anime Animeform Id`, `Booksstats Books Reading`, `Manga Mangastats Mangacard`, `Anime Id Deleteanimebutton`, `Tv Tvform Id`, `Universe & Issue Pages`, `Articles Articlestats Articlecard`, `Movies Section`, `Anime Section`, `TV Section`, `Tvstats Tv Statpill`, `Articles Id Deletearticlebutton`, `Dashboardclient Dashboard C`, `Books Id Deletebookbutton`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `updateAnimeSchema`, `RouteContext` to the rest of the system?**
  _548 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Finance API — Expenses & Income` be split into smaller, more focused modules?**
  _Cohesion score 0.05902980713033314 - nodes in this community are weakly interconnected._
- **Should `Media Entry Forms` be split into smaller, more focused modules?**
  _Cohesion score 0.09714285714285714 - nodes in this community are weakly interconnected._
- **Should `Finance Config & Subscriptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06736353077816493 - nodes in this community are weakly interconnected._