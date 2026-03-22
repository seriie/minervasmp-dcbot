import dotenv from "dotenv";
import { Client, Collection, REST, Routes } from "discord.js";
import discordConfig from "./config/discord.js";
import { startWatcher } from "./controllers/invoiceWatcher.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { huggingFace } from "./features/hugging-face/hf.js";
import { getConfig } from "./helpers/getConfig.js";

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
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    });
}

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log("Started refreshing application (/) commands.");

    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const commandsData = client.commands.map(cmd => cmd.data.toJSON());

        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.DISCORD_GUILD_ID),
            { body: commandsData }
        );

        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("Error registering slash commands: ", error);
    }

    // Start the Invoice Watcher polling loop
    startWatcher(client);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;
    await huggingFace(client, msg);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Block banned users from using any command
    const bannedId = getConfig().commands.bannedId;
    if (bannedId.includes(interaction.user.id)) {
        return interaction.reply({ content: "❌ You are banned from using commands." });
    }

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);