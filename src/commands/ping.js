import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and database connection'),
    async execute(interaction, client) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        await interaction.editReply(`Pong! 🏓\nLatency: \`${latency}ms\`\nAPI Latency: \`${apiLatency}ms\``);
    }
};
