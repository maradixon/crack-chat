import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { SYSTEM_PROMPT } from "./rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\n  ⚠  ANTHROPIC_API_KEY is not set.\n" +
      "     Copy .env.example to .env and paste your key from console.anthropic.com\n"
  );
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(__dirname, "public")));

// Keep only the fields the API needs, cap history length, and clamp sizes so a
// misbehaving client can't blow up a request.
function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-20) // last 20 turns is plenty of context for a rules chat
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

app.post("/api/chat", async (req, res) => {
  const messages = sanitizeMessages(req.body?.messages);
  if (messages.length === 0) {
    return res.status(400).json({ error: "No message to answer." });
  }
  if (messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "Last message must be from the user." });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "disabled" }, // snappy replies; answers are grounded in the rules context
      // The rules live in a cached system block, so repeat questions bill the
      // ~0.1x cache-read rate instead of full price.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    stream.on("text", (delta) => res.write(delta));
    await stream.finalMessage();
    res.end();
  } catch (err) {
    console.error("Chat error:", err?.message || err);
    // If we haven't sent anything yet, return a clean JSON error; otherwise
    // append a note to the already-streaming response.
    if (!res.headersSent || !res.writableEnded) {
      const msg =
        err?.status === 401
          ? "Crack Chat can't reach Claude — the API key looks invalid. Check your .env file."
          : "Oof, something went sideways on my end. Give it another shot in a moment.";
      if (!res.headersSent) {
        res.status(500).json({ error: msg });
      } else {
        res.write(`\n\n⚠ ${msg}`);
        res.end();
      }
    }
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, keySet: Boolean(process.env.ANTHROPIC_API_KEY) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  🀄  Crack Chat is live at http://localhost:${PORT}\n`);
});
