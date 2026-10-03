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
- `/verify` — private, optional email-verification link for the member running it

The bot needs no privileged gateway intents.

## Vercel dashboard and polls

1. Import this repository into Vercel. Set `DASHBOARD_PASSWORD`, the Firebase variables, the matching `VERIFICATION_LINK_SECRET`, and Gmail SMTP variables from `.env.example`.
2. Put the production Vercel URL in `DASHBOARD_URL` on both Vercel and Wispbyte, then redeploy Vercel and restart the bot.
3. Open the deployment URL and sign in. The dashboard shows live bot polls and theme totals, sends announcements, publishes and closes polls, manages the bot activity and command details, and queues verification DMs.

See [BOT-ENV.md](BOT-ENV.md) for the exact Wispbyte and Vercel environment lists. Dashboard actions are delivered through Firestore and normally complete within 10 seconds while the bot is online.

## Private Discord poll editor

In the private preview, click **😀 Answer emojis**, select an answer, then select one of 20 emojis (or remove its emoji). Emojis appear in the preview, published results, and answer dropdown. The bot also shows a Playing activity; set `BOT_ACTIVITY` in `.env` to change its text, then restart. This is a presence status, not an embedded Discord Activity app.

Run `/poll` with no arguments. A private modal asks for a question and separate answer fields. Submit it to see a private preview. The editor lets you edit answers 1–5 and 6–10, set a picture, description, link and voting duration, toggle custom text, publish, or discard. Published polls have an answer dropdown, a separate written-answer modal, results, and a creator/manager-only close action. All voters can change their vote.

The Discord bot now persists polls and votes in `data/polls.sqlite` on its host, independently of dashboard configuration. This package targets Node.js 25; preserve the data directory when moving hosts. Run only one bot instance. Drafts expire after one hour or a restart. The bot requires an always-running process; Vercel hosts the dashboard, not the Discord gateway connection.

## Google Sheet jam calendar

The bot reads the public `syncmadinadu` Sheet1 calendar at startup. It uses its `Year`, `Month`, `Jam start Day`, `Jam theme vote start day`, and `theme vote end day` columns for `/jam`. Update that Sheet, then restart the bot to load the new dates. `JAM_START` and `VOTING_END` in `.env` remain a fallback if Google Sheets is unavailable.

## Firebase vote archive

Set `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_JSON` in the bot host environment to mirror every published-poll event, theme suggestion, vote change, custom written idea, and closure into Firestore path `october/jam-data/votes`. The document ID is the event UUID, so retries cannot duplicate data. See `WISPBYTE.md` for the Firebase Console steps. The local SQLite database remains the source of truth when Firebase is unavailable.

## Optional email verification

Members can use the server without verifying. The bot does not automatically DM new members or lock channels. A member can run `/verify` for a private link, or an organiser can explicitly send optional verification invitations from the dashboard. Recipients enter an email address and confirm a six-digit code. The bot then gives them `VERIFIED_ROLE_ID` and logs their Discord ID, username, email, and time to `VerifiedMembers.gs`. Configure the environment values in `.env.example` on their appropriate host: Gmail SMTP settings belong to Vercel; the Sheets webhook belongs to the bot host. Keep every real-email Sheet restricted. Previously locked Discord channels must be reopened in Discord permissions.

For Wispbyte deployment, use the ready-made archive and instructions in [WISPBYTE.md](WISPBYTE.md).

The dashboard reads live bot snapshots from Firestore. The bot keeps SQLite as its vote source and reports counts to Firestore every 10 seconds. Private written ideas are not shown in the dashboard.

Run `npm test` to check editor payloads, publishing, vote changes, custom answers, closing, expiry, and persistence.
