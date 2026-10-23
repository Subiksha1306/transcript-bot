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
                max_tokens: 3500,
                messages: [
                    { role: "system", content: "You are a helpful assistant that strictly outputs a JSON object with the key 'people'." },
                    { role: "user", content: truncatedPrompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
            });
        } catch (groqErr) {
            console.log("[AI Service] Falling back to qwen/qwen3.8-27b...", groqErr.message);
            try {
                response = await groq.chat.completions.create({
                    model: "qwen/qwen3.8-27b",
                    max_tokens: 3500,
                    messages: [
                        { role: "system", content: "You are a helpful assistant that strictly outputs a JSON object with the key 'people'." },
                        { role: "user", content: truncatedPrompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1,
                });
            } catch (fallbackErr) {
                console.log("[AI Service] Falling back to openai/gpt-oss-20b...", fallbackErr.message);
                response = await groq.chat.completions.create({
                    model: "openai/gpt-oss-20b",
                    max_tokens: 3500,
                    messages: [
                        { role: "system", content: "You are a helpful assistant that strictly outputs a JSON object with the key 'people'." },
                        { role: "user", content: truncatedPrompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1,
                });
            }
        }

        let jsonContent = response.choices[0].message.content;
        
        if (!jsonContent || jsonContent.trim() === '') {
            throw new Error("AI returned an empty response. The model may have timed out or hit a safety filter.");
        }

        console.log("--- RAW GROQ OUTPUT ---");
        console.log(jsonContent);
        console.log("-----------------------");

        const parsed = extractJsonObjectOrArray(jsonContent);
        return normalizePeople(parsed);
    } catch (error) {
        console.error("Error processing transcript with AI:", error);
        throw error;
    }
}

/**
 * Robust JSON extractor that handles markdown backticks, balanced braces/brackets,
 * trailing LLM commentary, and trailing commas.
 * @param {string} rawText 
 * @returns {Object|Array}
 */
function extractJsonObjectOrArray(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error("AI returned empty content");
    }

    const text = rawText.trim();

    // 1. Direct parse test
    try {
        return JSON.parse(text);
    } catch (_) {}

    // 2. Code block extraction ```json ... ```
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = codeBlockRegex.exec(rawText)) !== null) {
        const blockContent = match[1].trim();
        try {
            return JSON.parse(blockContent);
        } catch (_) {
            try {
                return JSON.parse(blockContent.replace(/,\s*([\]}])/g, '$1'));
            } catch (_) {}
        }
    }

    // 3. Bracket matching to find the outermost complete JSON object or array
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');

    let startIdx = -1;
    let openChar = '{';
    let closeChar = '}';

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIdx = firstBrace;
        openChar = '{';
        closeChar = '}';
    } else if (firstBracket !== -1) {
        startIdx = firstBracket;
        openChar = '[';
        closeChar = ']';
    }

    if (startIdx !== -1) {
        let depth = 0;
        let inString = false;
        let escape = false;

        for (let i = startIdx; i < text.length; i++) {
            const char = text[i];
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (!inString) {
                if (char === openChar) {
                    depth++;
                } else if (char === closeChar) {
                    depth--;
                    if (depth === 0) {
                        const candidate = text.substring(startIdx, i + 1);
                        try {
                            return JSON.parse(candidate);
                        } catch (_) {
                            try {
                                return JSON.parse(candidate.replace(/,\s*([\]}])/g, '$1'));
                            } catch (_) {}
                        }
                    }
                }
            }
        }
    }

    // 4. Fallback substring between first open and last close
    const lastCloseChar = (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) ? '}' : ']';
    const lastCloseIdx = text.lastIndexOf(lastCloseChar);
    if (startIdx !== -1 && lastCloseIdx > startIdx) {
        const sub = text.substring(startIdx, lastCloseIdx + 1);
        try {
            return JSON.parse(sub);
        } catch (_) {
            const sanitized = sub.replace(/,\s*([\]}])/g, '$1');
            return JSON.parse(sanitized);
        }
    }

    throw new Error("Could not parse valid JSON from AI response: " + text.substring(0, 100));
}

/**
 * Normalizes any variations in JSON schema into a reliable { people: [...] } format
 * @param {Object|Array} data 
 * @returns {Object} { people: [{ name, tasks: [{ task, deadline }] }] }
 */
function normalizePeople(data) {
    if (!data) {
        return { people: [] };
    }

    let rawList = [];
    if (Array.isArray(data)) {
        rawList = data;
    } else if (typeof data === 'object') {
        rawList = data.people || data.participants || data.team || data.members || [];
        if (!Array.isArray(rawList) && Array.isArray(data.tasks)) {
            rawList = [];
            data.tasks.forEach(t => {
                const personName = t.person || t.name || t.owner || "Team Member";
                let p = rawList.find(x => x.name.toLowerCase() === personName.toLowerCase());
                if (!p) {
                    p = { name: personName, tasks: [] };
                    rawList.push(p);
                }
                p.tasks.push(t);
            });
        }
    }

    const people = [];

    if (Array.isArray(rawList)) {
        for (const item of rawList) {
            if (typeof item === 'string') {
                people.push({ name: item, tasks: [] });
            } else if (typeof item === 'object' && item !== null) {
                const name = item.name || item.speaker || item.person || item.member || "Unknown Person";
                const tasks = [];
                
                let rawTasks = item.tasks || item.action_items || item.items || item.deliverables;
                if (!rawTasks) {
                    if (item.update) {
                        rawTasks = [{ task: item.update, deadline: item.deadline || null }];
                    } else if (item.task) {
                        rawTasks = [{ task: item.task, deadline: item.deadline || null }];
                    } else {
                        rawTasks = [];
                    }
                } else if (!Array.isArray(rawTasks)) {
                    if (typeof rawTasks === 'string' && rawTasks.trim() !== '') {
                        rawTasks = [{ task: rawTasks }];
                    } else {
                        rawTasks = [rawTasks];
                    }
                }

                for (const t of rawTasks) {
                    if (typeof t === 'string' && t.trim() !== '') {
                        tasks.push({ task: t.trim(), deadline: null });
                    } else if (typeof t === 'object' && t !== null) {
                        const taskText = t.task || t.description || t.title || t.update || t.text || "";
                        let dl = t.deadline || t.due_date || t.due || null;
                        if (typeof dl === 'string') {
                            const trimmed = dl.trim();
                            if (trimmed === "" || trimmed.toLowerCase() === "not specified" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "no deadline") {
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

    // Secondary fallback for action_items at root level
    if (typeof data === 'object' && data !== null && Array.isArray(data.action_items)) {
        for (const a of data.action_items) {
            const owner = a.owner || a.assignee || a.person || a.name;
            if (owner) {
                let p = people.find(x => x.name.toLowerCase() === owner.toLowerCase());
                if (!p) {
                    p = { name: owner, tasks: [] };
                    people.push(p);
                }
                const taskText = a.task || a.description || a.title;
                let dl = a.due_date || a.deadline || null;
                if (typeof dl === 'string' && (dl.toLowerCase() === 'not specified' || dl.toLowerCase() === 'null' || dl.toLowerCase() === 'none')) dl = null;
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
