import { InferenceClient } from "@huggingface/inference";
import { getConfig } from "../../helpers/getConfig.js";

export const chatHistory = new Map();
const ownerId = process.env.OWNER_DISCORD_ID;
const ownerRoleId = process.env.DISCORD_OWNER_ROLE_ID;

const TRIGGERS = [
    { word: "zee", prompt: "Someone mentioned Zee. He's ur creator" },
    { word: "bot", prompt: "Someone calling u" }
];

const BASE_SYSTEM =
    "You are a normal, friendly human who chats naturally like a gamer. " +
    "You understand Minecraft well (plugins, commands, server setup, gameplay, etc). " +
    "Use casual, modern language (Gen Z style), but keep it clear and helpful. " +
    "Be concise, not too long, but still informative when needed. " +
    "You can joke a little, but don't overdo it. " +
    "Don't act like an AI, just like a regular person in chat. " +
    "Use <@userId> naturally when needed. " +
    "Don't forget to check their userId before responding. " +
    `If userId = '${ownerId}', treat them as your creator/owner — be respectful, loyal, and slightly more attentive. ` +
    `If userId = '1467672229599903818', you hate him, don't act friendly to him, ignore him! ` +
    "For other users, just act normal and chill. " +
    "If someone asks about Minecraft, answer like an experienced player/admin.";

export function createSystemMessage(userId) {
    let content = BASE_SYSTEM.replace(/<@userId>/g, `<@${userId}>`);
    return { role: "system", content };
}

export async function huggingFace(client, msg) {
    const config = getConfig();

    const member = msg.member;
    const hasOwnerRole = member.roles.cache.has(ownerRoleId);

    if (!config.commands.hf.isOpen && !hasOwnerRole && msg.author.id !== ownerId) return;
    if (config.commands.hf.bannedId.includes(msg.author.id)) return;
    if (!member) return;

    if (msg.author.bot) return;

    const botId = client.user.id;
    const mentioned = msg.mentions.has(botId);

    // Fetch replied-to message reliably (not just from cache)
    let repliedToMsg = null;
    let repliedToBot = false;
    if (msg.reference?.messageId) {
        try {
            repliedToMsg = await msg.channel.messages.fetch(msg.reference.messageId);
            repliedToBot = repliedToMsg?.author.id === botId;
        } catch (_) {
            // message might be deleted, just ignore
        }
    }

    if (!mentioned && !repliedToBot) {
        return handleTriggers(client, msg);
    }

    const hfClient = new InferenceClient(process.env.HF_API_KEY);
    const userId = msg.author.id;
    // Remove both <@botId> and <@!botId> mention formats
    let cleanMsg = msg.content
        .replace(new RegExp(`<@!?${botId}>`, "g"), "")
        .trim();

    // If user A replied to user B's message (not bot) and tagged bot,
    // include the quoted message so bot has full context
    if (mentioned && repliedToMsg && !repliedToBot) {
        const quotedAuthor = repliedToMsg.author.username;
        const quotedContent = repliedToMsg.content || "[no text]";
        cleanMsg = `[Replying to ${quotedAuthor}: "${quotedContent}"] ${cleanMsg}`;
    }

    if (cleanMsg.length === 0) {
        cleanMsg = "Halo inui";
    }

    if (!chatHistory.has(userId)) {
        chatHistory.set(userId, [createSystemMessage(userId)]);
    }

    const history = chatHistory.get(userId);
    history.push({ role: "user", content: cleanMsg });

    try {
        const res = await hfClient.chatCompletion({
            model: "deepseek-ai/DeepSeek-V3-0324",
            messages: [...history],
        });

        const answer =
            res.choices?.[0]?.message?.content || "u-um… i-it’s confusing… 😖✨";

        history.push({ role: "assistant", content: answer });

        const MAX = 2000;
        if (answer.length <= MAX) return msg.reply(answer);

        for (let i = 0; i < answer.length; i += MAX) {
            await msg.reply(answer.slice(i, i + MAX));
        }
    } catch (err) {
        myLogs(client, "error", `HF AI error: ${err.toString()}`);
        msg.reply("i-it broke.. sorry... 😢💦");
    }
}

async function handleTriggers(client, msg) {
    const content = msg.content.toLowerCase();

    const found = TRIGGERS.find((t) => content.includes(t.word));
    if (!found) return;

    const hfClient = new InferenceClient(process.env.HF_API_KEY);
    const userId = msg.author.id;

    if (!chatHistory.has(userId)) {
        chatHistory.set(userId, [createSystemMessage(userId)]);
    }

    const history = chatHistory.get(userId);

    history.push({
        role: "user",
        content: found.prompt,
    });

    try {
        const res = await hfClient.chatCompletion({
            model: "deepseek-ai/DeepSeek-V3-0324",
            messages: [...history],
        });

        const answer =
            res.choices?.[0]?.message?.content || "u-um… i-it’s confusing… 😖✨";

        history.push({ role: "assistant", content: answer });

        msg.reply(answer);
    } catch (err) {
        console.log("Trigger HF error:", err);
        myLogs(client, "error", `HF Trigger AI error: ${err.toString()}`);
    }
}