# Transcript Bot (AI Standup Task Extractor)

Backend intelligence webhook for the Microsoft Teams Standup Meeting Bot. It receives raw meeting transcripts from Power Automate, processes them with high-speed LLMs via Groq (Qwen 27B), extracts tasks, deadlines, and status updates, and formats them into clean Markdown for Microsoft Teams channels.

---

## 🚀 How It Works

1. **Trigger:** A Teams meeting transcript (`.txt`) is saved to OneDrive.
2. **Power Automate:** Reads the transcript and sends an HTTP POST request to `/webhook`.
3. **Node.js Webhook:** 
   - Handles large payloads with raw byte chunk streaming and `Expect: 100-continue`.
   - Sends transcript to Groq (`qwen/qwen3.8-27b`).
   - Normalizes any extracted JSON structure (handling tasks, in-progress updates, and action items).
   - Generates formatted Markdown with explicit deadlines.
4. **Microsoft Teams:** Power Automate receives the summary and posts it directly to the designated channel.

---

## 🛠️ Local Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your `GROQ_API_KEY`:
   ```env
   GROQ_API_KEY=gsk_...
   PORT=8080
   ```

3. **Start the Server:**
   ```bash
   npm start
   ```
   The server will listen on port `8080` (or `PORT` if specified).

---

## ☁️ Deployment (e.g. Render)

1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect this repository (`Subiksha1306/transcript-bot`).
3. Set:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
4. In **Environment Variables**, add:
   - `GROQ_API_KEY`: your Groq API key
5. Once deployed, update your Power Automate HTTP action URI to:
   ```
   https://<your-render-app-name>.onrender.com/webhook
   ```
