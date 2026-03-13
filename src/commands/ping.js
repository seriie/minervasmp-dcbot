export default {
    name: "ping",
    description: "Check bot latency and database connection",
    async execute(message, client) {
        const sent = await message.reply('Pinging...');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        sent.edit(`Pong! 🏓\nLatency: \`${latency}ms\`\nAPI Latency: \`${apiLatency}ms\``);
    }
};
