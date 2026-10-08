// AI Service powered by Groq API
const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/**
 * Process the transcript and generate the standup summary using Groq
 * @param {string} transcript 
 * @returns {Promise<Object>} The structured standup update
 */
async function processTranscript(transcript) {
    const prompt = `
You are an elite Standup Meeting Assistant. Your task is to process a meeting transcript and extract structured task updates for the whole team.

### Transcript
${transcript}

### Instructions
1. First, read the entire transcript and identify EVERY SINGLE PERSON who attended, spoke, or was assigned a task. You must not skip anyone.
2. For EVERY single person, extract their 1 to 4 key action items and deliverables. 
3. If someone assigns a task to another person, assign it to the person who has to DO the work, not the person who asked.
4. Extract explicit deadlines (e.g., "today afternoon", "by tomorrow morning", "by 4:00 PM today"). If none was mentioned, write "Not specified".
5. Be concise: combine related minor sub-steps into clear, action-first sentences.
6. You MUST include an entry in the "participants" array for EVERY person who attended the meeting.

Return ONLY a valid JSON object matching the following structure:
{
  "participants": [
    {
      "name": "Full Name",
      "tasks": [
        {
          "description": "Specific action item starting with an action verb",
          "deadline": "Deadline or Not specified"
        }
      ]
    }
  ]
}
`;

    try {
        const truncatedPrompt = prompt.length > 15000 ? prompt.substring(0, 15000) + "\n...[Transcript truncated to fit token limits]" : prompt;
        let response;
        try {
            response = await groq.chat.completions.create({
                model: "openai/gpt-oss-120b",
                max_tokens: 3000,
                messages: [
                    { role: "system", content: "You are a helpful assistant that strictly outputs JSON." },
                    { role: "user", content: truncatedPrompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
            });
        } catch (groqErr) {
            console.log("[AI Service] Falling back to qwen/qwen3.8-27b...", groqErr.message);
            response = await groq.chat.completions.create({
                model: "qwen/qwen3.8-27b",
                max_tokens: 950,
                messages: [
                    { role: "system", content: "You are a helpful assistant that strictly outputs JSON. Return only the JSON object." },
                    { role: "user", content: truncatedPrompt }
                ],
                temperature: 0.1,
            });
        }

        let jsonContent = response.choices[0].message.content;
        
        if (!jsonContent || jsonContent.trim() === '') {
            throw new Error("AI returned an empty response. The model may have timed out or hit a safety filter.");
        }

        console.log("--- RAW GROQ OUTPUT ---");
        console.log(jsonContent);
        console.log("-----------------------");

        // Clean markdown if Groq outputs backticks
        jsonContent = jsonContent.replace(/```(?:json)?\s*/g, '').trim();
        
        // Find the first { and last } to extract just the JSON
        const startIndex = jsonContent.indexOf('{');
        const endIndex = jsonContent.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1) {
            jsonContent = jsonContent.substring(startIndex, endIndex + 1);
        }
        
        return JSON.parse(jsonContent);
    } catch (error) {
        console.error("Error processing transcript with AI:", error);
        throw error;
    }
}

/**
 * Formats the JSON output into a nice Markdown summary for Teams
 * @param {Object} standupData 
 */
function formatMarkdownSummary(standupData) {
    let markdown = `## **Your Assigned Tasks**\n\n`;

    // Normalization logic: Build a map of Person -> Tasks
    const personTasks = {};

    // 1. If it followed our schema:
    if (standupData.participants && typeof standupData.participants[0] === 'object') {
        for (const p of standupData.participants) {
            const name = p.name || p.speaker || "Unknown Person";
            personTasks[name] = personTasks[name] || [];
            if (p.tasks) {
                p.tasks.forEach(t => {
                    const desc = t.description || t.task || t.title || "Task details not specified";
                    const deadline = t.deadline || t.due_date || "Not specified";
                    personTasks[name].push({ desc, deadline });
                });
            }
        }
    } 
    // 2. If it used Qwen's creative schema (participants is array of strings, action_items/updates hold tasks):
    else {
        // Init everyone
        if (Array.isArray(standupData.participants)) {
            standupData.participants.forEach(name => {
                if (typeof name === 'string') personTasks[name] = [];
            });
        }
        
        // Extract from "updates"
        if (Array.isArray(standupData.updates)) {
            standupData.updates.forEach(u => {
                const name = u.name || u.person || "Unknown Person";
                personTasks[name] = personTasks[name] || [];
                
                if (Array.isArray(u.in_progress)) {
                    u.in_progress.forEach(t => personTasks[name].push({ desc: t, deadline: "Not specified" }));
                }
                if (Array.isArray(u.completed)) {
                    u.completed.forEach(t => personTasks[name].push({ desc: `[Completed] ${t}`, deadline: "Completed" }));
                }
            });
        }

        // Extract from "action_items"
        if (Array.isArray(standupData.action_items)) {
            standupData.action_items.forEach(a => {
                const name = a.owner || a.assignee || "Unknown Person";
                personTasks[name] = personTasks[name] || [];
                const desc = a.task || a.description || "Action Item";
                const deadline = a.due_date || a.deadline || "Not specified";
                personTasks[name].push({ desc, deadline });
            });
        }
    }

    // Generate Output
    for (const [name, tasks] of Object.entries(personTasks)) {
        markdown += `**Person:** ${name}\n\n`;
        markdown += `&nbsp;&nbsp;&nbsp;&nbsp;**Tasks:**\n\n`;

        if (tasks.length === 0) {
            markdown += `&nbsp;&nbsp;&nbsp;&nbsp;1. No assigned tasks or updates.\n\n`;
        } else {
            tasks.forEach((task, index) => {
                markdown += `&nbsp;&nbsp;&nbsp;&nbsp;${index + 1}. ${task.desc} (Deadline: ${task.deadline})\n\n`;
            });
        }
    }

    markdown += `---\n\n`;
    markdown += `*Generated automatically by the AI Meeting Task Bot.*`;

    return markdown;
}

module.exports = {
    processTranscript,
    formatMarkdownSummary
};
