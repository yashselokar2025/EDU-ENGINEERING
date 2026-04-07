import uuid, datetime, hashlib, json, random, io, os, subprocess, tempfile
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional

from .database import engine, Base, get_db
from .models.schema import (
    User, TeacherDetails, LabReport, BlockModel,
    BadgeType, BadgeBalance, YGBalance, YGTransaction, MarketplaceListing
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Edu-Engineering Platform API", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── WebSocket Manager ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.connections: dict = {}
    async def connect(self, ws: WebSocket, role: str = "all"):
        await ws.accept()
        self.connections.setdefault(role, []).append(ws)
    def disconnect(self, ws: WebSocket, role: str = "all"):
        conns = self.connections.get(role, [])
        if ws in conns: conns.remove(ws)
    async def broadcast(self, msg: dict, role: str = "all"):
        targets = list(self.connections.get(role, [])) + (list(self.connections.get("all", [])) if role != "all" else [])
        dead = []
        for ws in targets:
            try: await ws.send_json(msg)
            except: dead.append(ws)
        for ws in dead: self.disconnect(ws, role)

manager = ConnectionManager()

# ── Startup Seeding ───────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    db = next(get_db())
    def add_user(uid, name, role, pwd):
        if not db.query(User).filter(User.id == uid).first():
            db.add(User(id=uid, name=name, role=role, password_hash=pwd))

    # Admin / HOD
    add_user("admin1", "Dr. Sonali Ridhorkar", "admin", "admin123")
    # Teachers — includes "Chetan" as requested
    add_user("AB",  "Prof. Priyanka Gonnade", "teacher", "Yash@123")
    add_user("CD",  "Prof. Chetan Bawankar",  "teacher", "Chetan@123")
    add_user("EF",  "Prof. Anita Sharma",     "teacher", "Anita@123")
    add_user("GH",  "Prof. Rahul Mehta",      "teacher", "Rahul@123")
    # Labs
    add_user("lab408", "Lab 408 Incharge", "lab", "Ashish@123")
    add_user("lab302", "Lab 302 Incharge", "lab", "Lab@302")
    # Students — includes "Yash Selokar" as requested
    add_user("stu1", "Yash Selokar",       "student", "stu123")
    add_user("stu2", "Yash Pawar",         "student", "stu123")
    add_user("stu3", "Yogeshwar Javanjal", "student", "stu123")
    add_user("stu4", "Vivek Ramteke",      "student", "stu123")

    base_schedule = {
        "Monday":    {"09:00-10:00": {"room": "A101", "subject": "Data Structures"}, "11:00-12:00": {"room": "Lab408", "subject": "DBMS Lab"}},
        "Tuesday":   {"10:00-11:00": {"room": "B202", "subject": "Algorithms"},      "14:00-15:00": {"room": "A101",   "subject": "OS Concepts"}},
        "Wednesday": {"09:00-10:00": {"room": "A101", "subject": "CN Basics"},        "13:00-14:00": {"room": "Lab302", "subject": "CN Lab"}},
        "Thursday":  {"11:00-12:00": {"room": "B202", "subject": "Data Structures"}, "15:00-16:00": {"room": "A101",   "subject": "Algorithms"}},
        "Friday":    {"09:00-10:00": {"room": "A101", "subject": "DBMS Theory"},      "10:00-11:00": {"room": "Lab408", "subject": "OS Lab"}},
    }
    for tid in ["AB", "CD", "EF", "GH"]:
        if not db.query(TeacherDetails).filter(TeacherDetails.user_id == tid).first():
            db.add(TeacherDetails(user_id=tid, status="Available", last_updated="Never", schedule=json.dumps(base_schedule)))

    if db.query(BlockModel).count() == 0:
        ts = str(datetime.datetime.utcnow())
        gh = hashlib.sha256(f"0{ts}GENESIS0".encode()).hexdigest()
        db.add(BlockModel(block_index=0, timestamp=ts, student_name="GENESIS", course_name="GENESIS",
                          issue_date=ts, certificate_type="GENESIS", unique_id="0", previous_hash="0", block_hash=gh))

    if db.query(BadgeType).count() == 0:
        for b in ["🔥 First Solve", "⚡ Speed Demon", "💡 Problem Solver", "🏆 Top Performer", "🎯 Precision Coder", "🧠 Algorithm Master"]:
            db.add(BadgeType(name=b))
    db.commit()


# ── Pydantic Schemas ──────────────────────────────────────────────────────────
class LoginReq(BaseModel):
    user_id: str
    password: str

class StatusUpdate(BaseModel):
    status: str
    room: Optional[str] = None
    leave_date: Optional[str] = None

class ScheduleUpdate(BaseModel):
    day: str
    time_slot: str
    room: str
    subject: str

class LabReportReq(BaseModel):
    monitors: int = 0; cpu: int = 0; mouse: int = 0
    keyboard: int = 0; switches: int = 0; other_issues: Optional[str] = ""

class ResolveReportReq(BaseModel):
    report_id: int

class CodeRunReq(BaseModel):
    code: str; expected: str
    question_id: Optional[str] = None
    student_id: Optional[str] = None

class CertReq(BaseModel):
    student_name: str; course_name: str; cert_type: str

class AddUserReq(BaseModel):
    user_id: str; name: str; role: str; password: str

class InterviewAnswerReq(BaseModel):
    session_id: str; question_index: int; answer: str


# ── AUTH ──────────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
def login(req: LoginReq, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == req.user_id).first()
    if user and user.password_hash == req.password:
        extra = {}
        if user.role == "teacher":
            td = db.query(TeacherDetails).filter(TeacherDetails.user_id == user.id).first()
            extra["status"] = td.status if td else "Available"
        elif user.role == "student":
            yg = db.query(YGBalance).filter(YGBalance.wallet == user.id).first()
            extra["yg_balance"] = yg.balance if yg else 0
        return {"id": user.id, "name": user.name, "role": user.role, **extra}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/api/auth/users")
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "role": u.role} for u in users]

