from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from datetime import datetime

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

import uvicorn

# 1) Create the base for our database models
Base = declarative_base()

# 2) Define our database tables as Python classes

class Rodeo(Base):
    __tablename__ = "rodeos"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    location = Column(String)
    start_date = Column(DateTime)
    end_date = Column(DateTime)

    # Relationship to events
    events = relationship("Event", back_populates="rodeo")


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String)       # e.g., "Bull Riding"
    round_number = Column(Integer)    # round info if needed
    rodeo_id = Column(Integer, ForeignKey("rodeos.id"))

    # Relationship back to rodeo
    rodeo = relationship("Rodeo", back_populates="events")
    # Relationship to results
    results = relationship("Result", back_populates="event")


class Contestant(Base):
    __tablename__ = "contestants"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    membership_id = Column(String)  # e.g., PRCA ID (optional)

    # Relationship to results
    results = relationship("Result", back_populates="contestant")


class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    contestant_id = Column(Integer, ForeignKey("contestants.id"))
    score = Column(Float)    # could represent "points" or "time", depending on the event
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    event = relationship("Event", back_populates="results")
    contestant = relationship("Contestant", back_populates="results")


# 3) Create the SQLite database engine and session factory
DATABASE_URL = "sqlite:///./rodeodb.sqlite"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create the database tables (if they don't exist yet)
Base.metadata.create_all(bind=engine)

# 4) Set up the FastAPI app
app = FastAPI()


##############################
# Pydantic models (schemas) #
##############################

class RodeoCreate(BaseModel):
    """Pydantic model for creating a new rodeo."""
    name: str
    location: str
    start_date: datetime
    end_date: datetime

class RodeoOut(BaseModel):
    """Pydantic model for returning rodeo data."""
    id: int
    name: str
    location: str
    start_date: datetime
    end_date: datetime

    class Config:
        orm_mode = True


##############################
#        API Endpoints       #
##############################

@app.post("/rodeos", response_model=RodeoOut)
def create_rodeo(rodeo: RodeoCreate):
    """Endpoint to create a new rodeo."""
    db = SessionLocal()
    db_rodeo = Rodeo(
        name=rodeo.name,
        location=rodeo.location,
        start_date=rodeo.start_date,
        end_date=rodeo.end_date
    )
    db.add(db_rodeo)
    db.commit()
    db.refresh(db_rodeo)
    db.close()
    return db_rodeo

@app.get("/rodeos", response_model=List[RodeoOut])
def list_rodeos():
    """Endpoint to list all rodeos."""
    db = SessionLocal()
    rodeos = db.query(Rodeo).all()
    db.close()
    return rodeos


# 5) Run the app with uvicorn when this file is executed directly
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

