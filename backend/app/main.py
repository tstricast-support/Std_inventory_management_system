from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import products, categories,requests

Base.metadata.create_all(bind=engine)  # creates tables on startup if they don't exist

app = FastAPI(
    title="STD Stock Manager API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",
                   "https://stdinventorymanagementsystem-production.up.railway.app",
],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(products.router)
app.include_router(requests.router)


@app.get("/")
def root():
    return {"message": "STD Stock Manager API is running"}


@app.get("/api/test")
def test():
    return {"message": "Backend connection successful!"}