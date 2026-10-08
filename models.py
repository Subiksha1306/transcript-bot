from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    team_name = Column(String, index=True, default="General")
    
    updates = relationship("StandupUpdate", back_populates="meeting")

class StandupUpdate(Base):
    __tablename__ = "standup_updates"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    participant_name = Column(String, index=True)
    
    # Store JSON strings for simplicity in this prototype
    done = Column(String, default="[]") 
    in_progress = Column(String, default="[]")
    to_do = Column(String, default="[]")
    blockers = Column(String, default="[]")
    
    meeting = relationship("Meeting", back_populates="updates")

class CommitmentTracking(Base):
    """
    Stores how a previous commitment was tracked in a subsequent meeting.
    """
    __tablename__ = "commitment_tracking"
    
    id = Column(Integer, primary_key=True, index=True)
    participant_name = Column(String, index=True)
    
    # The original task that was committed to (from a previous meeting's 'to_do' or 'in_progress')
    original_task = Column(String)
    
    # The meeting where this tracking was recorded
    current_meeting_id = Column(Integer, ForeignKey("meetings.id"))
    
    # Status: Completed, Still In Progress, Carried Forward, Blocked, Not Mentioned
    status = Column(String)
    
    # Track how many times this task has been delayed
    carry_forward_count = Column(Integer, default=0)