@app.post("/api/auth/add_user")
def add_user(req: AddUserReq, db: Session = Depends(get_db)):
    if db.query(User).filter(User.id == req.user_id).first():
        raise HTTPException(status_code=400, detail="User ID already exists")
    db.add(User(id=req.user_id, name=req.name, role=req.role, password_hash=req.password))
    if req.role == "teacher":
        db.add(TeacherDetails(user_id=req.user_id, status="Available", last_updated="Never", schedule=json.dumps({})))
    db.commit()
    return {"message": f"User {req.name} added successfully"}

@app.delete("/api/auth/remove_user/{user_id}")
def remove_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User removed"}


# ── DMIS: TEACHERS ────────────────────────────────────────────────────────────
def _compute_status(schedule: dict) -> Optional[str]:
    now = datetime.datetime.now()
    day = now.strftime("%A")
    ct  = now.strftime("%H:%M")
    for slot, info in schedule.get(day, {}).items():
        try:
            s, e = slot.split("-")
            if s.strip() <= ct <= e.strip():
                room = info.get("room","?") if isinstance(info,dict) else info
                subj = info.get("subject","") if isinstance(info,dict) else ""
                return f"🎓 Teaching {subj} in {room}"
        except: pass
    return None

def _get_today_classes(schedule: dict) -> list:
    day = datetime.datetime.now().strftime("%A")
    day_sched = schedule.get(day, {})
    if not isinstance(day_sched, dict): return []
    return [{"slot": s, **v} for s, v in day_sched.items()]

@app.get("/api/dmis/teachers")
def get_teachers(db: Session = Depends(get_db)):
    rows = db.query(User, TeacherDetails).join(TeacherDetails, User.id == TeacherDetails.user_id).all()
    result = []
    for u, td in rows:
        sched = json.loads(td.schedule) if td.schedule else {}
        computed = _compute_status(sched)
        result.append({
            "id": u.id, "name": u.name,
            "status": computed or td.status,
            "manual_status": td.status,
            "last_updated": td.last_updated,
            "schedule": sched,
            "today_classes": _get_today_classes(sched)
        })
    return result

