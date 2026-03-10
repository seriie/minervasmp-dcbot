import dotenv from "dotenv";
import { Client } from "discord.js";
import discordConfig from "./config/discord.js";

dotenv.config();

const client = new Client(discordConfig);

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(discordConfig.prefix)) return;

  const args = message.content.slice(discordConfig.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    message.reply("Pong!");
  }
});

client.login(process.env.DISCORD_TOKEN);