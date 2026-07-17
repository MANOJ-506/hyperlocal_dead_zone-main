from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Database path (SQLite file will be created in backend directory)
SQLALCHEMY_DATABASE_URL = "sqlite:///./deadzone.db"

# Create database engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} # Required for SQLite async thread access
)

# Session factory for DB transactions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base model for schema mapping
Base = declarative_base()

# DB dependency to yield session to FastAPI endpoints and close it afterwards
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
