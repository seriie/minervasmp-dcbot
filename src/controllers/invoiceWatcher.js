import { EmbedBuilder } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

let lastChecked = Date.now();

export const startWatcher = (client) => {
    const channelId = process.env.DISCORD_PAYMENT_CHANNEL;
    const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";

    if (!channelId) {
        console.warn("⚠️ DISCORD_PAYMENT_CHANNEL is not set. Invoice watcher will not send messages.");
        return;
    }

    setInterval(async () => {
        try {
            // Fetch recent invoices from backend API
            const response = await fetch(`${backendUrl}/api/invoices?since=${lastChecked}`);
            if (!response.ok) return;

            const data = await response.json();
            
            if (data.success && data.invoices && data.invoices.length > 0) {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel) {
                    console.error(`❌ Could not find channel ${channelId}`);
                    return;
                }

                // Process new invoices
                for (const invoice of data.invoices) {
                    console.log(invoice.username);
                    const embed = new EmbedBuilder()
                        .setColor("#10B981") // Emerald Green
                        .setTitle(`💰 Donation: \`${invoice.id}\``)
                        .setDescription("Thank you for supporting Minerva SMP!")
                        .addFields(
                            { name: ":bust_in_silhouette: Minecraft Username", value: invoice.username ? `**${invoice.username}**` : "*Anonymous*", inline: false },
                            { name: ":moneybag: Amount", value: `$${parseFloat(invoice.amount).toLocaleString('id-ID')} USD`, inline: true },
                            { name: ":moneybag: Fee", value: `$${parseFloat(invoice.fee).toLocaleString('id-ID')} USD`, inline: true },
                            { name: ":bank: Gateway", value: String(invoice.gateway).toUpperCase(), inline: true }
                        )
                        .setTimestamp(new Date(invoice.createdAt))
                        .setFooter({ text: "Minerva SMP Invoice System" });

                    if (invoice.message) {
                        embed.addFields({ name: ":envelope: Message", value: `"${invoice.message}"`, inline: false });
                    }
                    embed.addFields({ name: ":id: Transaction ID", value: `\`${invoice.transactionId}\``, inline: false });

                    await channel.send({ embeds: [embed] });

                    // Update lastChecked so we don't alert the same invoice again
                    const invoiceTime = new Date(invoice.createdAt).getTime();
                    if (invoiceTime >= lastChecked) {
                        // Adding 1 millisecond so we query strictly *after* this invoice
                        lastChecked = invoiceTime + 1;
                    }
                }
            }
        } catch (error) {
            console.error("🔍 Invoice Watcher Error checking API:", error.message);
        }
    }, 10000); // Poll every 10 seconds

    console.log(`📡 Started polling ${backendUrl} for new invoices every 10s...`);
};
