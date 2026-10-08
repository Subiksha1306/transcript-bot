import os
import json
import google.generativeai as genai
from pydantic import BaseModel
from typing import List, Dict

# Configure Gemini API key from environment variable
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

class ParticipantUpdate(BaseModel):
    participant_name: str
    done: List[str]
    in_progress: List[str]
    to_do: List[str]
    blockers: List[str]

class StandupParsingResult(BaseModel):
    updates: List[ParticipantUpdate]
    action_items: List[str]

def parse_transcript(transcript_text: str) -> StandupParsingResult:
    """
    Parses a raw meeting transcript and returns structured standup data.
    """
    if not api_key:
        # Fallback or error if no API key is provided
        raise ValueError("GEMINI_API_KEY environment variable is not set. Please set it to use the LLM.")

    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    You are an AI assistant designed to extract structured standup updates from a meeting transcript.
    Review the following transcript and identify each participant's updates.
    
    Categorize the updates into:
    - done (completed work)
    - in_progress (ongoing activities)
    - to_do (planned tasks/commitments)
    - blockers (dependencies or issues)
    
    Also, identify any general new action items that emerged during the meeting.
    
    Return the response as a JSON object that matches this schema exactly:
    {{
      "updates": [
        {{
          "participant_name": "Name",
          "done": ["task 1", "task 2"],
          "in_progress": ["task 3"],
          "to_do": ["task 4"],
          "blockers": ["blocker 1"]
        }}
      ],
      "action_items": ["general action 1"]
    }}
    
    Transcript:
    {transcript_text}
    """
    
    # We use response_mime_type="application/json" to ensure structured output
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
        )
    )
    
    try:
        data = json.loads(response.text)
        return StandupParsingResult(**data)
    except Exception as e:
        print(f"Error parsing LLM response: {e}")
        print(f"Raw response: {response.text}")
        raise
