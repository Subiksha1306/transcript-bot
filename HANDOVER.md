# AI Standup Meeting Task Bot: Complete Project & Handover Document

> **Repository:** [https://github.com/Subiksha1306/transcript-bot](https://github.com/Subiksha1306/transcript-bot)  
> **Production Server (Render):** `https://meeting-transcript-bot-vdze.onrender.com`  
> **Bot ID:** `de10a9b3-43ef-49fc-ade2-35be731535f3`  
> **Teams App Package:** `appPackage/TranscriptBot.zip`

---

## 1. What Did You Build?

We built an **End-to-End Autonomous AI Meeting Analysis System** for Microsoft Teams that extracts every team member's assigned tasks, commitments, deadlines, and status updates directly from raw standup transcripts.

The solution provides **two interfaces**:
1. **Interactive Teams Chat Bot:** A custom Microsoft Teams app that colleagues can chat with 1-on-1 or @mention in channels. Anyone can paste a transcript or upload a `.txt` file to receive an immediate structured task list.
2. **Automated Cloud Webhook:** A Power Automate flow that monitors a OneDrive folder, automatically triggers whenever a meeting recording/transcript is saved, and posts the task summary into the designated Teams channel.

The output strictly follows an executive-ready format:
```markdown
## **Your Assigned Tasks**

**Person:** Subiksha Mohanasundaram
    **Tasks:**
    1. Test Teams Bot sideload package in test channel. (Deadline: by today afternoon)

**Person:** Haran Sinka
    **Tasks:**
    1. Implement heartbeat monitoring for PSR bot and ImpactX. (Deadline: by end of day)
```

---

## 2. Why Did You Build It?

### The Problems
- **Manual Overhead:** Standup meetings generate 15–35 minute recordings. Reading transcripts manually to track who is doing what is tedious and takes hours every week.
- **Lost & Forgotten Tasks:** Commitments made in casual dialogue (e.g., *"I'll check on that this afternoon"*) frequently get forgotten if not logged immediately.
- **Platform Constraints:**
  - Standard Microsoft Power Automate AI actions have strict context-length caps and struggle with massive 30-minute transcripts (often 10,000–30,000+ characters).
  - Teams desktop chat wraps pasted text in messy HTML tags (`<p>`, `<br>`, `<div>`), breaking basic AI models.
  - Native models frequently hallucinate varied JSON structures or fail strict validation rules.

### The Solution
We built a dedicated Node.js backend hosted 24/7 on Render, wired to **Groq's ultra-low-latency LPU infrastructure** running **Qwen 27B** (with automatic fallback to `gpt-oss-120b`). This delivers enterprise-grade task extraction in 3–5 seconds, completely free of local hardware dependencies.

---

## 3. How Does It Work? (Architecture & Data Flow)

```
[Method A: Automated Flow]
Teams Meeting -> Transcript Saved to OneDrive -> Power Automate -> HTTP POST /webhook
                                                                         │
                                                                         ▼
[Method B: Interactive Bot]                                       [Render Cloud Server]
User in Teams Chat/Channel -> Messages @TranscriptBot --------> HTTP POST /api/messages
                                                                         │
                                                                         ▼
                                                                [HTML & Stream Normalizer]
                                                                         │
                                                                         ▼
                                                                  [Groq Cloud API]
                                                            (Qwen 27B / max_tokens: 950)
                                                                         │
                                                                         ▼
                                                                [Smart Normalizer]
                                                           (Maps any JSON to clean Markdown)
                                                                         │
                                                                         ▼
                                                                [Response Sent Back]
                                                      (Direct Teams Reply or Channel Message)
```

### Detailed Component Breakdown:

1. **The Cloud Server (`index.js` on Render):**
   - Runs a Node.js Express server on port 10000.
   - Listens on two endpoints:
     - `POST /webhook`: Ingests raw text payloads from Power Automate. Handles large payloads using a manual byte chunk streamer and an `Expect: 100-continue` listener.
     - `POST /api/messages`: Uses the Microsoft **Bot Framework SDK (`CloudAdapter`)** to process direct messages from Microsoft Teams.
     - `GET /`: Serves a live health check.

2. **The Teams Bot Service (`services/teamsBotService.js`):**
   - Authenticates with Azure using **SingleTenant** credentials linked to your organization's Microsoft 365 Tenant ID (`af174864-f28c-4596-bae6-1123b5d70544`).
   - Automatically sanitizes incoming text by stripping Teams-specific HTML tags (`<p>`, `<div>`, `<br>`, HTML entities).
   - Filters out internal rich-text attachments while preserving genuine `.txt` file uploads.
   - Sends typing indicators and status updates while the LLM runs.

3. **The AI Extraction Engine (`services/aiService.js`):**
   - Communicates with Groq via low-latency API calls.
   - Utilizes an **Extreme Thoroughness Prompt** that forces the model to read line-by-line and identify all speakers and implicit commitments.
   - Limits output to `max_tokens: 950` to stay safely within Groq's 1000 OTPM (Output Tokens Per Minute) free-tier quota.
   - Implements an **automatic fallback**: if Qwen hits rate limits (429), it immediately retries against `openai/gpt-oss-120b`.

4. **The Smart Schema Normalizer (`services/aiService.js`):**
   - Large Language Models sometimes output customized JSON schemas (e.g., placing tasks in `action_items` vs `updates` vs `tasks`).
   - The normalizer dynamically parses any structure, extracts owners and deadlines, and formats them into the uniform Markdown layout.

---

## 4. What Do I Need to Know to Use and Maintain It?

### A. How Anyone in the Organization Can Use It
There are two ways for team members to use the bot:

1. **Direct Chat (Recommended):**
   - Send your colleague `appPackage/TranscriptBot.zip`.
   - In Teams: **Apps** → **Manage your apps** → **Upload an app** → **Upload a custom app** → select `TranscriptBot.zip`.
   - The bot appears in their chat list. They can paste any transcript or upload a `.txt` file to receive their tasks.
2. **Channel Integration:**
   - Go to any Team Channel → Channel settings → **Manage team** → **Apps** → **Upload a custom app**.
   - Add `TranscriptBot.zip`.
   - Team members can now @mention `@Transcript Bot` in the channel with a meeting transcript.

### B. Configuration & Environment Variables
The server relies on the following environment variables (already configured on Render and locally in `.env`):

| Variable Name | Description | Where It's Set |
|---|---|---|
| `GROQ_API_KEY` | Authentication key for Groq Cloud LLMs | Render & `.env` |
| `MicrosoftAppId` | Registered Bot Application ID (`de10a9b3-43ef-49fc-ade2-35be731535f3`) | Render & `.env` |
| `MicrosoftAppPassword` | Client Secret created in Teams Developer Portal | Render & `.env` |
| `MicrosoftAppType` | Authentication mode (`SingleTenant`) | Render & `.env` |
| `MicrosoftAppTenantId` | Organization Microsoft 365 Tenant ID (`af174864-f28c-4596-bae6-1123b5d70544`) | Render & `.env` |
| `PORT` | Server listening port (Render sets this dynamically) | Render & `.env` |

### C. Maintenance & Troubleshooting Cheatsheet

| Issue | Cause | Fix |
|---|---|---|
| **Bot says "Authorization has been denied" (401)** | Expired or incorrect client secret / wrong tenant | In Teams Developer Portal, generate a new secret under **Client secrets** and update `MicrosoftAppPassword` on Render. |
| **Error 429: Rate limit exceeded** | Too many tokens requested in a single minute | Already guarded with `max_tokens: 950` and auto-fallback to `gpt-oss-120b`. If needed, lower `max_tokens` to `800` in `aiService.js`. |
| **Power Automate returns 502 BadGateway** | The webhook URL is pointing to an old Ngrok URL | Update the Power Automate HTTP action URL to `https://meeting-transcript-bot-vdze.onrender.com/webhook`. |
| **Need to change the bot's prompt** | Adjusting what counts as a task or adding rules | Edit the `prompt` string in `services/aiService.js`, commit, and push to GitHub (`git push origin main`). Render will auto-deploy the change. |
| **Need to change the output format** | Modifying layout, bolding, or emojis | Edit the `formatMarkdownSummary` function in `services/aiService.js`, commit, and push to GitHub. |

---

## 5. Deployment & Codebase Structure

```
standup-meeting-bot/
├── appPackage/
│   ├── color.png             # 192x192 Teams app color icon
│   ├── outline.png           # 32x32 Teams app monochrome icon
│   ├── manifest.json         # Teams App manifest definition
│   └── TranscriptBot.zip     # Ready-to-import Teams sideload package
├── services/
│   ├── aiService.js          # Groq integration, Qwen 27B prompt, normalizer
│   └── teamsBotService.js    # Bot Framework CloudAdapter & Teams chat logic
├── .env.example              # Template for environment variables
├── .gitignore                # Excludes secrets, node_modules, and databases
├── index.js                  # Express server for /webhook and /api/messages
├── package.json              # Lightweight production dependencies
└── README.md                 # Project quickstart guide
```

### Automatic CI/CD:
Any commit pushed to the `main` branch of `https://github.com/Subiksha1306/transcript-bot` is automatically built and deployed to Render within 60–90 seconds. No manual server restarts or terminal commands are required!
