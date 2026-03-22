import { SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";
import { getConfig, saveConfig } from "../helpers/getConfig.js";

dotenv.config();

const ownerId = process.env.OWNER_DISCORD_ID;

const config = getConfig();

export default {
    data: new SlashCommandBuilder()
        .setName("unban-command")
        .setDescription("Unbans a user from using command.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to unban")
                .setRequired(true)),
    execute: async (interaction) => {
        const user = interaction.options.getUser("user");

        const hasPermission = interaction.user.id === ownerId;
        const alreadyBanned = config.commands.bannedId.includes(user.id);

        if (!hasPermission) {
            await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
            return;
        }

        if (!alreadyBanned) {
            await interaction.reply({ content: `<@${user.id}> is not banned.` });
            return;
        }
    
        const member = interaction.guild.members.cache.get(user.id)
            ?? await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            await interaction.reply({ content: "User not found in this server.", ephemeral: true });
            return;
        }

        config.commands.bannedId = config.commands.bannedId.filter(id => id !== user.id);
        saveConfig(config);

        await interaction.reply(`✅ Unbanned <@${user.id}> from using commands`);
    }
}
