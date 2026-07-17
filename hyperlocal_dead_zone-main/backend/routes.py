import math
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
import models
import email_service

router = APIRouter(prefix="/api")

# Configuration thresholds (Default values, customizable)
DISTANCE_THRESHOLD_METERS = 200
TIME_WINDOW_MINUTES = 30
REPORT_THRESHOLD_COUNT = 3

# Pydantic schemas for request/response validation
class ReportCreate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude of signal drop")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude of signal drop")
    provider: str = Field(..., description="Mobile network operator (Jio, Airtel, VI, BSNL)")
    issue: str = Field(..., description="Issue type (No Signal, Weak Signal, Call Drop, Slow Internet)")
    comments: Optional[str] = Field(None, max_length=500, description="Optional description")

class ReportResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    provider: str
    issue: str
    comments: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Returns distance between two coordinates in meters using the Haversine formula
    """
    R = 6371000.0 # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c

def check_and_trigger_deadzone(new_report: models.Report, db: Session):
    """
    Analyzes nearby reports for the same provider within the time window.
    If the threshold is reached, sends an email incident alert.
    """
    # Time window range
    time_limit = datetime.now() - timedelta(minutes=TIME_WINDOW_MINUTES)
    
    # Query reports from same provider in the last 30 minutes
    recent_reports = db.query(models.Report).filter(
        models.Report.provider == new_report.provider,
        models.Report.timestamp >= time_limit,
        models.Report.id != new_report.id
    ).all()

    # Find reports within the 200m radius of the new report
    nearby_reports = [new_report]
    for r in recent_reports:
        dist = haversine_distance(new_report.latitude, new_report.longitude, r.latitude, r.longitude)
        if dist <= DISTANCE_THRESHOLD_METERS:
            nearby_reports.append(r)

    # If the threshold is reached (e.g. 3 or more reports)
    if len(nearby_reports) >= REPORT_THRESHOLD_COUNT:
        # Calculate cluster center
        avg_lat = sum(r.latitude for r in nearby_reports) / len(nearby_reports)
        avg_lng = sum(r.longitude for r in nearby_reports) / len(nearby_reports)
        
        # Prepare sample coordinate list for the email summary
        sample_coords = [
            (r.latitude, r.longitude, r.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
            for r in nearby_reports
        ]
        
        # Trigger email alert (async simulation)
        email_service.trigger_deadzone_alert(
            provider=new_report.provider,
            report_count=len(nearby_reports),
            lat=avg_lat,
            lng=avg_lng,
            sample_coords=sample_coords
        )

@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(report_data: ReportCreate, db: Session = Depends(get_db)):
    """
    Store a new mobile network complaint in the database and trigger proximity alerts.
    """
    # Validate provider name casing/value
    valid_providers = {"Airtel", "Jio", "VI", "BSNL"}
    valid_issues = {"No Signal", "Weak Signal", "Call Drop", "Slow Internet"}

    if report_data.provider not in valid_providers:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid network provider. Allowed values: {', '.join(valid_providers)}"
        )
        
    if report_data.issue not in valid_issues:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid issue type. Allowed values: {', '.join(valid_issues)}"
        )

    # Save record
    db_report = models.Report(
        latitude=report_data.latitude,
        longitude=report_data.longitude,
        provider=report_data.provider,
        issue=report_data.issue,
        comments=report_data.comments
    )
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    # Check for dead zones
    try:
        check_and_trigger_deadzone(db_report, db)
    except Exception as e:
        print(f"[WARNING] Proximity analysis error: {e}")

    return db_report

@router.get("/reports", response_model=List[ReportResponse])
def get_reports(db: Session = Depends(get_db)):
    """
    Retrieve all registered network complaints, newest first.
    """
    return db.query(models.Report).order_by(models.Report.timestamp.desc()).all()
