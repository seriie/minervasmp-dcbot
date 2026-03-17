import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const adminRoles = [
    process.env.DISCORD_OWNER_ROLE_ID,
    process.env.DISCORD_STAFF_ROLE_ID,
    process.env.DISCORD_SERVER_MANAGER_ROLE_ID,
];

const bannedChannelId = process.env.DISCORD_BANNED_CHANNEL_ID;

export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Bans a user from the server.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to ban")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("The reason for the ban")
                .setRequired(true)),
    execute: async (interaction, client) => {
        const user = interaction.options.getUser("user");
        const bannedRoleId = process.env.DISCORD_BANNED_ROLE_ID;

        const hasPermission = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
        const alreadyBanned = interaction.guild.members.cache.get(user.id)?.roles.cache.has(bannedRoleId);

        if (!hasPermission) {
            await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
            return;
        }

        if (alreadyBanned) {
            await interaction.reply({ content: `<@${user.id}> is already banned.` });
            return;
        }

        if (!bannedRoleId) {
            await interaction.reply({ content: "❌ BANNED_ROLE_ID is not configured.", ephemeral: true });
            return;
        }
                
        console.log(user);
        const reason = interaction.options.getString("reason");
    
        const member = interaction.guild.members.cache.get(user.id)
            ?? await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            await interaction.reply({ content: "User not found in this server.", ephemeral: true });
            return;
        }

        await member.roles.add(bannedRoleId);
        await interaction.reply(`✅ Banned <@${user.id}> for: ${reason}`);

        const channel = await client.channels.fetch(bannedChannelId).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle("User Banned")
                .setDescription(`**Discord:** <@${user.id}>\n**user id:** \`${user.id}\`\n**Reason:** ${reason}\n**Banned by:** ${interaction.user.tag}`)
                .setColor("#FF0000")
                .setTimestamp()
                .setFooter({ text: "Minerva SMP" });
            channel.send({ embeds: [embed] });
        }
    }
}
