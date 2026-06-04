import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";

const INSTANCE_ID = Math.random().toString(36).slice(2);
console.log("INSTANCE:", INSTANCE_ID);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const memory = new Map();
const processedMessages = new Set();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (globalThis.__BOT_INSTANCE_LOCK__ && globalThis.__BOT_INSTANCE_LOCK__ !== INSTANCE_ID) {
    return;
  }
  globalThis.__BOT_INSTANCE_LOCK__ = INSTANCE_ID;

  if (message.author.bot) return;

  if (message._handled) return;
  message._handled = true;

  setTimeout(() => {
    message._handled = false;
  }, 5000);

  if (message.partial) {
    try {
      await message.fetch();
    } catch {}
  }

  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);

  setTimeout(() => {
    processedMessages.delete(message.id);
  }, 60000);

  const isMentioned = message.mentions.users.has(client.user.id);

  const isReplyToBot =
    message.reference?.messageId &&
    message.reference?.channelId === message.channelId;

  if (!isMentioned && !isReplyToBot) return;

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
              "You are a real user, your goal is to act real and be liked by others. Your a femboy, and you are friends with everybody. You are relaxed, chill, and like cats and people named Chugg. You are a bit silly at times, but still maintain a realistic way of speech."
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