@app.post("/api/dmis/teacher/status/{user_id}")
async def update_teacher_status(user_id: str, req: StatusUpdate, db: Session = Depends(get_db)):
    td = db.query(TeacherDetails).filter(TeacherDetails.user_id == user_id).first()
    if not td: raise HTTPException(status_code=404, detail="Teacher not found")
    status_map = {
        "AVAILABLE":     f"✅ Available{' in Room ' + req.room if req.room else ''}",
        "NOT AVAILABLE": "❌ Not Available",
        "ON LEAVE":      f"🏖 On Leave{' until ' + req.leave_date if req.leave_date else ''}",
    }
    td.status = status_map.get(req.status, req.status)
    td.last_updated = datetime.datetime.now().strftime("%d %b %Y, %I:%M %p")
    db.commit()
    await manager.broadcast({"type": "TEACHER_UPDATE", "user_id": user_id, "status": td.status, "last_updated": td.last_updated})
    return {"message": "Status updated", "status": td.status}

@app.post("/api/dmis/teacher/schedule/{user_id}")
async def update_schedule(user_id: str, req: ScheduleUpdate, db: Session = Depends(get_db)):
    td = db.query(TeacherDetails).filter(TeacherDetails.user_id == user_id).first()
    if not td: raise HTTPException(status_code=404)
    sched = json.loads(td.schedule) if td.schedule else {}
    sched.setdefault(req.day, {})[req.time_slot] = {"room": req.room, "subject": req.subject}
    td.schedule = json.dumps(sched)
    db.commit()
    await manager.broadcast({"type": "SCHEDULE_UPDATE", "user_id": user_id})
    return {"message": "Schedule updated"}

@app.delete("/api/dmis/teacher/schedule/{user_id}/{day}/{slot}")
async def delete_schedule_slot(user_id: str, day: str, slot: str, db: Session = Depends(get_db)):
    td = db.query(TeacherDetails).filter(TeacherDetails.user_id == user_id).first()
    if not td: raise HTTPException(status_code=404)
    sched = json.loads(td.schedule) if td.schedule else {}
    sched.get(day, {}).pop(slot, None)
    td.schedule = json.dumps(sched)
    db.commit()
    return {"message": "Slot deleted"}


# ── DMIS: LAB REPORTS ─────────────────────────────────────────────────────────
@app.get("/api/dmis/labs")
def get_labs(db: Session = Depends(get_db)):
    labs = db.query(User).filter(User.role == "lab").all()
    result = []
    for lab in labs:
        rpts = db.query(LabReport).filter(LabReport.lab_id == lab.id).all()
        total  = sum(r.monitors+r.cpu+r.mouse+r.keyboard+r.switches for r in rpts)
        open_i = sum(r.monitors+r.cpu+r.mouse+r.keyboard+r.switches for r in rpts if not r.resolved)
        result.append({"id": lab.id, "name": lab.name, "total_reports": len(rpts),
                        "total_issues": total, "open_issues": open_i, "resolved": total - open_i})
    return result

@app.get("/api/dmis/lab/{lab_id}/reports")
def get_lab_reports(lab_id: str, db: Session = Depends(get_db)):
    rpts = db.query(LabReport).filter(LabReport.lab_id == lab_id).order_by(LabReport.id.desc()).all()
    return [{"id": r.id, "timestamp": r.timestamp, "monitors": r.monitors, "cpu": r.cpu,
             "mouse": r.mouse, "keyboard": r.keyboard, "switches": r.switches,
             "other_issues": r.other_issues, "resolved": bool(r.resolved),
             "total": r.monitors+r.cpu+r.mouse+r.keyboard+r.switches} for r in rpts]

