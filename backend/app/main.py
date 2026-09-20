from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.departments import DEFAULT_DEPARTMENT
from app.database import Base, engine
from app.routers import products, categories, requests, stock_movements
Base.metadata.create_all(bind=engine) 

def add_department_column():
    """create_all() never alters existing tables, so add the new column by hand."""
    columns = [c["name"] for c in inspect(engine).get_columns("products")]
    if "department" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                f"ALTER TABLE products ADD COLUMN department VARCHAR(50) NOT NULL DEFAULT '{DEFAULT_DEPARTMENT}'"
            ))


add_department_column() # creates tables on startup if they don't exist

def merge_photobook_into_i_lab():
    """I Photobook was merged into I Lab: move any products still using the old department."""
    with engine.begin() as conn:
        conn.execute(text("UPDATE products SET department = 'i-lab' WHERE department = 'i-photobook'"))


merge_photobook_into_i_lab()

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
app.include_router(stock_movements.router)


@app.get("/")
def root():
    return {"message": "STD Stock Manager API is running"}


@app.get("/api/test")
def test():
    return {"message": "Backend connection successful!"}