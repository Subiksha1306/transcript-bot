import json
from sqlalchemy.orm import Session
from models import Meeting, StandupUpdate, CommitmentTracking

def track_commitments(db: Session, current_meeting_id: int):
    """
    Compares the updates from the current meeting with the previous meeting's commitments.
    Populates the CommitmentTracking table.
    """
    current_meeting = db.query(Meeting).filter(Meeting.id == current_meeting_id).first()
    if not current_meeting:
        return
        
    # Get the previous meeting
    previous_meeting = db.query(Meeting).filter(
        Meeting.id < current_meeting_id,
        Meeting.team_name == current_meeting.team_name
    ).order_by(Meeting.id.desc()).first()
    
    if not previous_meeting:
        # No previous meeting to track against
        return
        
    current_updates = {u.participant_name: u for u in current_meeting.updates}
    previous_updates = {u.participant_name: u for u in previous_meeting.updates}
    
    for participant, prev_update in previous_updates.items():
        # Previous commitments are typically from "to_do" or "in_progress"
        try:
            prev_to_do = json.loads(prev_update.to_do)
            prev_in_progress = json.loads(prev_update.in_progress)
            prev_commitments = prev_to_do + prev_in_progress
        except json.JSONDecodeError:
            continue
            
        if not prev_commitments:
            continue
            
        curr_update = current_updates.get(participant)
        
        try:
            curr_done = json.loads(curr_update.done) if curr_update else []
            curr_in_progress = json.loads(curr_update.in_progress) if curr_update else []
            curr_to_do = json.loads(curr_update.to_do) if curr_update else []
            curr_blockers = json.loads(curr_update.blockers) if curr_update else []
        except json.JSONDecodeError:
            curr_done, curr_in_progress, curr_to_do, curr_blockers = [], [], [], []
            
        # Combine current mentions into a single searchable string for rough matching.
        # A more sophisticated system would use semantic similarity (e.g., embeddings).
        # For this prototype, we'll do basic keyword/substring checking.
        curr_done_text = " ".join(curr_done).lower()
        curr_in_progress_text = " ".join(curr_in_progress).lower()
        curr_to_do_text = " ".join(curr_to_do).lower()
        curr_blockers_text = " ".join(curr_blockers).lower()
        
        for task in prev_commitments:
            task_lower = task.lower()
            status = "Not Mentioned"
            
            if not curr_update:
                status = "Not Mentioned"
            elif any(word in curr_done_text for word in task_lower.split() if len(word) > 4) or task_lower in curr_done_text:
                status = "Completed"
            elif any(word in curr_blockers_text for word in task_lower.split() if len(word) > 4) or task_lower in curr_blockers_text:
                status = "Blocked"
            elif any(word in curr_in_progress_text for word in task_lower.split() if len(word) > 4) or task_lower in curr_in_progress_text:
                status = "Still In Progress"
            elif any(word in curr_to_do_text for word in task_lower.split() if len(word) > 4) or task_lower in curr_to_do_text:
                status = "Carried Forward"
                
            cf_count = 0
            if status in ["Carried Forward", "Still In Progress"]:
                # Check if this task was already delayed in the previous meeting
                prev_tracking = db.query(CommitmentTracking).filter(
                    CommitmentTracking.participant_name == participant,
                    CommitmentTracking.original_task == task,
                    CommitmentTracking.current_meeting_id == previous_meeting.id
                ).first()
                if prev_tracking:
                    cf_count = prev_tracking.carry_forward_count + 1
                else:
                    cf_count = 1
                    
            tracking = CommitmentTracking(
                participant_name=participant,
                original_task=task,
                current_meeting_id=current_meeting_id,
                status=status,
                carry_forward_count=cf_count
            )
            db.add(tracking)
            
    db.commit()
