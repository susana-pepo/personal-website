# Connecting Spotify ("What I'm listening to")

The **What I'm listening to** block in the Music section and the footer player can show the
track you're playing on Spotify right now, or the last one you played. Until you connect it,
visitors see nothing there: no placeholder tracks.

This page gets it working **on your own computer first**. Putting it on the live site comes
later and needs a host you choose (see the last section).

> **The record crate doesn't need any of this.** "On my shelf of records" only needs Spotify
> share links (Share → Copy link) pasted into `music.collection.items` in
> `src/content/content.ts`. Covers, titles and players load from those links, with no keys.
> The podcast shelf works the same way: paste show links into `music.podcasts.items`.

## How it fits together

Reading *your* playback needs a private Spotify refresh token. That token must never be in the
website's JavaScript, where anyone could read it. So a small server function keeps the secrets,
asks Spotify, and passes on only public track details:

```
browser ──GET /api/now-playing──▶ server/nowPlaying.ts ──▶ Spotify Web API
                                   (holds the secrets)
```

| Piece | What it is |
|---|---|
| `server/nowPlaying.ts` | The handler. Standard `fetch`/`Response` only, so it runs anywhere. |
| `vite.config.ts` | During `npm run dev` only, serves `GET /api/now-playing` from that handler. |
| `scripts/spotify-auth.mjs` | `npm run spotify:auth`: the one-time sign-in that saves your refresh token. |
| `netlify/functions/now-playing.ts`, `api/now-playing.ts` | Ready-made wrappers for Netlify and Vercel. Not deployed. |
| `.env.local` | Your secrets, on your machine only. It is in `.gitignore`. |

The secrets have no `VITE_` prefix, so Vite never puts them in the browser bundle. Only
`VITE_NOW_PLAYING_URL` (a path, not a secret) reaches the browser.

## Your steps (once, about five minutes)

Only you can do these. They involve your Spotify account and your secrets, so nobody else
should type them for you.

### 1. Create a Spotify app

1. Go to <https://developer.spotify.com/dashboard> and sign in with your Spotify account.
2. Choose **Create app**. Any name and description will do (for example "Portfolio now playing").
3. Under **Redirect URIs**, add exactly:

   ```
   http://127.0.0.1:8888/callback
   ```

   It must be `127.0.0.1`, not `localhost`. Spotify no longer accepts `localhost` redirect URIs.
4. Under **Which API/SDKs are you planning to use?**, tick **Web API**, accept the terms and save.
5. Open the app's **Settings**. Copy the **Client ID**, then choose **View client secret** and
   copy the **Client secret**.

### 2. Paste the two values into `.env.local`

In the project root (next to `package.json`), create a file named `.env.local` if it doesn't
exist, and add these two lines with your values after the `=`:

```
SPOTIFY_CLIENT_ID=paste-your-client-id-here
SPOTIFY_CLIENT_SECRET=paste-your-client-secret-here
```

Save the file. Don't share it, don't paste these values into chats, and don't commit it.

### 3. Sign in once

```bash
npm run spotify:auth
```

The helper prints a link. Open it in your browser, sign in to Spotify if asked, and choose
**Agree**. The browser then shows "Connected", and the helper:

- saves `SPOTIFY_REFRESH_TOKEN` into `.env.local` (it never prints it);
- adds `VITE_NOW_PLAYING_URL=/api/now-playing` if it isn't there yet.

It asks for read-only access to what you're playing and what you played recently
(`user-read-currently-playing`, `user-read-recently-played`). It can't control your playback
or see anything else.

### 4. Look at it

If `npm run dev` is already running, it restarts on its own when `.env.local` changes.
Otherwise start it. Then open <http://localhost:5173/#music>. Play something on Spotify, and
within a minute the record player in "What I'm listening to" turns with your track on its label.

## When something isn't right

In development, a note in the Music section says why the block is hidden:

| You see | It means | Do this |
|---|---|---|
| "no Spotify keys yet" (503) | One or more of the three `SPOTIFY_*` values is missing from `.env.local`. | Do steps 2 and 3. |
| "Spotify refused the request" (502) | The token was revoked, or the app's secret was changed. | Run `npm run spotify:auth` again. |
| Nothing at all | Nothing playing and nothing played recently (204), or `VITE_NOW_PLAYING_URL` isn't set. | Play a song, or check `.env.local`. |

You can also open <http://localhost:5173/api/now-playing> directly to see the raw answer.

To disconnect, remove the app's access at <https://www.spotify.com/account/apps/> and delete
the `SPOTIFY_REFRESH_TOKEN` line from `.env.local`.

## What the feed returns

```json
{ "isPlaying": true, "title": "…", "artist": "…", "album": "…",
  "imageUrl": "https://i.scdn.co/…", "url": "https://open.spotify.com/track/…",
  "playedAt": "2026-11-23T08:00:00Z" }
```

| Status | Meaning |
|---|---|
| 200 | A track (playing now, or the last played with `playedAt`). |
| 204 | Nothing to show. |
| 502 | Spotify refused or failed. The body says at which step, never any secret. |
| 503 | Not configured. The body lists the missing variable *names*. |

The site accepts only `https://open.spotify.com/…` track links and `https://` covers, and
ignores anything malformed. It refreshes every minute while the tab is visible. Podcasts are
skipped, so the last song you played is shown instead.

## Later: putting it on the live site

Nothing is deployed yet. When you choose a host, the handler is already wrapped for two of them:

- **Netlify**: `netlify/functions/now-playing.ts`, served at `/api/now-playing`.
- **Vercel**: `api/now-playing.ts`, served at `/api/now-playing`.
- **Cloudflare** (Pages Functions or a Worker): wrap `createNowPlaying` the same way, passing
  the Worker's `env` instead of `process.env`.

On the host you choose:

1. Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN` as environment
   variables in its dashboard (the same values as in your `.env.local`), never in the repo.
2. Set `VITE_NOW_PLAYING_URL=/api/now-playing` for the build.
3. If the feed ever lives on a different domain from the site, set
   `NOW_PLAYING_ALLOW_ORIGIN` to the site's origin (for example `https://your-domain.com`), and
   use the feed's full `https://` URL as `VITE_NOW_PLAYING_URL`. With the same domain, leave it
   unset.

Responses are cached at the edge for 30 seconds, so a busy page doesn't hit Spotify's limits.

**Playback note:** the footer's play button controls the room's animation. Visitors can't play
your Spotify through your site, because Spotify only plays music inside its own apps and
players. The track link opens it in Spotify.
