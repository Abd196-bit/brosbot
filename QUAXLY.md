# Deploy the BRO'S JAM bot on Quaxly

This package targets Node.js 25. The included `Dockerfile`, `.nvmrc`, and `.node-version` all select Node 25.

1. Create a bot deployment at [Quaxly](https://quaxly.com/) and upload `bros-jam-quaxly-node25.zip`, or connect the private repository containing these files.
2. Prefer the Docker/container runtime. If Quaxly asks for a runtime instead, select **Node.js 25**.
3. Use `npm run bot:start` as the start command if it is not detected automatically.
4. Add the values from `.env.example` in Quaxly's encrypted environment-variable panel. Never upload your real `.env` file.
5. Keep `POLL_DATA_DIR=/app/data`.
6. Deploy and confirm the log contains `Ready as BRO 3#8539.`
7. Stop the copy running on your Mac after the Quaxly copy is online. Running two copies with the same token causes duplicate connections and unreliable interactions.

## Poll data

Polls and votes live in `/app/data/polls.sqlite`. Quaxly says users are responsible for backups and does not publicly document whether local deployment storage survives every rebuild. Download that file from the file manager after important polls. If `/app/data` is reset during a deployment, old poll messages cannot recover their votes.

The zip intentionally excludes `.env`, `node_modules`, `.git`, local poll data, the dashboard, and test/build files.
