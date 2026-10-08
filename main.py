from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

from database import engine, Base, get_db
from models import Meeting, StandupUpdate, CommitmentTracking
from llm_processor import parse_transcript
from commitment_tracker import track_commitments
from summary_generator import generate_team_summary

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Standup Meeting Bot API")

class TranscriptRequest(BaseModel):
    team_name: str
    transcript_text: str

@app.post("/process_transcript")
def process_transcript(request: TranscriptRequest, db: Session = Depends(get_db)):
    """
    Receives a meeting transcript, parses it with LLM, tracks commitments, and returns a summary.
    """
    # 1. Parse the transcript
    try:
        parsed_result = parse_transcript(request.transcript_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # 2. Save the new meeting and updates to the database
    new_meeting = Meeting(team_name=request.team_name)
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)
    
    for update in parsed_result.updates:
        db_update = StandupUpdate(
            meeting_id=new_meeting.id,
            participant_name=update.participant_name,
            done=json.dumps(update.done),
            in_progress=json.dumps(update.in_progress),
            to_do=json.dumps(update.to_do),
            blockers=json.dumps(update.blockers)
        )
        db.add(db_update)
        
    db.commit()
    
    # 3. Track commitments against previous meeting
    track_commitments(db, new_meeting.id)
    
    # 4. Generate summaries
    updates = db.query(StandupUpdate).filter(StandupUpdate.meeting_id == new_meeting.id).all()
    trackings = db.query(CommitmentTracking).filter(CommitmentTracking.current_meeting_id == new_meeting.id).all()
    
    summary_markdown = generate_team_summary(updates, trackings, parsed_result.action_items)
    
    return {
        "meeting_id": new_meeting.id,
        "team_name": new_meeting.team_name,
        "summary_markdown": summary_markdown,
        "action_items": parsed_result.action_items
    }
