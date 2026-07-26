# Crack Chat 🀄

A friendly (slightly sassy) American Mah Jongg chatbot for your group — one shared
source of truth for rules questions, plus a personal journal for what you learn.

- Answers grounded in the [American Mah Jongg Association rulebook](https://guide.americanmahjonggassociation.com/).
- Powered by Claude (model: Sonnet).
- Per-person profile + journal saved in each player's own browser.

---

## Run it on your own computer

1. Get an API key at [console.anthropic.com](https://console.anthropic.com) and
   **set a monthly spending cap** there so it can never surprise you.
2. Copy `.env.example` to a new file named `.env` and paste your key into it.
3. In this folder, run:
   ```bash
   npm install
   npm start
   ```
4. Open http://localhost:3000

---

## Put it online for your group (Render, free to start)

The code is already set up for [Render](https://render.com). You'll do this once.

### 1. Put the code on GitHub
From this folder (a first commit is already made for you):
```bash
git remote add origin https://github.com/YOUR-USERNAME/crack-chat.git
git branch -M main
git push -u origin main
```
(Create an empty repo named `crack-chat` on GitHub first — no README/gitignore, since this folder already has them.)

### 2. Deploy on Render
1. Sign in to [render.com](https://render.com) with your GitHub account.
2. Click **New → Blueprint**, and pick your `crack-chat` repo.
3. Render reads `render.yaml` and configures everything. It will ask for one value:
   **`ANTHROPIC_API_KEY`** — paste your key from console.anthropic.com.
4. Click **Apply**. In a couple of minutes you'll get a public URL like
   `https://crack-chat.onrender.com` — share that with your group!

### Notes
- **Your API key is never in the code** (`.env` is git-ignored). You paste it into
  Render's dashboard, where it's stored as a secret.
- **Free tier sleeps** after ~15 min of no use, so the first message after a quiet
  spell takes ~30 seconds to wake up. To make it always-on, change `plan: free` to
  `plan: starter` in `render.yaml` ($7/mo) and redeploy.
- **To update the app later:** just `git push` — Render redeploys automatically.

---

## Cost
You pay per question (no subscription). With the rules cached, expect roughly
**$3–7/month** for a group of ~10 at typical usage. Your Render spending is separate
(free, or $7/mo if you go always-on).
