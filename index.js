const express = require('express');
const dotenv = require('dotenv');
dotenv.config(); // Must be called before services!

const aiService = require('./services/aiService');
const dbService = require('./services/dbService');
const teamsBot = require('./services/teamsBotService');

const app = express();

// Bulletproof manual body parser
app.use((req, res, next) => {
    let rawBody = [];
    req.on('data', chunk => {
        rawBody.push(chunk);
    });
    req.on('end', () => {
        const bodyBuffer = Buffer.concat(rawBody);
        const bodyStr = bodyBuffer.toString('utf8');
        req.rawBody = bodyStr;

        // Parse JSON for Teams Bot or JSON clients
        if (req.path === '/api/messages' || req.headers['content-type']?.includes('application/json')) {
            try {
                req.body = JSON.parse(bodyStr);
            } catch (e) {
                req.body = bodyStr;
            }
        } else {
            req.body = bodyStr;
        }

        next();
    });
    req.on('error', (err) => {
        console.error("Stream error:", err);
        next(err);
    });
});

if (!process.env.GROQ_API_KEY) {
    console.error("❌ ERROR: GROQ_API_KEY is not set in your .env file!");
    process.exit(1);
}

// Health check endpoint
app.get('/', (req, res) => {
    res.send('Standup Meeting Bot is online! Ready for Webhooks (/webhook) and Teams Bot (/api/messages).');
});

// 1. Power Automate Webhook Endpoint
app.post('/webhook', async (req, res) => {
    console.log(`\n[${new Date().toISOString()}] Received POST /webhook`);
    console.log(`Content-Type: ${req.headers['content-type']}`);
    console.log(`Body Length: ${req.body ? req.body.length : 0}`);
    console.log(`Body Content Preview: ${typeof req.body === 'string' ? req.body.substring(0, 100) : req.body}`);

    try {
        let rawTranscript = req.body;
        
        // If Power Automate sent it as JSON, express.text made it a string. We can try to parse it.
        if (typeof rawTranscript === 'string' && rawTranscript.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(rawTranscript);
                if (parsed['$content']) {
                    console.log("Decoding base64 $content from Power Automate JSON wrapper...");
                    rawTranscript = Buffer.from(parsed['$content'], 'base64').toString('utf-8');
                }
            } catch (e) {
                // Not JSON, just normal text that starts with {
            }
        }

        if (!rawTranscript || typeof rawTranscript !== 'string' || rawTranscript.trim() === '') {
            console.error("❌ Rejected: No valid transcript provided.");
            return res.status(400).send('No transcript provided.');
        }

        console.log("==========================================");
        console.log("🧠 Processing Transcript with AI...");
        console.log("==========================================");

        // Process with Groq
        const standupData = await aiService.processTranscript(rawTranscript);

        console.log("\n✅ Standup Summary Generated Successfully!");
        
        // Generate Markdown
        const markdown = aiService.formatMarkdownSummary(standupData);

        // Return the formatted Markdown back to Power Automate
        res.status(200).send({ summary: markdown });

    } catch (error) {
        console.error("\n❌ An error occurred during processing:", error);
        res.status(500).send({ error: 'Failed to process transcript.' });
    }
});

// 2. Microsoft Teams Direct Bot Endpoint (Bot Framework Activity Handler)
app.post('/api/messages', async (req, res) => {
    console.log(`\n[${new Date().toISOString()}] Received POST /api/messages (Teams Bot Activity)`);
    try {
        await teamsBot.adapter.process(req, res, async (context) => {
            await teamsBot.bot.run(context);
        });
    } catch (err) {
        console.error("Teams Bot handler error:", err);
        if (!res.headersSent) {
            res.status(500).send({ error: 'Internal bot processing error' });
        }
    }
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log(`  - Webhook URL:   http://localhost:${PORT}/webhook`);
    console.log(`  - Teams Bot URL: http://localhost:${PORT}/api/messages`);
});

server.on('checkContinue', (req, res) => {
    console.log("👀 Received Expect: 100-continue. Telling Power Automate to send the body!");
    res.writeContinue();
    server.emit('request', req, res);
});

// Force event loop to stay alive in this specific environment
setInterval(() => {}, 1000 * 60 * 60);
