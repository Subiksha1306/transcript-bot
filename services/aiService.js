// AI Service powered by Groq API
const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/**
 * Process the transcript and generate structured updates using Groq
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
2. For EVERY single person, extract their key action items and deliverables. 
3. If someone assigns a task to another person, assign it to the person who has to DO the work, not the person who asked.
4. Extract explicit deadlines (e.g. "Today, 4:00 PM", "Tomorrow morning", "End of day", "Wednesday afternoon"). If no deadline is stated in the transcript, set deadline to null.
5. Be concise: combine related minor sub-steps into clear, action-first sentences starting with an active verb.
6. You MUST include an entry in the "people" array for EVERY person who participated in the meeting. Keep the order of people the same as they appear in the transcript.

Return ONLY a valid JSON object matching the following structure:
{
  "people": [
    {
      "name": "Arun",
      "tasks": [
        {
          "task": "Review Subiksha's documentation",
          "deadline": null
        },
        {
          "task": "Follow up with infrastructure team on Axle tenant permissions",
          "deadline": "Today, 4:00 PM"
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
        
        const parsed = JSON.parse(jsonContent);
        return normalizePeople(parsed);
    } catch (error) {
        console.error("Error processing transcript with AI:", error);
        throw error;
    }
}

/**
 * Normalizes any variations in JSON schema into a reliable { people: [...] } format
 * @param {Object} data 
 * @returns {Object} { people: [{ name, tasks: [{ task, deadline }] }] }
 */
function normalizePeople(data) {
    if (!data || typeof data !== 'object') {
        return { people: [] };
    }

    const rawList = data.people || data.participants || [];
    const people = [];

    if (Array.isArray(rawList)) {
        for (const item of rawList) {
            if (typeof item === 'string') {
                people.push({ name: item, tasks: [] });
            } else if (typeof item === 'object' && item !== null) {
                const name = item.name || item.speaker || "Unknown Person";
                const tasks = [];
                const rawTasks = item.tasks || [];
                if (Array.isArray(rawTasks)) {
                    for (const t of rawTasks) {
                        const taskText = t.task || t.description || t.title || "";
                        let dl = t.deadline || t.due_date || null;
                        if (typeof dl === 'string') {
                            const trimmed = dl.trim();
                            if (trimmed === "" || trimmed.toLowerCase() === "not specified" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "none") {
                                dl = null;
                            }
                        }
                        if (taskText) {
                            tasks.push({ task: taskText, deadline: dl });
                        }
                    }
                }
                people.push({ name, tasks });
            }
        }
    }

    // Secondary fallback for schemas with action_items
    if (Array.isArray(data.action_items)) {
        for (const a of data.action_items) {
            const owner = a.owner || a.assignee;
            if (owner) {
                let p = people.find(x => x.name.toLowerCase() === owner.toLowerCase());
                if (!p) {
                    p = { name: owner, tasks: [] };
                    people.push(p);
                }
                const taskText = a.task || a.description;
                let dl = a.due_date || a.deadline || null;
                if (typeof dl === 'string' && (dl.toLowerCase() === 'not specified' || dl.toLowerCase() === 'null')) dl = null;
                if (taskText && !p.tasks.some(t => t.task === taskText)) {
                    p.tasks.push({ task: taskText, deadline: dl });
                }
            }
        }
    }

    return { people };
}

/**
 * Formats structured people data into a clean plain-text summary for Teams
 * @param {Object} standupData 
 */
function formatMarkdownSummary(standupData) {
    const normalized = normalizePeople(standupData);
    let output = "";

    for (const p of normalized.people) {
        output += `${p.name}\n`;
        if (p.tasks.length === 0) {
            output += ` 1. No assigned tasks or updates.\n\n`;
        } else {
            p.tasks.forEach((task, index) => {
                const deadlineText = task.deadline ? `(${task.deadline})` : `(No deadline)`;
                output += ` ${index + 1}. ${task.task} ${deadlineText}\n`;
            });
            output += `\n`;
        }
    }

    return output.trim();
}

module.exports = {
    processTranscript,
    normalizePeople,
    formatMarkdownSummary
};
