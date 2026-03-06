import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from constants import MAX_FILE_COUNT, MAX_TOTAL_SIZE_BYTES, MAX_FILE_CHARS
from helpers import validate_file, format_file_contents
from pattern_detector import detect_skills
from difficulty_engine import suggest_difficulty
from question_generator import generate_questions, evaluate_open_ended

app = FastAPI(title="CodeIQ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuizRequest(BaseModel):
    file_contents: str
    difficulty: str
    count: int = 5


class EvaluateRequest(BaseModel):
    question: str
    ideal_answer: str
    user_answer: str


@app.get("/")
def root():
    return {"status": "CodeIQ API running"}


@app.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    if len(files) > MAX_FILE_COUNT:
        raise HTTPException(400, f"Max {MAX_FILE_COUNT} files allowed.")

    parsed, errors, total_size = [], [], 0

    for upload in files:
        raw = await upload.read()
        size = len(raw)
        total_size += size

        err = validate_file(upload.filename, size)
        if err:
            errors.append(err)
            continue

        if total_size > MAX_TOTAL_SIZE_BYTES:
            errors.append("Total upload exceeds 500KB.")
            break

        try:
            text = raw.decode("utf-8", errors="replace")[:MAX_FILE_CHARS]
            parsed.append({"name": upload.filename, "content": text})
        except Exception:
            errors.append(f'"{upload.filename}" could not be decoded.')

    if not parsed:
        raise HTTPException(400, "No readable files. " + " | ".join(errors))

    combined = "\n".join(f["content"] for f in parsed)
    file_contents = format_file_contents(parsed)

    return {
        "file_contents": file_contents,
        "file_count": len(parsed),
        "skills_detected": detect_skills(combined),
        "suggested_difficulty": suggest_difficulty(combined),
        "errors": errors,
    }


@app.post("/quiz/generate")
def generate_quiz(req: QuizRequest):
    if req.difficulty not in ("Beginner", "Intermediate", "Advanced"):
        raise HTTPException(400, "Invalid difficulty.")
    if not (1 <= req.count <= 15):
        raise HTTPException(400, "count must be 1–15.")
    try:
        questions = generate_questions(req.file_contents, req.difficulty, req.count)
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(500, f"Failed to generate questions: {e}")


@app.post("/quiz/evaluate")
def evaluate_answer(req: EvaluateRequest):
    try:
        return evaluate_open_ended(req.question, req.ideal_answer, req.user_answer)
    except Exception as e:
        raise HTTPException(500, f"Evaluation failed: {e}")