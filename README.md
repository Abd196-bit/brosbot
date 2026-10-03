# BRO'S JAM Discord bot

A reusable Discord bot and Vercel organiser dashboard for the next BRO'S JAM. It provides slash commands for the schedule, theme, rules, resources, team-ups, submissions, and rich interactive polls. Event details live in `.env`, so one codebase can run every jam.

## Set up

1. In the [Discord Developer Portal](https://discord.com/developers/applications), create an application, add a **Bot**, and copy its token and application ID.
2. Under **OAuth2 → URL Generator**, select `bot` and `applications.commands`. Give the bot `Send Messages`, `Embed Links`, and `Use Slash Commands`; open the generated URL to invite it to your server.
3. Run `cp .env.example .env`, then fill in the token, client ID, test guild ID, and the next jam's details.
4. Run `npm install`, then `npm run deploy-commands`.
5. Run `npm run bot:start` to start the bot.

Use `DISCORD_GUILD_ID` during development: guild commands appear almost immediately. Remove it and deploy commands again when you are ready to publish globally (global commands can take up to an hour to appear).

## Commands

- `/jam` — jam URL, theme, and live phase/countdown
- `/rules` — friendly core jam guidance
- `/resources` — useful free asset and development links
- `/teamup` — posts a team-up template (with role, skills, and timezone)
- `/submit` — opens the jam submission page
- `/announce` — admin-only event update in the configured announcements channel

The bot needs no privileged gateway intents.

## Vercel dashboard and polls

1. Import this repository into Vercel. In **Storage**, connect a Redis/KV integration and copy its `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables.
2. Add every value from `.env.example` to Vercel's environment settings, especially `BOT_API_SECRET` and `DASHBOARD_PASSWORD`; deploy it.
3. Put the deployment URL (for example `https://bros-jam-bot.vercel.app`) into the bot's `DASHBOARD_URL`, using the exact same `BOT_API_SECRET`, then restart the bot.
4. Open the deployment URL and sign in with `DASHBOARD_PASSWORD`. The dashboard has a visual poll composer and anonymous aggregate results.

## Private Discord poll editor

In the private preview, click **😀 Answer emojis**, select an answer, then select one of 20 emojis (or remove its emoji). Emojis appear in the preview, published results, and answer dropdown. The bot also shows a Playing activity; set `BOT_ACTIVITY` in `.env` to change its text, then restart. This is a presence status, not an embedded Discord Activity app.

Run `/poll` with no arguments. A private modal asks for a question and separate answer fields. Submit it to see a private preview. The editor lets you edit answers 1–5 and 6–10, set a picture, description, link and voting duration, toggle custom text, publish, or discard. Published polls have an answer dropdown, a separate written-answer modal, results, and a creator/manager-only close action. All voters can change their vote.

The Discord bot now persists polls and votes in `data/polls.sqlite` on its host, independently of dashboard configuration. This package targets Node.js 25; preserve the data directory when moving hosts. Run only one bot instance. Drafts expire after one hour or a restart. The bot requires an always-running process; Vercel hosts the dashboard, not the Discord gateway connection.

## Google Sheet jam calendar

The bot reads the public `syncmadinadu` Sheet1 calendar at startup. It uses its `Year`, `Month`, `Jam start Day`, `Jam theme vote start day`, and `theme vote end day` columns for `/jam`. Update that Sheet, then restart the bot to load the new dates. `JAM_START` and `VOTING_END` in `.env` remain a fallback if Google Sheets is unavailable.

## Firebase vote archive

Set `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_JSON` in the bot host environment to mirror every published-poll event, theme suggestion, vote change, custom written idea, and closure into Firestore path `october/jam-data/votes`. The document ID is the event UUID, so retries cannot duplicate data. See `WISPBYTE.md` for the Firebase Console steps. The local SQLite database remains the source of truth when Firebase is unavailable.

## Email verification gate

New non-admin members receive a private link to `/verify`, enter an email address, and confirm a six-digit email code. The bot then gives them `VERIFIED_ROLE_ID` and logs their Discord ID, username, email, and time to `VerifiedMembers.gs`. The dashboard button can also send a paced one-time campaign to existing non-admin, non-Verified members. Configure the environment values in `.env.example` on their appropriate host: Gmail SMTP settings belong to Vercel; the Sheets webhook belongs to the bot host. Keep every real-email Sheet restricted.

For Wispbyte deployment, use the ready-made archive and instructions in [WISPBYTE.md](WISPBYTE.md).

The Vercel dashboard's legacy Redis analytics do not currently sync with this local database. The web composer is a planning form; create and publish through Discord. Existing old poll messages should be replaced with new `/poll` messages. No existing database or messages are deleted by this update.

Run `npm test` to check editor payloads, publishing, vote changes, custom answers, closing, expiry, and persistence.
