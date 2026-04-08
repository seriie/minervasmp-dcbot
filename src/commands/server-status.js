import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("server-status")
        .setDescription("Shows the status of the server."),
    execute: async (interaction, client) => {
        await interaction.deferReply();

        try {
            const serverIp = process.env.MINECRAFT_SERVER_IP || "minervasmp.raznar.net:25080";
            const url = `https://api.mcsrvstat.us/2/${serverIp}`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error("Failed to fetch server status.");
            }

            const payload = await response.json();

            if (!payload.online) {
                const offlineEmbed = new EmbedBuilder()
                    .setTitle("Minerva SMP - Server Status")
                    .setColor("#EF4444") // Red
                    .setDescription("🔴 **Server is currently Offline**")
                    .setTimestamp()
                    .setFooter({ text: "Minerva SMP" });
                
                return await interaction.editReply({ embeds: [offlineEmbed] });
            }

            const onlineCount = payload.players ? payload.players.online : 0;
            const maxPlayers = payload.players ? payload.players.max : 0;
            const playerList = payload.players && payload.players.list ? payload.players.list.join(", ") : "None";

            const embed = new EmbedBuilder()
                .setTitle("Minerva SMP - Server Status")
                .setColor("#10B981") // Green
                .addFields(
                    { name: "Status", value: "🟢 **Online**", inline: true },
                    { name: "Version", value: payload.version || "Unknown", inline: true },
                    { name: "Players", value: `${onlineCount}/${maxPlayers}`, inline: true },
                    { name: "Player List", value: playerList, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: "Minerva SMP" });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error fetching server status:", error);
            const errorEmbed = new EmbedBuilder()
                .setTitle("Server Status")
                .setDescription("Failed to fetch server status. Please try again later.")
                .setColor("#EF4444")
                .setTimestamp()
                .setFooter({ text: "Minerva SMP" });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
}