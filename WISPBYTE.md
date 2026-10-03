# Deploy BRO'S JAM bot on Wispbyte

## Theme suggestions with /vote

Anyone in a server text channel can run `/vote theme:Switch it up`. The bot posts the suggestion to `VOTE_CHANNEL_ID` in that same server, with Aye, Nay and No opinion buttons. The sender gets a private confirmation. One vote per person is stored, and choosing a different button replaces it.

Set `VOTE_CHANNEL_ID` to the destination text channel's ID. The bot needs View Channel, Send Messages and Embed Links there. Run `npm run deploy-commands` once to register `/vote`, then restart the bot.

For the new spreadsheet `1CIf5U46grjMLybCjV33xhQQTnnG2uVpSnYfXNx8Y5Ew`, open Extensions → Apps Script and paste **only** `google-apps-script/ThemeVotes.gs` into this separate script project. Set script property `WEBHOOK_SECRET`, then deploy as a web app running as you with access Anyone. Put its `/exec` URL and matching secret into `THEME_SHEETS_WEBHOOK_URL` and `THEME_SHEETS_WEBHOOK_SECRET` on Wispbyte. Do not reuse the old poll webhook URL. Opening the `/exec` URL in a browser shows `{ "ok": true, "secretConfigured": true }` when the script is ready.

The script adds a `Theme vote events` tab and preserves other tabs. It logs submissions and vote changes, including running counts. Rows are events, not unique votes: use the latest event for a theme to read its totals; do not sum the running-count columns. Retry IDs prevent duplicate rows. No private poll ideas are sent to this theme sheet. Existing poll syncing continues independently. Until configured, theme events remain queued in SQLite.

## Firebase: save every vote

1. Open the [Firebase Console](https://console.firebase.google.com/), create or select your Firebase project, then create a **Cloud Firestore** database. Production mode is fine: the bot uses server credentials rather than public client rules.
2. Open **Project settings → Service accounts → Generate new private key**. Download the JSON key; never post it in Discord or commit it to Git.
3. Open that JSON file in a text editor, copy its complete contents, and put it into a Wispbyte environment variable named `FIREBASE_SERVICE_ACCOUNT_JSON`. Keep it on one line if Wispbyte does not preserve newlines. Set `FIREBASE_PROJECT_ID` to the `project_id` from the same JSON file, and set `FIREBASE_COLLECTION=october`.
4. Restart the bot. The console should print `Firebase vote sync enabled.`

New events appear at `october` (collection) → `jam-data` (document) → `votes` (collection). Theme documents have readable fields `theme`, `suggestedBy`, `suggestedAt`, `ayeCount`, `nayCount`, `noOpinionCount`, and `totalVotes`. They deliberately do not store the individual selected answer or custom written answer. Each document is an immutable audit event keyed by its UUID: `poll.published`, `poll.closed`, `vote.saved`, `theme.submitted`, or `theme.voted`. A person changing their vote creates a later event; use the latest event for the current state. Anyone can submit unlimited `/vote theme:...` suggestions.

## Email verification gate

Set `VERIFIED_ROLE_ID` to your Discord Verified role ID and put the bot role above it. Enable **Server Members Intent** in Discord Developer Portal → Bot → Privileged Gateway Intents. In Vercel and Wispbyte, set the same `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `DASHBOARD_URL`, and `VERIFICATION_LINK_SECRET`. Set Gmail SMTP values only in Vercel: `EMAIL_FROM`, `SMTP_USER`, and `SMTP_APP_PASSWORD` (a Google App Password, never your normal Gmail password). Set `VERIFICATION_SHEETS_WEBHOOK_URL` and `VERIFICATION_SHEETS_WEBHOOK_SECRET` in Wispbyte to the deployment from `VerifiedMembers.gs`.

New non-admin members receive a private email-verification link. The Vercel page sends a six-digit code, then the bot adds the Verified role and writes the Discord user ID, username, email, and verification time to the private Sheet. In the organiser dashboard, **Send verification DMs** queues a one-time campaign for existing eligible members. It skips admins, bots, and Verified members; DMs are paced and failures are recorded in Firebase.

This upload targets Node.js 25 and uses Wispbyte's Node.js image.

1. Sign in at [Wispbyte](https://wispbyte.com/client) and create one free server.
2. Choose the **Node.js** image. If a Node version selector is shown, select **25**.
3. Open **Files**, upload `bros-jam-wispbyte-node25.zip`, and extract it into the server's root. `index.js` and `package.json` must be visible at the top level, not inside another folder.
4. Open **Startup** and set the startup command to `node index.js`.
5. Leave **Additional Node Packages** blank. `package.json` installs `discord.js` and `dotenv` automatically.
6. Add the environment variables listed in `.env.example` through Wispbyte's environment-variable controls. Do not upload your real `.env` file.
7. Keep `POLL_DATA_DIR=./data` so `data/polls.sqlite` is visible in the file manager.
8. Start the server. The console should print `Ready as BRO 3#8539.`
9. After Wispbyte is online, stop the bot process running on your Mac. Only one process should use the Discord token.

Free Wispbyte servers stay online as long as you sign in at least once each month. Wispbyte archives inactive servers rather than deleting them, according to its current hosting guide.

## Backups

Download `data/polls.sqlite` after important polls. It contains every poll and vote. The upload archive intentionally excludes this database, your `.env`, dependencies, Git files, dashboard code, and tests.

## Connect the Google Sheet

The target workbook is `1vRXH96L9whUmVb5leykCxpx22IyqlPZp-RgLXUgN4bc`. Open it, then choose **Extensions → Apps Script**.

1. Replace the editor contents with `google-apps-script/Code.gs` from this package and save.
2. Open **Project Settings → Script properties** and add `WEBHOOK_SECRET` with a long random value.
3. Choose **Deploy → New deployment → Web app**. Execute as **Me** and allow access to **Anyone**. Authorize the script, then copy the `/exec` web-app URL.
4. In Wispbyte, set `GOOGLE_SHEETS_WEBHOOK_URL` to that URL and `GOOGLE_SHEETS_WEBHOOK_SECRET` to the same random value.
5. Restart the bot. Its console must print `Google Sheets sync enabled.`

The script creates `Polls` and `Votes` tabs automatically. Polls, closures, preset votes, and private ideas are queued locally and retried every 30 seconds. Private ideas appear only in the organiser spreadsheet and never in the public Discord message. Keep the spreadsheet private to trusted organisers.
