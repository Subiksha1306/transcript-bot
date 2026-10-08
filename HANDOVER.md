# 🤖 AI Standup Task Bot: Simple Guide

---

## 1. What Did We Build?
Imagine you are in a 30-minute team meeting where everyone is talking, agreeing to do different things, and giving updates. 

Normally, someone has to write down everyone's tasks by hand. 

We built a **Smart Assistant Bot for Microsoft Teams** that does this automatically! 

You give the bot the meeting recording script (the transcript), and within 3 seconds, it reads the whole conversation and writes a neat to-do list for every single person, including their deadlines:

```text
Your Assigned Tasks

Person: Subiksha
    Tasks:
    1. Test the new Teams app. (Deadline: by today afternoon)

Person: Haran
    Tasks:
    1. Set up the website health monitor. (Deadline: by end of day)
```

---

## 2. Why Did We Build It?
1. **No More Forgotten Tasks:** During casual conversations, people say things like *"I'll check on that after lunch"*. It is very easy to forget these. The bot catches every single promise.
2. **Saves Hours of Time:** Nobody has to spend 30 minutes reading through thousands of lines of meeting text.
3. **Works for Everyone:** Anyone on the team can chat with the bot in Microsoft Teams and get their tasks instantly.

---

## 3. How Does It Work? (In 4 Easy Steps)

Think of it like a smart postman:

```
[1. You Give the Text] 
   You paste the meeting text in Teams (or upload the file).
           │
           ▼
[2. The Cloud Brain] 
   A 24/7 web server receives the message and cleans it up.
           │
           ▼
[3. The Super-Fast AI] 
   An ultra-fast AI model reads through the dialogue line-by-line, 
   finds who was promised what, and notes down any deadlines.
           │
           ▼
[4. The Neat Reply] 
   The bot types back into Teams with a tidy, organized list!
```

---

## 4. What Do I Need to Know to Use and Maintain It?

### How to Use It
1. **Send the app to a friend:** 
   Share the `TranscriptBot.zip` file with your teammate.
2. **Install it in Teams:** 
   Open Teams → click **Apps** → click **Manage your apps** → click **Upload a custom app** → choose `TranscriptBot.zip`.
3. **Chat with it:** 
   Open the chat with **Transcript Bot**, paste your meeting text, and press Enter!

---

### How to Maintain It (The Simple Checklist)
* **It runs 24/7 in the Cloud (on Render):** You do not need to keep your laptop on or keep any black command windows open. The bot is always awake.
* **If you want to change how the tasks look:** 
  You can change the instructions in the code (e.g., adding emojis or changing words). Once you save and push to GitHub, the cloud server updates itself automatically within 1 minute.
* **If it ever shows an error:** 
  It usually means the meeting text was either empty or the AI service took a quick breath. Just send the text one more time!
