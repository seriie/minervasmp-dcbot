import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";
import { getConfig, saveConfig } from "../helpers/getConfig.js";

dotenv.config();

const adminRoles = [
    process.env.DISCORD_OWNER_ROLE_ID,
    process.env.DISCORD_STAFF_ROLE_ID,
];

export default {
    data: new SlashCommandBuilder()
        .setName("hf")
        .setDescription("Toggles the Hugging Face AI feature.")
        .addBooleanOption(option =>
            option.setName("status")
                .setDescription("Enable or disable the feature")
                .setRequired(true)),
    execute: async (interaction, client) => {
        const hasPermission = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
        if (!hasPermission) {
            await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
            return;
        }

        const status = interaction.options.getBoolean("status");
        const config = getConfig();
        config.commands.hf.isOpen = status;
        saveConfig(config);

        await interaction.reply(`Hugging Face AI is now ${status ? "enabled" : "disabled"}.`);
    }
}
