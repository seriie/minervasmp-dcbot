import { EmbedBuilder } from "discord.js";

export async function getAllPlayers(client) {
    const playerListChannelId = process.env.DISCORD_PLAYER_LIST_CHANNEL_ID;
    const serverIp = process.env.MINECRAFT_SERVER_IP || "minervasmp.raznar.net:25080";
    const url = `https://api.mcsrvstat.us/3/${serverIp}`;

    const channel = await client.channels.fetch(playerListChannelId).catch(() => null);
    if (!channel) {
        console.error("Player list channel not found");
        return;
    }

    let messageToEdit = null;
    try {
        const messages = await channel.messages.fetch({ limit: 10 });
        messageToEdit = messages.find(m => m.author.id === client.user.id);
    } catch (e) {
        console.error("Failed to fetch messages for player list", e);
    }

    const update = async () => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch server status");
            const data = await response.json();

            let description = "";
            let color = "#10B981";

            if (!data.online) {
                color = "#EF4444";
                description = "🔴 **Server is currently Offline**";
            } else {
                const onlineCount = data.players ? data.players.online : 0;
                const maxPlayers = data.players ? data.players.max : 0;
                const playerList = data.players && data.players.list ? data.players.list : [];

                if (playerList.length > 0) {
                    const formattedList = playerList.map((player, index) => {
                        const playerName = typeof player === 'string' ? player : player.name;
                        return `**${index + 1}.** \`${playerName}\``;
                    }).join("\n");
                    
                    description = `🟢 **Server is Online**\n👥 **Players:** \`${onlineCount}/${maxPlayers}\`\n\n**Online Players:**\n${formattedList}`;
                } else {
                    description = `🟢 **Server is Online**\n👥 **Players:** \`${onlineCount}/${maxPlayers}\`\n\n*No players are currently online.*`;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle("🌐 Minerva SMP - Player List")
                .setDescription(description)
                .setColor(color)
                .setTimestamp()
                .setFooter({ text: "Minerva SMP | Auto-updates every 15 seconds" });

            // Gunakan endpoint gambar langsung dari mcsrvstat, bukan base64 dari data.icon
            embed.setThumbnail(`https://api.mcsrvstat.us/icon/${serverIp}`);

            if (messageToEdit) {
                await messageToEdit.edit({ embeds: [embed] }).catch(console.error);
            } else {
                messageToEdit = await channel.send({ embeds: [embed] }).catch(console.error);
            }
        } catch (error) {
            console.error("Error updating player list:", error);
        }
    };

    // Call update immediately on startup
    await update();

    // Then set interval for future updates
    setInterval(update, 15000);
}