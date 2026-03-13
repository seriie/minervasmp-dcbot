import dotenv from "dotenv";
import { Client, Collection } from "discord.js";
import discordConfig from "./config/discord.js";
import { startWatcher } from "./controllers/invoiceWatcher.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client(discordConfig);
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    import(`file://${filePath}`).then(module => {
        const command = module.default;
        if ('name' in command && 'execute' in command) {
            client.commands.set(command.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`);
        }
    });
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Start the Invoice Watcher polling loop
  startWatcher(client);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(discordConfig.prefix)) return;

  const args = message.content.slice(discordConfig.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);

  if (!command) return;

  try {
      await command.execute(message, client, args);
  } catch (error) {
      console.error(error);
      await message.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);