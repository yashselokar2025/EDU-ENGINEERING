from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True) # e.g. 'admin1', 'T-001'
    name = Column(String)
    password_hash = Column(String)
    role = Column(String) # 'admin', 'teacher', 'lab', 'student'

class TeacherDetails(Base):
    __tablename__ = "teacher_details"
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    status = Column(String, default="Available")
    last_updated = Column(String, default="Never")
    schedule = Column(JSON, default=dict) # JSON storage for schedules instead of complex cross tables

class LabReport(Base):
    __tablename__ = "lab_reports"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    lab_id = Column(String, ForeignKey("users.id"))
    timestamp = Column(String)
    monitors = Column(Integer, default=0)
    cpu = Column(Integer, default=0)
    mouse = Column(Integer, default=0)
    keyboard = Column(Integer, default=0)
    switches = Column(Integer, default=0)
    other_issues = Column(Text, default="")
    resolved = Column(Integer, default=0)

# --- EDUCHAIN TABLES ---
class BlockModel(Base):
    __tablename__ = "blockchain"
    block_index = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String)
    student_name = Column(String)
    course_name = Column(String)
    issue_date = Column(String)
    certificate_type = Column(String)
    unique_id = Column(String, unique=True, index=True)
    previous_hash = Column(String)
    block_hash = Column(String)

class BadgeType(Base):
    __tablename__ = "badge_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, index=True)

class BadgeBalance(Base):
    __tablename__ = "badge_balances"
    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet = Column(String, index=True) # Usually the user_id or student name
    badge_name = Column(String)
    count = Column(Integer, default=0)

class YGBalance(Base):
    __tablename__ = "yg_balances"
    wallet = Column(String, primary_key=True, index=True)
    balance = Column(Integer, default=0)

class YGTransaction(Base):
    __tablename__ = "yg_transactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet = Column(String, index=True)
    amount = Column(Integer)
    tx_type = Column(String) # 'mint', 'spend'
    timestamp = Column(String)

class MarketplaceListing(Base):
    __tablename__ = "marketplace"
    id = Column(Integer, primary_key=True, autoincrement=True)
    course_name = Column(String)
    price_yg = Column(Integer)
    listed_at = Column(String)
