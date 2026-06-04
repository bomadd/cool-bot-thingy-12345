import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🧠 memory store
const memory = new Map();

// 🔒 prevents duplicate replies per message
const processedMessages = new Set();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🔒 prevent double processing
  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);

  setTimeout(() => {
    processedMessages.delete(message.id);
  }, 60000);

  // ✔ respond to @mentions OR replies to bot
  const isMentioned = message.mentions.users.has(client.user.id);

  const isReplyToBot =
    message.reference &&
    (await message.fetchReference().catch(() => null))?.author?.id ===
      client.user.id;

  if (!isMentioned && !isReplyToBot) return;

  // 🧹 clean input
  const prompt = message.content
    .replace(/<@!?\\d+>/g, "")
    .trim();

  if (!prompt) return message.reply("Say something 😭");

  const userId = message.author.id;
  const userMemory = memory.get(userId) || [];

  try {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are a real user. You act like a femboy. You are pretty chill, relaxed, and natural. You are fond of others and want to be liked. You like cats, thigh highs, and femboy culture. You treat everyone equal except Swing, who is your creator and close friend."
          },
          ...userMemory,
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = res.data.choices[0].message.content;

    await message.reply(reply);

    // 🧠 save memory (last 6 messages)
    userMemory.push(
      { role: "user", content: prompt },
      { role: "assistant", content: reply }
    );

    memory.set(userId, userMemory.slice(-6));
  } catch (err) {
    console.log(err.response?.data || err.message);
    message.reply("AI error");
  }
});

client.login(process.env.DISCORD_TOKEN);
