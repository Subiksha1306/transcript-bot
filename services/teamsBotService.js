const { ActivityHandler, CloudAdapter, ConfigurationBotFrameworkAuthentication } = require('botbuilder');
const axios = require('axios');
const aiService = require('./aiService');

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppId: process.env.MicrosoftAppId,
    MicrosoftAppPassword: process.env.MicrosoftAppPassword,
    MicrosoftAppType: process.env.MicrosoftAppType || 'SingleTenant',
    MicrosoftAppTenantId: process.env.MicrosoftAppTenantId
});

const adapter = new CloudAdapter(botFrameworkAuthentication);

// Error handler for adapter
adapter.onTurnError = async (context, error) => {
    console.error(`\n[Teams Bot] Unhandled turn error:`, error);
    await context.sendActivity(`⚠️ Error: ${error.message || 'An error occurred while processing your request.'}`);
};

class StandupTeamsBot extends ActivityHandler {
    constructor() {
        super();

        this.onMessage(async (context, next) => {
            let rawText = (context.activity.text || '').trim();

            // Check if user uploaded a real file attachment (.txt)
            if (context.activity.attachments && context.activity.attachments.length > 0) {
                const attachment = context.activity.attachments[0];
                
                // Only download if it's a real file (not Teams internal text/html)
                if (attachment.contentType !== 'text/html' && attachment.name) {
                    console.log(`[Teams Bot] Received file attachment: ${attachment.name}`);
                    try {
                        let downloadUrl = attachment.contentUrl;
                        if (attachment.content && attachment.content.downloadUrl) {
                            downloadUrl = attachment.content.downloadUrl;
                        }

                        if (downloadUrl) {
                            await context.sendActivity(`📥 Downloading transcript: ${attachment.name}...`);
                            const response = await axios.get(downloadUrl, { responseType: 'text' });
                            if (response.data) {
                                rawText = response.data;
                            }
                        }
                    } catch (err) {
                        console.error('[Teams Bot] Error downloading file:', err.message);
                    }
                }
            }

            // Clean Teams HTML formatting and @mentions
            rawText = rawText
                .replace(/<at>.*?<\/at>/gi, '')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n')
                .replace(/<\/div>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .trim();

            // Quick greetings / help
            if (!rawText || rawText.toLowerCase() === 'hi' || rawText.toLowerCase() === 'hello' || rawText.toLowerCase() === 'help') {
                await context.sendActivity(
                    "👋 **Hi! I am your AI Standup Task Extractor Bot.**\n\n" +
                    "To use me, simply:\n" +
                    "1. **Paste any Teams meeting transcript** directly here in the chat, OR\n" +
                    "2. **Upload a `.txt` transcript file**.\n\n" +
                    "I will extract everyone's tasks, deadlines, and status updates for you!"
                );
                await next();
                return;
            }

            // Send typing indicator
            await context.sendActivity({ type: 'typing' });

            try {
                console.log(`[Teams Bot] Processing transcript (${rawText.length} characters)...`);
                await context.sendActivity("🧠 Analyzing meeting transcript and extracting assigned tasks...");

                const standupData = await aiService.processTranscript(rawText);
                const summaryMarkdown = aiService.formatMarkdownSummary(standupData);

                // Send the formatted reply
                await context.sendActivity(summaryMarkdown);
            } catch (err) {
                console.error('[Teams Bot] Processing error:', err);
                await context.sendActivity(`❌ Failed to process the transcript: ${err.message || 'Error occurred during AI processing'}`);
            }

            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(
                        "👋 **Welcome! I am your AI Standup Task Extractor Bot.**\n\n" +
                        "Send me any meeting transcript (paste the text or upload a `.txt` file), and I'll extract everyone's assigned tasks!"
                    );
                }
            }
            await next();
        });
    }
}

const bot = new StandupTeamsBot();

module.exports = {
    adapter,
    bot
};
