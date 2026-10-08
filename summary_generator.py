import json
from typing import List
from models import StandupUpdate, CommitmentTracking

def generate_participant_summary(update: StandupUpdate, tracking: List[CommitmentTracking]) -> str:
    """Generates the Markdown summary for a single participant."""
    
    try:
        done = json.loads(update.done)
        in_progress = json.loads(update.in_progress)
        to_do = json.loads(update.to_do)
        blockers = json.loads(update.blockers)
    except json.JSONDecodeError:
        done, in_progress, to_do, blockers = [], [], [], []

    md = f"**{update.participant_name}**\n\n"
    
    md += "**Today's Update**\n"
    if done:
        md += "- Done: " + "; ".join(done) + "\n"
    if in_progress:
        md += "- In Progress: " + "; ".join(in_progress) + "\n"
    if to_do:
        md += "- To Do: " + "; ".join(to_do) + "\n"
    if blockers:
        md += "- Blocker: " + "; ".join(blockers) + "\n"
        
    md += "\n**Commitment Tracking**\n"
    if not tracking:
        md += "- No previous commitments to track.\n"
    else:
        for t in tracking:
            if getattr(t, 'carry_forward_count', 0) > 1 and t.status in ["Carried Forward", "Still In Progress"]:
                md += f"- ⚠️ **{t.original_task}** — {t.status} (Delayed {t.carry_forward_count} times!)\n"
            else:
                md += f"- {t.original_task} — {t.status} from previous standup.\n"
            
    return md

def generate_team_summary(updates: List[StandupUpdate], trackings: List[CommitmentTracking], action_items: List[str] = None) -> str:
    """Generates the overall team summary."""
    
    md = "# Team Standup Summary\n\n"
    
    if action_items:
        md += "## 📋 New Action Items\n"
        for item in action_items:
            md += f"- {item}\n"
        md += "\n"
    
    all_blockers = []
    for u in updates:
        try:
            b = json.loads(u.blockers)
            if b:
                all_blockers.extend([f"[{u.participant_name}] {blocker}" for blocker in b])
        except json.JSONDecodeError:
            pass
            
    if all_blockers:
        md += "## 🚨 Key Blockers\n"
        for b in all_blockers:
            md += f"- {b}\n"
        md += "\n"
        
    md += "## Individual Updates\n\n"
    for u in updates:
        user_tracking = [t for t in trackings if t.participant_name == u.participant_name]
        md += generate_participant_summary(u, user_tracking) + "\n---\n\n"
        
    return md