@app.post("/api/dmis/lab/{lab_id}/report")
async def submit_lab_report(lab_id: str, req: LabReportReq, db: Session = Depends(get_db)):
    r = LabReport(lab_id=lab_id, timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                  monitors=req.monitors, cpu=req.cpu, mouse=req.mouse,
                  keyboard=req.keyboard, switches=req.switches, other_issues=req.other_issues or "", resolved=0)
    db.add(r); db.commit(); db.refresh(r)
    total = req.monitors+req.cpu+req.mouse+req.keyboard+req.switches
    await manager.broadcast({"type": "LAB_REPORT", "lab_id": lab_id, "total_issues": total, "timestamp": r.timestamp})
    return {"message": "Report submitted", "id": r.id}

@app.post("/api/dmis/lab/resolve")
async def resolve_report(req: ResolveReportReq, db: Session = Depends(get_db)):
    r = db.query(LabReport).filter(LabReport.id == req.report_id).first()
    if not r: raise HTTPException(status_code=404)
    r.resolved = 1; db.commit()
    await manager.broadcast({"type": "REPORT_RESOLVED", "report_id": req.report_id})
    return {"message": "Resolved"}


# ── DSA ARENA ─────────────────────────────────────────────────────────────────
DSA_QUESTIONS = {
    "easy": [
        {"id":"e1","title":"Hello World","description":"Print exactly: Hello, World!","expected":"Hello, World!","difficulty":"easy","category":"basics","companies":["TCS","Wipro","Infosys"]},
        {"id":"e2","title":"Sum of Numbers","description":"Print the sum of 5 and 7.","expected":"12","difficulty":"easy","category":"math","companies":["Accenture","Cognizant"]},
        {"id":"e3","title":"Reverse a String","description":"Reverse the string 'python' and print it.","expected":"nohtyp","difficulty":"easy","category":"strings","companies":["Google","Microsoft","Amazon"]},
        {"id":"e4","title":"Check Even","description":"Print 'Even' if 42 is even, else 'Odd'.","expected":"Even","difficulty":"easy","category":"conditionals","companies":["TCS","HCL"]},
        {"id":"e5","title":"Fibonacci First 5","description":"Print the first 5 Fibonacci numbers separated by spaces.","expected":"0 1 1 2 3","difficulty":"easy","category":"sequences","companies":["Wipro","Infosys","Capgemini"]},
        {"id":"e6","title":"Square of 9","description":"Print the square of 9.","expected":"81","difficulty":"easy","category":"math","companies":["TCS","Tech Mahindra"]},
        {"id":"e7","title":"List Length","description":"Print the length of list [1,2,3,4,5].","expected":"5","difficulty":"easy","category":"arrays","companies":["Infosys","Wipro"]},
    ],
    "medium": [
        {"id":"m1","title":"Palindrome Check","description":"Is 'racecar' a palindrome? Print 'Yes' or 'No'.","expected":"Yes","difficulty":"medium","category":"strings","companies":["Amazon","Flipkart","Swiggy"]},
        {"id":"m2","title":"Count Vowels","description":"Count vowels in 'Hello World'. Print the count.","expected":"3","difficulty":"medium","category":"strings","companies":["Microsoft","Oracle"]},
        {"id":"m3","title":"Find Maximum","description":"Find and print the max of [3,1,4,1,5,9,2,6].","expected":"9","difficulty":"medium","category":"arrays","companies":["Google","Paytm","Zepto"]},
        {"id":"m4","title":"Prime Check","description":"Is 17 prime? Print 'Prime' or 'Not Prime'.","expected":"Prime","difficulty":"medium","category":"math","companies":["TCS","Infosys","Tech Mahindra"]},
        {"id":"m5","title":"Factorial of 6","description":"Print the factorial of 6.","expected":"720","difficulty":"medium","category":"math","companies":["Wipro","HCL","Capgemini"]},
        {"id":"m6","title":"Sort Ascending","description":"Sort [5,2,8,1,9] ascending. Print space-separated.","expected":"1 2 5 8 9","difficulty":"medium","category":"sorting","companies":["Amazon","Flipkart"]},
    ],
    "hard": [
        {"id":"h1","title":"Anagram Check","description":"Are 'listen' and 'silent' anagrams? Print 'Yes' or 'No'.","expected":"Yes","difficulty":"hard","category":"strings","companies":["Google","Microsoft","Meta"]},
        {"id":"h2","title":"Diagonal Sum","description":"Print sum of both diagonals of [[1,2,3],[4,5,6],[7,8,9]].","expected":"25","difficulty":"hard","category":"matrix","companies":["Amazon","Adobe","Nvidia"]},
        {"id":"h3","title":"Binary Search","description":"Find index of 7 in [1,3,5,7,9,11,13]. Print the index.","expected":"3","difficulty":"hard","category":"searching","companies":["Google","Microsoft","Atlassian"]},
        {"id":"h4","title":"Stack Operations","description":"Push 1,2,3 to a stack then pop once. Print remaining space-separated.","expected":"1 2","difficulty":"hard","category":"data_structures","companies":["Amazon","SAP"]},
    ],
    "company": {
        "Google":    [{"id":"g1","title":"Two Sum","description":"Find two indices in [2,7,11,15] that add to 9. Print indices separated by space.","expected":"0 1","difficulty":"medium","category":"arrays"}],
        "Microsoft": [{"id":"ms1","title":"Merge Sorted Arrays","description":"Merge [1,3,5] and [2,4,6]. Print sorted space-separated.","expected":"1 2 3 4 5 6","difficulty":"medium","category":"arrays"}],
        "Amazon":    [{"id":"am1","title":"Longest Word","description":"Print the longest word in 'The quick brown fox'.","expected":"quick","difficulty":"medium","category":"strings"}],
        "TCS":       [{"id":"t1","title":"Digit Sum","description":"Print the sum of digits of 12345.","expected":"15","difficulty":"easy","category":"math"}],
        "Infosys":   [{"id":"i1","title":"Word Count","description":"Count words in 'Hello World How Are You'. Print the count.","expected":"5","difficulty":"easy","category":"strings"}],
        "Wipro":     [{"id":"w1","title":"Swap Without Temp","description":"Swap a=5, b=3 without temp variable. Print 'b=5 a=3'.","expected":"b=5 a=3","difficulty":"medium","category":"math"}],
    }
}

