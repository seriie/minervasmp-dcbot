import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';

/** Format ms remaining into DD:HH:MM:SS */
function formatCountdown(ms) {
    if (ms <= 0) return '00:00:00:00';

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [days, hours, minutes, seconds]
        .map(n => String(n).padStart(2, '0'))
        .join(':');
}

/** Build the event embed */
function buildEmbed(name, description, eventDate, ms) {
    const countdown = formatCountdown(ms);
    const started = ms <= 0;

    return new EmbedBuilder()
        .setTitle(`🎉 ${name}`)
        .setDescription(description)
        .addFields(
            {
                name: '📅 Event Date',
                value: `<t:${Math.floor(eventDate.getTime() / 1000)}:F>`,
                inline: true,
            },
            {
                name: started ? '✅ Status' : '⏳ Countdown',
                value: started ? '**Event has started!**' : `\`${countdown}\``,
                inline: true,
            }
        )
        .setColor(started ? 0x57f287 : 0x5865f2)
        .setFooter({ text: started ? 'Event is live now!' : 'Countdown updates every 10 seconds' })
        .setTimestamp();
}

export default {
    data: new SlashCommandBuilder()
        .setName('create-event')
        .setDescription('Create a scheduled event with a live countdown in a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addStringOption(option =>
            option
                .setName('channel_id')
                .setDescription('The channel ID where the event embed will be posted')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Event name')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('Event description')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('event_date')
                .setDescription('Event date (e.g. 2026-04-01)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('event_time')
                .setDescription('Event time in 24h format (e.g. 20:00 or 20:00:00)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('content')
                .setDescription('Message content to send when the event starts')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const channelId = interaction.options.getString('channel_id');
        const name = interaction.options.getString('name');
        const description = interaction.options.getString('description');
        const dateInput = interaction.options.getString('event_date');
        const timeInput = interaction.options.getString('event_time');
        const content = interaction.options.getString('content');

        // Combine date + time and parse
        const combined = `${dateInput}T${timeInput}+07:00`; // WIB (UTC+7)
        const eventDate = new Date(combined);
        if (isNaN(eventDate.getTime())) {
            return interaction.reply({
                content: `❌ Invalid date/time: \`${dateInput}\` / \`${timeInput}\`\nDate format: \`2026-04-01\`, Time format: \`20:00\` or \`20:00:00\`.`,
                ephemeral: true,
            });
        }

        // Resolve the target channel
        let targetChannel;
        try {
            targetChannel = await client.channels.fetch(channelId);
        } catch {
            return interaction.reply({
                content: `❌ Could not fetch channel with ID \`${channelId}\`. Make sure the bot has access to it.`,
                ephemeral: true,
            });
        }

        if (!targetChannel || !targetChannel.isTextBased()) {
            return interaction.reply({
                content: `❌ Channel \`${channelId}\` is not a text-based channel.`,
                ephemeral: true,
            });
        }

        const now = Date.now();
        const msUntilEvent = eventDate.getTime() - now;

        if (msUntilEvent <= 0) {
            return interaction.reply({
                content: `❌ The event date \`${dateInput}\` is already in the past.`,
                ephemeral: true,
            });
        }

        // Send the initial embed
        const embed = buildEmbed(name, description, eventDate, msUntilEvent);
        let eventMessage;
        try {
            eventMessage = await targetChannel.send({ embeds: [embed] });
        } catch (err) {
            console.error('[create-event] Failed to send embed:', err);
            return interaction.reply({
                content: `❌ Failed to send the embed to <#${channelId}>. Check bot permissions.`,
                ephemeral: true,
            });
        }

        await interaction.reply({
            content: `✅ Event **${name}** created in <#${channelId}>! Countdown is live.`,
            ephemeral: true,
        });

        // === Live countdown ===
        // Update embed every 10 seconds (Discord rate limit safety)
        const UPDATE_INTERVAL_MS = 10_000;

        // Interval: only updates the countdown embed, never fires content
        const interval = setInterval(async () => {
            const remaining = eventDate.getTime() - Date.now();
            if (remaining <= 0) {
                clearInterval(interval);
                return;
            }
            try {
                const updatedEmbed = buildEmbed(name, description, eventDate, remaining);
                await eventMessage.edit({ embeds: [updatedEmbed] });
            } catch (err) {
                console.error('[create-event] Failed to update countdown embed:', err);
                clearInterval(interval);
            }
        }, UPDATE_INTERVAL_MS);

        // Timeout: fires exactly when the event starts (precise)
        setTimeout(async () => {
            clearInterval(interval);
            try {
                const startedEmbed = buildEmbed(name, description, eventDate, 0);
                await eventMessage.edit({ embeds: [startedEmbed] });
                await targetChannel.send({ content });
            } catch (err) {
                console.error('[create-event] Failed to fire event content:', err);
            }
        }, msUntilEvent);
    },
};
