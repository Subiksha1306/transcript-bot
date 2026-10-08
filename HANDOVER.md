# 🤖 AI Standup Meeting Task Bot — Beginner-Friendly Guide

> **GitHub Repository:** [https://github.com/Subiksha1306/transcript-bot](https://github.com/Subiksha1306/transcript-bot)  
> **Live Server:** `https://meeting-transcript-bot-vdze.onrender.com`  
> **App Download:** `appPackage/TranscriptBot.zip` inside the repo

---

## 1. What Did We Build?

We built a smart **AI Bot for Microsoft Teams** that reads your daily standup meeting transcripts and automatically extracts **who has to do what, along with their deadlines**.

Instead of someone having to read through a 30-minute meeting text file to remember their work, the bot generates a clean, organized task list in seconds:

```markdown
## **Your Assigned Tasks**

**Person:** Subiksha Mohanasundaram
    **Tasks:**
    1. Test the Teams Bot package in the test channel. (Deadline: by today afternoon)

**Person:** Haran Sinka
    **Tasks:**
    1. Implement heartbeat monitoring for the portal. (Deadline: by end of day)
```

You can use it in **two different ways**:
1. **Chat directly with the bot in Teams:** Just open the bot's chat, paste your meeting transcript (or upload the `.txt` file), and hit send. The bot replies with the task list!
2. **Automatic mode:** Whenever a meeting ends and the transcript is saved to OneDrive, an automated workflow (Power Automate) sends it to the bot and posts the summary directly into your team's channel.

---

## 2. Why Did We Build It?

* **Saves Time:** Standup meetings can be 20 to 35 minutes long. Reading through pages of text to write down action items takes 15–30 minutes every single day. The bot does it in **3 seconds**.
* **No Forgotten Tasks:** People often say things casually in meetings like *"I'll check on that by evening"*. These small tasks are easily forgotten. The bot has an "extreme thoroughness" rule that catches every single commitment.
* **Handles Long Meetings:** Standard tools often crash or give up when text files are too long. We built a custom server that can handle huge transcripts smoothly.

---

## 3. How Does It Work? (In Plain English)

Think of the bot as a 3-step pipeline:

```
[ Step 1: Input ]                 [ Step 2: Brain ]                   [ Step 3: Output ]
You paste transcript in Teams  ──>  Cloud Server sends it to AI  ──>  Bot replies in Teams
(or file saved in OneDrive)         (Groq / Qwen LLM extracts tasks)   with the clean task list
```

1. **You Give It the Transcript:**
   You paste the text into the Teams chat or upload a `.txt` file.
2. **The Cloud Server (Render):**
   Our server is hosted online on **Render.com**. It receives the text, removes messy formatting/HTML tags, and passes the clean dialogue to our AI.
3. **The AI (Groq + Qwen):**
   We use an AI model hosted on **Groq** called **Qwen 27B**. Groq is an ultra-fast AI engine that processes text in seconds. The AI reads the meeting line-by-line, figures out who spoke, finds their commitments and deadlines, and returns them.
4. **The Bot Replies:**
   Our server turns that information into neat Markdown text and sends it right back to Microsoft Teams!

---

## 4. How Can I (or Anyone on the Team) Use It?

### Method A: Use It as a Personal Bot in Teams (Recommended)
1. Download the `TranscriptBot.zip` file from the `appPackage` folder in our GitHub repo.
2. Open **Microsoft Teams**.
3. Click **Apps** on the left sidebar → click **Manage your apps** at the bottom.
4. Click **Upload an app** → **Upload a custom app** → select `TranscriptBot.zip`.
5. Click **Add**.
6. The bot will appear in your chats! Open it, type `hi`, or paste any meeting transcript to get your tasks.

### Method B: Add It to a Team Channel
1. Go to your team channel in Microsoft Teams.
2. Click the channel settings (or **Manage Team** → **Apps**).
3. Upload `TranscriptBot.zip`.
4. Anyone in the channel can now type `@Transcript Bot <paste transcript>` to get the summary for the whole team!

---

## 5. What Do I Need to Know to Maintain It?

As a maintainer, here are the few simple things you need to know:

### 1. Where Does Everything Live?
* **Code:** On GitHub at `https://github.com/Subiksha1306/transcript-bot`.
* **Hosting:** The server is running 24/7 on **Render** (`https://meeting-transcript-bot-vdze.onrender.com`).
  * *Tip:* Whenever you push new code to the `main` branch on GitHub, Render automatically updates itself! You don't have to restart anything manually.

### 2. The Secret Keys (Environment Variables)
The server needs a few secret keys to work. These are already saved on Render:
* `GROQ_API_KEY`: The key that allows the server to talk to the Groq AI model.
* `MicrosoftAppId` & `MicrosoftAppPassword`: The username and password that allows the server to send messages back into Microsoft Teams.
* `MicrosoftAppTenantId`: Your company's Microsoft 365 ID so Teams knows the bot belongs to your company.

### 3. How to Change What the AI Looks For
If Arun or your manager asks you to change how tasks are extracted (e.g. *"Also look for blockers"* or *"Include greetings"*):
1. Open `services/aiService.js`.
2. Look at the `prompt` text near the top.
3. Edit the rules in plain English!
4. Commit and push to GitHub (`git push origin main`). Render will update automatically in 60 seconds.

### 4. Simple Troubleshooting

* **Q: The bot says "429 Rate limit exceeded"?**  
  * *Why:* Groq's free tier has a limit on how many words the AI can return at once.  
  * *Fix:* In `services/aiService.js`, we set `max_tokens: 950` and an automatic fallback to `gpt-oss-120b`. If it happens again, you can lower `max_tokens` to `800`.

* **Q: The bot isn't replying in Teams?**  
  * *Check 1:* Open `https://meeting-transcript-bot-vdze.onrender.com/` in your browser. If you see `"Standup Meeting Bot is online!"`, the server is alive.
  * *Check 2:* Check the **Teams Developer Portal** → make sure the bot's endpoint address is set to:  
    `https://meeting-transcript-bot-vdze.onrender.com/api/messages`

* **Q: A colleague wants to use it?**  
  * Just send them `TranscriptBot.zip`. They don't need to install Node.js, run commands, or touch any code!
