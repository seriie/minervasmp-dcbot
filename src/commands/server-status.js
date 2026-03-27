import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(uptimeMs) {
    const totalSeconds = Math.floor(uptimeMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
}

export default {
    data: new SlashCommandBuilder()
        .setName("server-status")
        .setDescription("Shows the status of the server."),
    execute: async (interaction, client) => {
        await interaction.deferReply();

        try {
            const url = "https://console-ptero.raznar.id/api/client/servers/187a513f/resources";
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    // "Authorization": `Bearer ${process.env.PTERODACTYL_API}`,
                }
            });

            console.log(response);

            if (!response.ok) {
                console.error("Pterodactyl API Error:", response.status, response.statusText);
                throw new Error("Failed to fetch server status.");
            }

            const payload = await response.json();
            const { current_state, is_suspended, resources } = payload.attributes;

            const stateColors = {
                running: "#10B981", // Green
                offline: "#EF4444", // Red
                starting: "#F59E0B", // Yellow
                stopping: "#F59E0B",
            };

            const stateEmojis = {
                running: "🟢",
                offline: "🔴",
                starting: "🟡",
                stopping: "🟡",
            };

            const embed = new EmbedBuilder()
                .setTitle("Minerva SMP - Server Status")
                .setColor(stateColors[current_state] || "#10B981")
                .addFields(
                    { name: "Status", value: `${stateEmojis[current_state] || "⚪"} ${current_state.charAt(0).toUpperCase() + current_state.slice(1)}`, inline: true },
                    { name: "Suspended?", value: is_suspended ? "Yes" : "No", inline: true },
                    { name: "Uptime", value: formatUptime(resources.uptime), inline: true },
                    { name: "CPU Usage", value: `${resources.cpu_absolute.toFixed(2)}%`, inline: true },
                    { name: "Memory Usage", value: formatBytes(resources.memory_bytes), inline: true },
                    { name: "Disk Usage", value: formatBytes(resources.disk_bytes), inline: true },
                    { name: "Network In", value: formatBytes(resources.network_rx_bytes), inline: true },
                    { name: "Network Out", value: formatBytes(resources.network_tx_bytes), inline: true }
                )
                .setTimestamp()
                .setFooter({ text: "Minerva SMP" });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error fetching server status:", error);
            const errorEmbed = new EmbedBuilder()
                .setTitle("Server Status")
                .setDescription("Failed to fetch server status. Please contact an administrator if the issue persists.")
                .setColor("#EF4444")
                .setTimestamp()
                .setFooter({ text: "Minerva SMP" });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
}