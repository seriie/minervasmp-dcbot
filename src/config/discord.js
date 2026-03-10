import { GatewayIntentBits } from "discord.js"

export default {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  prefix: "!"
}