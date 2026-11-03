"""SQLAlchemy engine, session factory, and schema initialisation."""
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """FastAPI dependency: yield a DB session and close on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables and indexes from SQL scripts if not already present."""
    sql_dir = Path(__file__).parent.parent / "sql"
    scripts = sorted(sql_dir.glob("0*.sql"))
    with engine.connect() as conn:
        for script in scripts:
            sql = script.read_text()
            # Execute statement by statement
            for statement in sql.split(";"):
                stmt = statement.strip()
                if stmt:
                    conn.execute(text(stmt))
        conn.commit()

