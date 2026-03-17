import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const adminRoles = [
    process.env.DISCORD_OWNER_ROLE_ID,
    process.env.DISCORD_STAFF_ROLE_ID,
    process.env.DISCORD_SERVER_MANAGER_ROLE_ID,
];

export default {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unbans a user from the server.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to unban")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("The reason for the unban")
                .setRequired(false)),
    execute: async (interaction, client) => {
        const hasPermission = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
        const bannedRoleId = process.env.DISCORD_BANNED_ROLE_ID;
        const bannedChannelId = process.env.DISCORD_BANNED_CHANNEL_ID;
        const unbannedChannelId = process.env.DISCORD_UNBANNED_CHANNEL_ID;

        if (!hasPermission) {
            await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
            return;
        }

        if (!bannedRoleId) {
            await interaction.reply({ content: "❌ DISCORD_BANNED_ROLE_ID is not configured.", ephemeral: true });
            return;
        }

        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") ?? "No reason provided";

        const member = interaction.guild.members.cache.get(user.id)
            ?? await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            await interaction.reply({ content: "User not found in this server.", ephemeral: true });
            return;
        }

        if (!member.roles.cache.has(bannedRoleId)) {
            await interaction.reply({ content: `<@${user.id}> is not banned.`, ephemeral: true });
            return;
        }

        await member.roles.remove(bannedRoleId);
        await interaction.reply(`✅ Unbanned <@${user.id}> for: ${reason}`);

        if (bannedChannelId) {
            const bannedChannel = await client.channels.fetch(bannedChannelId).catch(() => null);
            if (bannedChannel) {
                const messages = await bannedChannel.messages.fetch({ limit: 100 }).catch(() => null);
                if (messages) {
                    const banMessages = messages.filter(msg => {
                        if (!msg.author.bot) return false;
                        return msg.embeds.some(embed =>
                            embed.description?.includes(user.id)
                        );
                    });

                    for (const msg of banMessages.values()) {
                        await msg.delete().catch(() => null);
                    }
                }

                const unbannedChannel = await client.channels.fetch(unbannedChannelId).catch(() => null);
                const embed = new EmbedBuilder()
                    .setTitle("User Unbanned")
                    .setDescription(`**Discord:** <@${user.id}>\n**User ID:** \`${user.id}\`\n**Reason:** ${reason}\n**Unbanned by:** ${interaction.user.tag}`)
                    .setColor("#10B981")
                    .setTimestamp()
                    .setFooter({ text: "Minerva SMP" });
                unbannedChannel.send({ embeds: [embed] });
            }
        }
    }
}
