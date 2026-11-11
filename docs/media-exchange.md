# Media exchange with a friend's site

Two copies of this site send each other a movie, show, anime, manga or book. Everything happens on
the portal (`/`), under **exchange**:

- **from {friend}**: what they sent, with its details, their note, and a timer counting down to
  when you should be done. **Finished it** marks it done and tells their site.
- **to {friend}**: **Send something** opens a picker. Choose the type, search its catalogue (TMDB
  for movies and TV, MyAnimeList for anime and manga, Google Books for books), pick one, add a note
  if you like, and send it. While they haven't finished it, you see their timer instead of the
  button. You can send the next one once they mark it finished.

One item is open each way at a time.

## The deadline

The receiving site works it out when the item arrives, from the item's length: **an hour of it per
day, rounded up**. A two-hour film gets 2 days, a 28 × 24-minute anime 12, a 541-page book 14. It is
never less than 2 days or more than 60, and it is 7 when the catalogue doesn't give a length.

How long things are taken to be (`lib/media-share.ts`):

| Kind | Length |
|---|---|
| Movie | TMDB runtime |
| TV | every season's episodes × that season's runtime (else the show's) |
| Anime | episodes × minutes per episode |
| Manga | chapters × 5 min, or volumes × 45 min when chapters aren't counted |
| Book | pages × 1.5 min (about 40 pages an hour) |

The timer is shown, not enforced: going past it turns it orange and reads "… late". Nothing is
removed.

## Setting it up

On **both** sites, in Vercel → Settings → Environment Variables, then redeploy:

| Variable | On your site | On your friend's |
|---|---|---|
| `FRIEND_SITE_URL` | their address, e.g. `https://www.their.site` | your address |
| `FRIEND_NAME` | what to call them | what to call you |
| `EXCHANGE_TOKEN` | 32+ random characters | **the same value** |

Each site also runs `prisma/manual-migrations/042-media-shares.sql` in its Supabase SQL Editor.
Searching needs that site's own catalogue keys (`TMDB_API_KEY`, `MAL_CLIENT_ID`,
`GOOGLE_BOOKS_API_KEY`). Receiving needs none of them: the sender's site sends everything.

## The protocol

For a site that isn't a copy of this one. JSON over HTTPS, each call with
`Authorization: Bearer <EXCHANGE_TOKEN>`. No other path accepts the token.

### `POST /api/exchange/inbox` — the sender delivers an item

```json
{
  "id": "3f1c3a5e-8d0f-4b8a-9d0e-0b5d6f1f2a3b",
  "sentAt": "2026-11-11T10:00:00.000Z",
  "note": "watch this",
  "media": {
    "kind": "movie",
    "sourceId": "129",
    "title": "Spirited Away",
    "altTitle": null,
    "year": 2001,
    "image": "https://image.tmdb.org/t/p/w500/….jpg",
    "creator": "Hayao Miyazaki",
    "facts": ["Studio Ghibli"],
    "lengthMinutes": 125,
    "lengthLabel": "2h 5m"
  }
}
```

- `id` is a UUID made by the sender. Both sites keep the item under it.
- `kind` is `movie`, `tv`, `anime`, `manga` or `book`. `sourceId` is the TMDB or MyAnimeList number,
  or the Google Books volume id.
- `image` is kept only if it's https on TMDB's, MyAnimeList's or Google Books' image host.
- `note` is at most 500 characters, or null.

Answers:

- `201 { "dueAt": "…" }`: the receiver's deadline.
- The same `id` again gets the same answer, so a retry is safe.
- `409` if something from you is still open there.
- `400` for a body that doesn't fit, and `401` for a bad token.

### `POST /api/exchange/inbox/{id}/finished` — the receiver finished it

```json
{ "finishedAt": "2026-11-12T20:15:00.000Z" }
```

Answers `200 { "ok": true }`, or `404` if no item with that `id` was sent from there. Saying it twice
is harmless: the first date is kept. If the call doesn't get through, the receiver's portal offers
**Tell them again**.
