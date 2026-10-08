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
You are an elite Standup Meeting Assistant. Your task is to process a meeting transcript and convert it into structured work updates.

### Transcript
${transcript}

### What counts as a task
1. Work a person says they will do today or next.
2. Work someone assigns to another person (assign it to the person who has to do it).
3. Commitments a person makes in reply.
4. Follow-ups and deliverables with deadlines.
5. General status updates (e.g. "I deployed the docker app"). Treat these as completed tasks.

### Strict Rules
1. You must identify EVERY SINGLE SPEAKER who appears in the transcript. DO NOT SKIP ANYONE.
2. Use each person's full name exactly as it appears. 
3. Write each task as a short, specific, action-first sentence.
4. Extract the deadline for the task if mentioned. If no deadline is stated, explicitly write "Not specified".
5. If a person spoke but has no tasks or updates, still include them but leave their tasks array empty.

### EXTREME THOROUGHNESS REQUIRED
- Read the transcript line-by-line multiple times.
- DO NOT SKIP ANY TASKS. Even minor follow-ups, brief mentions, or implied tasks MUST be captured. 
- EVERY SINGLE PERSON in the meeting has tasks assigned to them. You MUST find them and assign them correctly.
- It is better to extract too many tasks than to miss a single one. Be exhaustive!

Return ONLY a valid JSON object matching the following structure:
{
  "participants": [
    {
      "name": "Speaker Name",
      "tasks": [
        {
          "description": "Task description here",
          "deadline": "Today"
        }
      ]
    }
  ]
}
`;

    try {
        const truncatedPrompt = prompt.length > 15000 ? prompt.substring(0, 15000) + "\n...[Transcript truncated to fit token limits]" : prompt;
        const response = await groq.chat.completions.create({
            model: "qwen/qwen3.8-27b",
            messages: [
                { role: "system", content: "You are a helpful assistant that strictly outputs JSON. Do not output any conversational text or markdown blocks, only the JSON object." },
                { role: "user", content: truncatedPrompt }
            ],
            temperature: 0.1,
        });

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
