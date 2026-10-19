<p align="center">
  <img src="client/public/logo.png" width="96" alt="Botfrag logo" />
</p>

<h1 align="center">Botfrag</h1>

<p align="center">A community platform where gamers share their best <b>moments</b> and write honest <b>game reviews</b>.</p>

---

Botfrag started as a CSE470 university project ([Azhar1256/CSE470](https://github.com/Azhar1256/CSE470)). This repository is a ground-up rebuild of it as a proper platform.

## Features

- **Moments**: post clutch plays, aces, fails and screenshots. Upload images and video clips (MP4/WebM/MOV up to 100 MB) or embed a YouTube link, with up to 6 media items per post
- **Reviews**: score any game from 1 to 10, with a written verdict
- **Game pages**: every game gets a page automatically, with its average score, a score distribution chart, and all moments and reviews about it
- **IGDB integration** (optional): search real games while posting, with box art, genres, platforms, release dates and summaries on game pages. Typed names like "baldurs gate 3" are matched to the right game
- **Giant Bomb** (optional): fills in details for games IGDB doesn't know, and adds a "More on Giant Bomb" link to game pages
- **Feeds**: Home, Following, Moments and Reviews, sorted by Latest or Top (this week / month / all time)
- **Sign in with Discord, Twitch or Steam** (optional), alongside email and password. A verified email links to an existing account, and signed-in players can connect or disconnect accounts from their profile settings
- **Steam playtime on posts**: with Steam connected, posts show how long the author has played that game, read from their Steam library by the server so it can't be faked
- **Player profiles**: avatar, bio, platforms, favourite games, and post/like/follower stats. You can follow other players
- **Likes, comments and sharing**: post owners can moderate comments on their posts
- **Search** across titles, descriptions, games and tags, plus tag pages and trending tags
- Responsive dark UI with a bottom tab bar on phones

## Tech

| | |
|---|---|
| Client | React 19, React Router 7, Vite, hand-written CSS (no UI framework) |
| Server | Node.js, Express 5, MongoDB with Mongoose 8 |
| Auth | Email or username plus password (bcrypt), Discord and Twitch OAuth, Steam OpenID, JWT bearer tokens |
| Uploads | Multer to local disk, type-checked and size-limited |
| Game data | [IGDB](https://api-docs.igdb.com) via a Twitch app token, and [Giant Bomb](https://www.giantbomb.com/api/), cached in MongoDB |
| Steam | OpenID 2.0 sign-in, Steam Web API for profiles and playtime |
| Security | Helmet with a CSP, auth rate limiting, owner checks on every write, regex-safe search |
| Tests | `node:test`, Supertest and an in-memory MongoDB |

## Getting started

You need **Node.js 20+** and **MongoDB**, either running locally or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
npm run install:all                 # installs server and client dependencies
cp server/.env.example server/.env  # then set MONGODB_URI and JWT_SECRET
npm run seed                        # optional: demo players and posts
```

### Optional: game data from IGDB

1. Turn on two-factor authentication on your Twitch account
2. Register an app at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps): any name, redirect URL `http://localhost`, category *Website Integration*, client type *Confidential*
3. Open it with **Manage**, copy the Client ID, click **New Secret**, and put both in `server/.env` as `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`

Without these, everything still works; games just have no artwork or details.

### Optional: sign in with Discord and Twitch

The redirect URLs below are for local development. In production, use your domain and set `PUBLIC_URL` to it.

- **Twitch** reuses the IGDB app. In its settings (**Manage**), add the OAuth redirect URL `http://localhost:5173/api/auth/twitch/callback`
- **Discord**: create an application at [discord.com/developers/applications](https://discord.com/developers/applications). Under **OAuth2**, add the redirect `http://localhost:5173/api/auth/discord/callback`, then put the Client ID and Client Secret in `server/.env` as `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`

- **Steam** sign-in needs no setup. For Steam names, avatars and playtime on posts, get a Web API key at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) (enter `localhost` as the domain) and set `STEAM_API_KEY`. Playtime only shows for players whose Steam game details are public

The Discord and Twitch buttons appear once those providers are configured.

### Optional: Giant Bomb

Create a Giant Bomb account, copy your key from [giantbomb.com/api](https://www.giantbomb.com/api/), and set `GIANTBOMB_API_KEY`. It's free for non-commercial use.

### Run it

Run the API and the web app in two terminals:

```bash
npm run dev:server   # API on http://localhost:5050
npm run dev:client   # app on http://localhost:5173 (proxies /api to the server)
```

The seed creates five demo players (`nightowl`, `pixelpaladin`, `rocketqueen`, `cozycrit`, `fragmachine`). Each one's password is `password123`.

## Production

The server serves the built client, so one Node process runs the whole site:

```bash
npm run build   # builds client/dist
npm start       # NODE_ENV=production; set MONGODB_URI and JWT_SECRET in the environment
```

Uploads are stored in `server/uploads`. On hosts with ephemeral disks (Render, Railway, Heroku), mount a persistent volume and point `UPLOAD_DIR` at it.

## Tests

```bash
npm test
```

The tests cover sign-up and login, auth checks, post ownership, review scoring, media validation, uploads, likes, comments, follows, feeds and search, profiles and game stats, plus the IGDB, Giant Bomb and Steam clients, game matching, Steam playtime, account linking, and Discord/Twitch/Steam sign-in, including forged and replayed sign-in attempts. Every outside service is faked, so the tests never use your keys or the network.

## Project structure

```
client/                React app (Vite)
  src/components/      Layout, PostCard, Feed, Media, shared UI
  src/pages/           Home, PostPage, Compose, Games, Profile, Settings, Auth, Search/Tags
  src/lib/             API client, auth context, helpers
server/
  src/models/          User, Post, Comment, Game (IGDB cache)
  src/routes/          auth, users, posts (+ comments), games/tags, uploads
  src/lib/igdb.js      IGDB client (token, caching, search, title matching)
  src/lib/giantbomb.js Giant Bomb client
  src/lib/games.js     links posts to IGDB / Giant Bomb games
  src/lib/oauth.js     Discord and Twitch sign-in
  src/lib/steam.js     Steam OpenID and Web API (profiles, playtime)
  src/seed.js          demo data
  test/                API tests
```

## API overview

All routes are under `/api`. Routes marked 🔒 need an `Authorization: Bearer <token>` header.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/signup`, `/auth/login` | Create an account or sign in |
| GET 🔒 | `/auth/me` | Current user |
| GET | `/auth/providers` | Which of Discord and Twitch sign-in are set up |
| GET | `/auth/discord/start`, `/auth/twitch/start`, `/auth/steam/start` | Start a sign-in (browser redirect). Add `?link=<ticket>` to connect to the signed-in account instead |
| POST 🔒 | `/auth/link-ticket` | Short-lived ticket for connecting another account |
| DELETE 🔒 | `/auth/connections/:provider` | Disconnect an account, if another sign-in method remains |
| GET | `/posts?type=&game=&tag=&author=&q=&sort=latest\|top&period=&feed=following&page=` | Feed |
| POST 🔒 | `/posts` | Create a moment or review. `game` is a name or `{ name, igdbId }` |
| GET / PATCH 🔒 / DELETE 🔒 | `/posts/:id` | Read, edit or delete a post (owner only for writes) |
| POST 🔒 | `/posts/:id/like` | Toggle a like |
| GET / POST 🔒 | `/posts/:id/comments` | List or add comments |
| DELETE 🔒 | `/posts/:id/comments/:commentId` | Delete a comment (its author or the post owner) |
| GET | `/users/:username` | Profile and stats |
| PATCH 🔒 | `/users/me` | Edit your profile |
| POST 🔒 | `/users/:username/follow` | Toggle following |
| GET | `/games`, `/games/:slug` | Game list, and one game's stats, score distribution and IGDB details |
| GET | `/games/search?q=` | Game autocomplete: games on Botfrag first, then IGDB |
| GET | `/tags/trending` | Top tags from the last 30 days |
| POST 🔒 | `/uploads` | Upload an image or clip (`multipart/form-data`, field `file`) |

## License

MIT
