import { EmbedBuilder } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

let lastChecked = Date.now();

// ─── Shared embed builder ──────────────────────────────────────────────────
const buildInvoiceEmbed = (invoice) => {
    const embed = new EmbedBuilder()
        .setColor("#10B981") // Emerald Green
        .setTitle(`💰 Donation: \`${invoice.id}\``)
        .setDescription("Thank you for supporting Minerva SMP!")
        .addFields(
            { name: ":bust_in_silhouette: Username", value: invoice.username ? `**${invoice.username}**` : "*Anonymous*", inline: false },
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

    return embed;
};

// ─── Reconciliation: compare DB invoices vs channel history ───────────────
const reconcileInvoices = async (client, channelId, backendUrl) => {
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            console.error(`❌ [Reconcile] Could not find channel ${channelId}`);
            return;
        }

        // 1. Collect all transaction IDs already posted in the channel.
        //    Fetch up to 100 messages and look for bot embed fields named ":id: Transaction ID".
        const postedTransactionIds = new Set();
        let lastMessageId = null;

        // Fetch in pages of 100 until we have up to 500 messages (5 pages),
        // covering the typical backlog without hammering the API.
        for (let page = 0; page < 5; page++) {
            const options = { limit: 100 };
            if (lastMessageId) options.before = lastMessageId;

            const messages = await channel.messages.fetch(options).catch(() => null);
            if (!messages || messages.size === 0) break;

            for (const msg of messages.values()) {
                if (!msg.author.bot) continue;
                for (const embed of msg.embeds) {
                    const txField = embed.fields?.find(f => f.name === ":id: Transaction ID");
                    if (txField) {
                        // Strip backticks and whitespace: `abc123` → abc123
                        postedTransactionIds.add(txField.value.replace(/`/g, "").trim());
                    }
                }
            }

            lastMessageId = messages.last()?.id;
            if (messages.size < 100) break; // No more messages to page through
        }

        console.log(`🔍 [Reconcile] Found ${postedTransactionIds.size} transaction ID(s) already posted in channel.`);

        // 2. Fetch all invoices from DB (last 30 days).
        const response = await fetch(`${backendUrl}/api/invoices/all`);
        if (!response.ok) {
            console.error("❌ [Reconcile] Failed to fetch invoices from backend.");
            return;
        }

        const data = await response.json();
        if (!data.success || !data.invoices) return;

        // 3. Find invoices NOT yet posted to the channel.
        const missing = data.invoices.filter(inv => !postedTransactionIds.has(inv.transactionId));

        if (missing.length === 0) {
            console.log("✅ [Reconcile] All DB invoices are already posted in the channel.");
            return;
        }

        console.log(`⚠️ [Reconcile] Found ${missing.length} invoice(s) not posted. Sending now...`);

        // 4. Send missing invoices.
        for (const invoice of missing) {
            const embed = buildInvoiceEmbed(invoice);
            await channel.send({ embeds: [embed] });
            console.log(`📨 [Reconcile] Sent missing invoice: ${invoice.transactionId}`);
        }
    } catch (error) {
        console.error("🔍 [Reconcile] Error during reconciliation:", error.message);
    }
};

// ─── Main watcher startup ─────────────────────────────────────────────────
export const startWatcher = (client) => {
    const channelId = process.env.DISCORD_PAYMENT_CHANNEL;
    const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";

    if (!channelId) {
        console.warn("⚠️ DISCORD_PAYMENT_CHANNEL is not set. Invoice watcher will not send messages.");
        return;
    }

    // ── Polling loop (every 10 seconds): send newly created invoices ─────
    setInterval(async () => {
        try {
            const response = await fetch(`${backendUrl}/api/invoices?since=${lastChecked}`);
            if (!response.ok) return;

            const data = await response.json();

            if (data.success && data.invoices && data.invoices.length > 0) {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel) {
                    console.error(`❌ Could not find channel ${channelId}`);
                    return;
                }

                for (const invoice of data.invoices) {
                    console.log(invoice.username);
                    const embed = buildInvoiceEmbed(invoice);
                    await channel.send({ embeds: [embed] });

                    const invoiceTime = new Date(invoice.createdAt).getTime();
                    if (invoiceTime >= lastChecked) {
                        lastChecked = invoiceTime + 1;
                    }
                }
            }
        } catch (error) {
            console.error("🔍 Invoice Watcher Error checking API:", error.message);
        }
    }, 10000); // Poll every 10 seconds

    // ── Reconciliation loop (every 5 minutes): catch anything that was missed ──
    const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    // Run once at startup after a short delay to give Discord client time to warm up
    setTimeout(() => {
        reconcileInvoices(client, channelId, backendUrl);
        setInterval(() => reconcileInvoices(client, channelId, backendUrl), RECONCILE_INTERVAL_MS);
    }, 15000); // wait 15 seconds after bot is ready before first reconciliation

    console.log(`📡 Started polling ${backendUrl} for new invoices every 10s...`);
    console.log(`🔄 Reconciliation check will run every ${RECONCILE_INTERVAL_MS / 60000} minutes.`);
};
