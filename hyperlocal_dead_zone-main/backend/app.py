import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import engine, Base
import routes

# Load configuration variables from .env file
load_dotenv()

# Create SQLite database tables if they do not exist
try:
    Base.metadata.create_all(bind=engine)
    print("[DATABASE] SQLite tables initialized successfully.")
except Exception as e:
    print(f"[DATABASE] ERROR: Schema migration failed: {e}")

# Initialize FastAPI application
app = FastAPI(
    title="Hyperlocal Dead Zone Locator API",
    description="Backend service for crowdsourced mobile network signal drops mapping",
    version="1.0.0"
)

# Configure CORS Middleware
allowed_origins = [
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(routes.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Hyperlocal Dead Zone Locator API",
        "documentation": "/docs"
    }