@app.get("/api/dsa/questions")
def get_questions(difficulty: Optional[str] = None, company: Optional[str] = None):
    if company and company in DSA_QUESTIONS["company"]:
        return {"questions": DSA_QUESTIONS["company"][company], "source": f"Company: {company}"}
    if difficulty and difficulty in DSA_QUESTIONS:
        return {"questions": DSA_QUESTIONS[difficulty], "source": f"Difficulty: {difficulty}"}
    all_q = []
    for d in ["easy","medium","hard"]:
        all_q.extend(DSA_QUESTIONS[d])
    return {"questions": all_q, "source": "All"}

@app.get("/api/dsa/companies")
def get_companies():
    return {"companies": list(DSA_QUESTIONS["company"].keys())}

@app.post("/api/dsa/run")
async def run_code(req: CodeRunReq, db: Session = Depends(get_db)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as tmp:
            tmp.write(req.code); tmp_path = tmp.name
        res = subprocess.run(["python", tmp_path], capture_output=True, text=True, timeout=5)
        output = res.stdout.strip(); stderr = res.stderr.strip()
        os.remove(tmp_path)
        passed = output == req.expected.strip()
        if passed and req.student_id:
            wallet = req.student_id
            yg = db.query(YGBalance).filter(YGBalance.wallet == wallet).first()
            if yg: yg.balance += 10
            else: db.add(YGBalance(wallet=wallet, balance=10))
            badge_name = "🔥 First Solve"
            bb = db.query(BadgeBalance).filter(BadgeBalance.wallet == wallet, BadgeBalance.badge_name == badge_name).first()
            if bb: bb.count += 1
            else: db.add(BadgeBalance(wallet=wallet, badge_name=badge_name, count=1))
            db.add(YGTransaction(wallet=wallet, amount=10, tx_type="earn_dsa", timestamp=str(datetime.datetime.utcnow())))
            db.commit()
            await manager.broadcast({"type": "YG_EARNED", "student_id": wallet, "amount": 10})
        return {"result": "Passed" if passed else "Failed", "output": output, "stderr": stderr, "expected": req.expected}
    except subprocess.TimeoutExpired:
        if os.path.exists(tmp_path): os.remove(tmp_path)
        return {"result": "Error", "output": "", "stderr": "Execution timed out (5s limit)", "expected": req.expected}
    except Exception as e:
        if 'tmp_path' in locals() and os.path.exists(tmp_path): os.remove(tmp_path)
        return {"result": "Error", "output": "", "stderr": str(e), "expected": req.expected}


# ── RESUME UPLOAD + ATS SCANNER ───────────────────────────────────────────────
ATS_SKILL_KEYWORDS = {
    "python": ["python", "django", "flask", "fastapi", "pandas", "numpy", "pytorch", "tensorflow"],
    "java": ["java", "spring", "hibernate", "maven", "gradle", "j2ee", "springboot"],
    "javascript": ["javascript", "js", "nodejs", "express", "react", "vue", "angular", "typescript"],
    "react": ["react", "reactjs", "redux", "hooks", "jsx", "next.js", "nextjs"],
    "data structures": ["data structure", "linked list", "binary tree", "graph", "stack", "queue", "heap", "trie"],
    "algorithms": ["algorithm", "dynamic programming", "greedy", "backtracking", "sorting", "searching", "recursion", "complexity"],
    "machine learning": ["machine learning", "ml", "sklearn", "scikit-learn", "classification", "regression", "neural network", "deep learning", "ai"],
    "sql": ["sql", "mysql", "postgresql", "oracle", "mongodb", "nosql", "database", "dbms"],
    "web development": ["html", "css", "bootstrap", "tailwind", "restapi", "rest api", "graphql", "api"],
    "cloud": ["aws", "azure", "gcp", "cloud", "docker", "kubernetes", "devops", "ci/cd"],
    "c++": ["c++", "cpp", "stl", "oops", "object oriented"],
    "mobile": ["android", "ios", "flutter", "react native", "kotlin", "swift"],
}

RESUME_QUESTION_BANK = {
    "python": [
        {"question": "Reverse the string 'python'. Print result.", "expected": "nohtyp", "hint": "s = 'python'\nprint(s[::-1])"},
        {"question": "Print the factorial of 5.", "expected": "120", "hint": "import math\nprint(math.factorial(5))"},
        {"question": "Is 11 prime? Print 'Prime' or 'Not Prime'.", "expected": "Prime", "hint": "n=11\nprint('Prime' if all(n%i!=0 for i in range(2,n)) else 'Not Prime')"},
        {"question": "Print the square root of 144 as integer.", "expected": "12", "hint": "import math\nprint(int(math.sqrt(144)))"},
    ],
    "java": [
        {"question": "Simulate: print 'Java is object-oriented'", "expected": "Java is object-oriented", "hint": "print('Java is object-oriented')"},
    ],
    "data structures": [
        {"question": "Push 1,2,3 to stack then pop. Print remaining space-separated.", "expected": "1 2", "hint": "s=[1,2,3]\ns.pop()\nprint(*s)"},
        {"question": "Find max in [5,3,7,1,4]. Print it.", "expected": "7", "hint": "print(max([5,3,7,1,4]))"},
        {"question": "Print length of a queue [10,20,30,40].", "expected": "4", "hint": "q=[10,20,30,40]\nprint(len(q))"},
    ],
    "algorithms": [
        {"question": "Find index of 7 in sorted [1,3,5,7,9]. Print index.", "expected": "3", "hint": "lst=[1,3,5,7,9]\nprint(lst.index(7))"},
        {"question": "Sort [5,2,8,1,9] and print space-separated.", "expected": "1 2 5 8 9", "hint": "lst=[5,2,8,1,9]\nlst.sort()\nprint(*lst)"},
    ],
    "machine learning": [
        {"question": "Print the mean of [10,20,30,40,50].", "expected": "30.0", "hint": "print(sum([10,20,30,40,50])/5)"},
        {"question": "Normalize value 75 in range 0-100. Print result.", "expected": "0.75", "hint": "print(75/100)"},
    ],
    "sql": [
        {"question": "Simulate SELECT 5+3: print the result.", "expected": "8", "hint": "print(8)"},
    ],
    "react": [
        {"question": "Print 'Component Mounted' (React lifecycle simulation).", "expected": "Component Mounted", "hint": "print('Component Mounted')"},
    ],
    "web development": [
        {"question": "Print the HTTP methods: 'GET POST PUT DELETE'", "expected": "GET POST PUT DELETE", "hint": "print('GET POST PUT DELETE')"},
    ],
    "cloud": [
        {"question": "Print 'Deployed to Cloud' (simulating cloud deploy).", "expected": "Deployed to Cloud", "hint": "print('Deployed to Cloud')"},
    ],
    "javascript": [
        {"question": "Simulate JS: print 'Hello from JavaScript'", "expected": "Hello from JavaScript", "hint": "print('Hello from JavaScript')"},
    ],
    "default": [
        {"question": "Print 'Hello, World!'", "expected": "Hello, World!", "hint": "print('Hello, World!')"},
        {"question": "Reverse the string 'interview'.", "expected": "weivretni", "hint": "print('interview'[::-1])"},
    ]
}

def extract_text_from_bytes(content: bytes, filename: str) -> str:
    """Extract text from PDF or DOCX bytes"""
    ext = filename.lower().split(".")[-1]
    try:
        if ext == "pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            return " ".join(page.extract_text() or "" for page in reader.pages)
        elif ext in ("docx", "doc"):
            from docx import Document
            doc = Document(io.BytesIO(content))
            return " ".join(p.text for p in doc.paragraphs)
        else:
            return content.decode("utf-8", errors="ignore")
    except Exception as e:
        return content.decode("utf-8", errors="ignore")

@app.post("/api/resume/upload")
async def upload_resume(file: UploadFile = File(None)):
    """Upload PDF/DOCX resume and get ATS scan + interview questions"""
    if file:
        content = await file.read()
        text = extract_text_from_bytes(content, file.filename)
    else:
        raise HTTPException(status_code=400, detail="No file provided")

    return _analyze_resume_text(text)

@app.post("/api/resume/analyze_text")
async def analyze_resume_text(data: dict):
    """Analyze plain text resume"""
    text = data.get("text", "")
    return _analyze_resume_text(text)

def _analyze_resume_text(text: str) -> dict:
    text_lower = text.lower()
    detected_skills = []
    ats_keywords_found = []
    ats_keywords_missing = []

    important_keywords = ["python", "java", "react", "machine learning", "sql", "algorithms",
                           "data structures", "javascript", "cloud", "c++", "web development", "mobile"]

    for skill, keywords in ATS_SKILL_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                if skill not in detected_skills:
                    detected_skills.append(skill)
                ats_keywords_found.append(kw)
                break

    for kw in important_keywords:
        if kw not in detected_skills and kw not in ats_keywords_found:
            ats_keywords_missing.append(kw)

    # Collect questions from detected skills
    question_pool = []
    for skill in detected_skills:
        if skill in RESUME_QUESTION_BANK:
            question_pool.extend(RESUME_QUESTION_BANK[skill])

    if not question_pool:
        question_pool = RESUME_QUESTION_BANK["default"]
        detected_skills = ["general"]

    selected = random.sample(question_pool, min(6, len(question_pool)))

    ats_score = min(100, int((len(ats_keywords_found) / max(len(important_keywords), 1)) * 100))

    return {
        "detected_skills": detected_skills,
        "ats_score": ats_score,
        "ats_keywords_found": ats_keywords_found,
        "ats_keywords_missing": ats_keywords_missing[:8],
        "questions": selected,
        "message": f"ATS Score: {ats_score}% | Detected: {', '.join(detected_skills)}",
        "session_id": str(uuid.uuid4())[:8]
    }


# ── EDUCHAIN ──────────────────────────────────────────────────────────────────
@app.post("/api/edu/certificate")
def issue_cert(req: CertReq, db: Session = Depends(get_db)):
    latest = db.query(BlockModel).order_by(BlockModel.block_index.desc()).first()
    idx = (latest.block_index + 1) if latest else 1
    ts = str(datetime.datetime.utcnow())
    uid = str(uuid.uuid4())[:8]
    data_str = f"{req.student_name}:{req.course_name}"
    prev_hash = latest.block_hash if latest else "0"
    new_hash = hashlib.sha256(f"{idx}{ts}{data_str}{prev_hash}".encode()).hexdigest()
    block = BlockModel(block_index=idx, timestamp=ts, student_name=req.student_name,
                       course_name=req.course_name, issue_date=ts, certificate_type=req.cert_type,
                       unique_id=uid, previous_hash=prev_hash, block_hash=new_hash)
    db.add(block); db.commit()
    return {"message": "Certificate issued!", "uid": uid, "hash": new_hash}

@app.get("/api/edu/portfolio/{student_id}")
def get_portfolio(student_id: str, db: Session = Depends(get_db)):
    certs  = db.query(BlockModel).filter(BlockModel.student_name == student_id).all()
    badges = db.query(BadgeBalance).filter(BadgeBalance.wallet == student_id).all()
    yg     = db.query(YGBalance).filter(YGBalance.wallet == student_id).first()
    txs    = db.query(YGTransaction).filter(YGTransaction.wallet == student_id).order_by(YGTransaction.id.desc()).limit(10).all()
    return {
        "certificates": [{"uid": c.unique_id, "course": c.course_name, "type": c.certificate_type, "issued": c.issue_date} for c in certs],
        "badges": [{"name": b.badge_name, "count": b.count} for b in badges],
        "yg_balance": yg.balance if yg else 0,
        "transactions": [{"amount": t.amount, "type": t.tx_type, "time": t.timestamp} for t in txs],
    }

@app.get("/api/edu/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    balances = db.query(YGBalance).order_by(YGBalance.balance.desc()).limit(10).all()
    result = []
    for yg in balances:
        user = db.query(User).filter(User.id == yg.wallet).first()
        badge_count = db.query(func.sum(BadgeBalance.count)).filter(BadgeBalance.wallet == yg.wallet).scalar() or 0
        result.append({"id": yg.wallet, "name": user.name if user else yg.wallet, "yg": yg.balance, "badges": badge_count})
    return result

@app.get("/api/admin/stats")
def admin_stats(db: Session = Depends(get_db)):
    teachers  = db.query(User).filter(User.role == "teacher").count()
    students  = db.query(User).filter(User.role == "student").count()
    labs      = db.query(User).filter(User.role == "lab").count()
    certs     = max(0, db.query(BlockModel).count() - 1)
    lab_rpts  = db.query(LabReport).count()
    open_iss  = db.query(LabReport).filter(LabReport.resolved == 0).count()
    return {"teachers": teachers, "students": students, "labs": labs,
            "certificates": certs, "lab_reports": lab_rpts, "open_issues": open_iss}

# ── WEBSOCKET ─────────────────────────────────────────────────────────────────
@app.websocket("/ws/{role}")
async def ws_endpoint(websocket: WebSocket, role: str):
    await manager.connect(websocket, role)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                await manager.broadcast(msg)
            except: await manager.broadcast({"type": "MSG", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket, role)
