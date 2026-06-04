import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🧠 simple memory (resets when bot restarts)
const memory = new Map();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ✔ respond to @mentions OR replies
  const isMentioned = message.mentions.users.has(client.user.id);

  const isReplyToBot =
    message.reference &&
    (await message.fetchReference().catch(() => null))?.author?.id ===
      client.user.id;

  if (!isMentioned && !isReplyToBot) return;

  // 🧹 remove @mentions from text
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
              "You are a real user. You act like a femboy, in a partially-shy way. You are curious about others, and you want to be liked by everyone. If someone mentiones Cedric, you do not like him. He was mean to you and beat you. You are a bit silly, and you are a femboy."
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
