# Cover Image Fix — What We Tried and Why It Kept Failing

## Attempt 1 — `library_600x900.jpg` hardcoded URL
**Commit:** `4f5687f` (original sync)
**What we did:** Set every new game's cover to `https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/library_600x900.jpg` at sync time.
**What happened:** Worked for ~60-70% of games. The rest showed broken-image icons because `library_600x900.jpg` doesn't exist for all games (newer games migrated to a different CDN path, some games never had portrait art).
**Root cause of failure:** Hardcoded URL format isn't universal.

---

## Attempt 2 — `IStoreBrowseService/GetItems` API
**Commits:** `4f5687f`, `a9f0041`
**What we did:** Called `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/` in batches of 100 to get the canonical hashed CDN URLs with `asset_url_format` + filename substitution. On UPDATE, only overwrite `coverImage` when the map has a real URL.
**What happened:** Every game fell back to `header.jpg` (landscape banner). All covers got replaced with stretched landscape images.
**Root cause of failure (two bugs):**
1. The API returns items with field `id`, not `appid` — so `map.set(item.appid, ...)` always set `undefined` as the key, the map stayed empty.
2. `IStoreBrowseService/GetItems/v1/` returns **403 Forbidden** — it requires a Steam session cookie. It's an internal API, not public. Every call failed silently (we `continue`d past non-200 responses), so the map was always empty regardless of the parsing fix.

---

## Attempt 3 — Drop GetItems, use `library_600x900.jpg` + safe UPDATE
**Commit:** `6a6fbee`
**What we did:** Removed `fetchCoverUrls` entirely. `resolveCover` returns `library_600x900.jpg` directly (or SteamGridDB if key set). On UPDATE, only overwrite `coverImage` if current value is `null` or ends with `header.jpg`.
**What happened:** Broken-image icons still appeared for games where `library_600x900.jpg` 404s.
**Root cause of failure:** No error handling in the display layer — when the image URL is a 404, the browser shows its broken-image icon. The code was logically correct but the UI had no fallback.

---

## Attempt 4 — `onError` handler in GameCard
**Commit:** `05bc71d`
**What we did:** Added `useState(false)` for `imgError` and an `onError={() => setImgError(true)}` on the `<img>` tag. When `imgError` is true, show the Gamepad2 placeholder icon instead.
**What happened:** Still showing broken-image icons.
**Root cause of failure:** SSR/hydration race condition. Next.js server-renders the `<img>` tag into HTML. The browser downloads the HTML and immediately starts fetching the cover URL — if it 404s, the browser fires the `error` event and shows the broken icon right away. React hydration happens *after*, attaching the `onError` handler too late. The event is already gone, the broken icon is already shown.

---

## Attempt 5 — `useEffect` + `ref` post-hydration check
**Commit:** `d00cf0b`
**What we did:** Added `useRef<HTMLImageElement>` attached to the `<img>` tag, and a `useEffect` that runs after mount checking `img.complete && img.naturalWidth === 0`. A failed image is marked `complete` by the browser with `naturalWidth === 0`. This catches failures that happened before hydration and manually triggers the placeholder.
**Current status:** Deployed and unverified. User reports it still didn't work.

---

## Where Things Stand

The display logic in `GameCard` *should* now work correctly. The remaining unknowns are:

1. **Has the branch been deployed?** All fixes are on `claude/media-library-tracker-ASQPZ`. If the live site pulls from `main`, none of this has been deployed yet.
2. **Are there still `header.jpg` landscape covers in the DB?** These load successfully (not a 404) so `onError` and the `useEffect` check will never fire — they'll just show a stretched landscape image. The SQL fix for this has been provided but may not have been run:
   ```sql
   UPDATE "Game"
   SET "coverImage" = 'https://cdn.cloudflare.steamstatic.com/steam/apps/' || "steamAppId" || '/library_600x900.jpg'
   WHERE "coverImage" LIKE '%header.jpg' AND "steamAppId" IS NOT NULL;
   ```
3. **Has sync been re-run after deployment?** The `needsCoverFix` logic in the UPDATE path will replace `header.jpg` covers automatically when sync runs with the new code.
