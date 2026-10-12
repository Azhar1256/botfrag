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
- **Feeds**: Home, Following, Moments and Reviews, sorted by Latest or Top (this week / month / all time)
- **Player profiles**: avatar, bio, platforms, favourite games, and post/like/follower stats. You can follow other players
- **Likes, comments and sharing**: post owners can moderate comments on their posts
- **Search** across titles, descriptions, games and tags, plus tag pages and trending tags
- Responsive dark UI with a bottom tab bar on phones

## Tech

| | |
|---|---|
| Client | React 19, React Router 7, Vite, hand-written CSS (no UI framework) |
| Server | Node.js, Express 5, MongoDB with Mongoose 8 |
| Auth | Email or username plus password (bcrypt), JWT bearer tokens |
| Uploads | Multer to local disk, type-checked and size-limited |
| Security | Helmet with a CSP, auth rate limiting, owner checks on every write, regex-safe search |
| Tests | `node:test`, Supertest and an in-memory MongoDB |

## Getting started

You need **Node.js 20+** and **MongoDB**, either running locally or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
npm run install:all                 # installs server and client dependencies
cp server/.env.example server/.env  # then set MONGODB_URI and JWT_SECRET
npm run seed                        # optional: demo players and posts
```

Run the API and the web app in two terminals:

```bash
npm run dev:server   # API on http://localhost:5000
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

The 16 API tests cover sign-up and login, auth checks, post ownership, review scoring, media validation, uploads, likes, comments, follows, feeds and search, profiles and game stats.

## Project structure

```
client/                React app (Vite)
  src/components/      Layout, PostCard, Feed, Media, shared UI
  src/pages/           Home, PostPage, Compose, Games, Profile, Settings, Auth, Search/Tags
  src/lib/             API client, auth context, helpers
server/
  src/models/          User, Post, Comment
  src/routes/          auth, users, posts (+ comments), games/tags, uploads
  src/seed.js          demo data
  test/                API tests
```

## API overview

All routes are under `/api`. Routes marked 🔒 need an `Authorization: Bearer <token>` header.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/signup`, `/auth/login` | Create an account or sign in |
| GET 🔒 | `/auth/me` | Current user |
| GET | `/posts?type=&game=&tag=&author=&q=&sort=latest\|top&period=&feed=following&page=` | Feed |
| POST 🔒 | `/posts` | Create a moment or review |
| GET / PATCH 🔒 / DELETE 🔒 | `/posts/:id` | Read, edit or delete a post (owner only for writes) |
| POST 🔒 | `/posts/:id/like` | Toggle a like |
| GET / POST 🔒 | `/posts/:id/comments` | List or add comments |
| DELETE 🔒 | `/posts/:id/comments/:commentId` | Delete a comment (its author or the post owner) |
| GET | `/users/:username` | Profile and stats |
| PATCH 🔒 | `/users/me` | Edit your profile |
| POST 🔒 | `/users/:username/follow` | Toggle following |
| GET | `/games`, `/games/:slug` | Game list, and one game's stats and score distribution |
| GET | `/tags/trending` | Top tags from the last 30 days |
| POST 🔒 | `/uploads` | Upload an image or clip (`multipart/form-data`, field `file`) |

## License

MIT
