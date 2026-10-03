# Bot environment on Wispbyte

Add these to Wispbyte's environment variables. Restart the bot after changes.

## Required for the Discord bot

| Name | Put this value |
| --- | --- |
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal → Bot |
| `DISCORD_CLIENT_ID` | Application ID from Discord Developer Portal |

## Required for dashboard controls and live votes

| Name | Put this value |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full one-line Firebase service-account JSON; keep private |
| `FIREBASE_COLLECTION` | `october` (or omit to use `october`) |

Use the **same Firebase values** in Vercel. The dashboard queues actions in Firestore. The bot reads them every 10 seconds and sends live poll totals back. The dashboard shows the bot as online when it has reported within 45 seconds.

## Required for email verification

| Name | Put this value |
| --- | --- |
| `DASHBOARD_URL` | Full production Vercel URL, like `https://bros-jam.vercel.app` |
| `VERIFIED_ROLE_ID` | Discord Verified role ID |
| `VERIFY_CHANNEL_ID` | Optional channel ID for `#verify` |
| `VERIFICATION_LINK_SECRET` | Long random string; identical on Wispbyte and Vercel |
| `VERIFICATION_SHEETS_WEBHOOK_URL` | `/exec` URL from `VerifiedMembers.gs` deployment |
| `VERIFICATION_SHEETS_WEBHOOK_SECRET` | Same `WEBHOOK_SECRET` set in that Apps Script's properties |

Verification is optional. The bot does not DM new members automatically or change channel access. The dashboard can send optional verification invitations when you explicitly request a campaign. Enable **Server Members Intent** in Discord Developer Portal → Bot for campaigns. Put the bot's role above the Verified role and give it **Manage Roles** to grant the role after verification. If you previously locked channels, restore `@everyone` → **View Channel** in Discord; existing permission overrides do not disappear when bot code changes.

## Optional bot values

| Name | Purpose |
| --- | --- |
| `DISCORD_GUILD_ID` | Fast slash-command registration in one server |
| `ANNOUNCEMENT_CHANNEL_ID` | Starting channel for `/announce` and dashboard announcements; editable in dashboard |
| `VOTE_CHANNEL_ID` | Starting channel for `/vote theme:...`; editable in dashboard |
| `BOT_ACTIVITY` | Starting Playing status; editable in dashboard |
| `JAM_NAME`, `JAM_URL`, `JAM_THEME`, `JAM_START`, `JAM_END`, `VOTING_END` | Starting jam details; dashboard changes to name/theme/URL persist |
| `JAM_RULES`, `JAM_RESOURCES` | Starting `/rules` and `/resources` text; editable in dashboard |
| `JAM_SCHEDULE_SHEET_ID`, `JAM_SCHEDULE_TIMEZONE` | Public jam calendar Sheet and timezone |
| `POLL_DATA_DIR` | Persistent local SQLite directory (default `./data`) |
| `GOOGLE_SHEETS_WEBHOOK_URL`, `GOOGLE_SHEETS_WEBHOOK_SECRET` | Optional old `/poll` Sheet mirror |
| `THEME_SHEETS_WEBHOOK_URL`, `THEME_SHEETS_WEBHOOK_SECRET` | Optional theme-vote Sheet mirror |

## Vercel-only values

Do not put these on Wispbyte: `DASHBOARD_PASSWORD`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_APP_PASSWORD`. Vercel also needs `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_COLLECTION`, `DASHBOARD_URL`, and the matching `VERIFICATION_LINK_SECRET`.

The dashboard can send plain-text email to one verified member or all verified members using these SMTP settings. It selects members with completed verification records in Firestore. Group mail uses BCC and is limited to 50 recipients per send.

Keep `.env`, the Gmail App Password, and the Firebase service-account JSON out of GitHub.
