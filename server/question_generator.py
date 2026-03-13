import json
from helpers import call_model
from constants import DIFFICULTY_PROMPTS

ADAPTIVE_LIMITS = {"Beginner": 3, "Intermediate": 4, "Advanced": 999}
ADAPTIVE_ORDER = ["Beginner", "Intermediate", "Advanced"]


def get_adaptive_difficulty(q_index: int, current_score: int) -> str:
    answered = q_index
    if answered < 3:
        return "Beginner"
    elif answered < 7:
        score_pct = (current_score / answered) * 100 if answered > 0 else 0
        return "Intermediate" if score_pct >= 50 else "Beginner"
    else:
        score_pct = (current_score / answered) * 100 if answered > 0 else 0
        if score_pct >= 65:
            return "Advanced"
        elif score_pct >= 40:
            return "Intermediate"
        else:
            return "Beginner"


def generate_questions(file_contents: str, difficulty: str, count: int) -> list[dict]:
    instruction = DIFFICULTY_PROMPTS.get(difficulty, DIFFICULTY_PROMPTS["Intermediate"])
    trimmed = file_contents[:2000]

    prompt = f"""Generate exactly {count} quiz questions about this code. Difficulty: {difficulty}. {instruction}

Mix types: multiple_choice, true_false, open_ended.
Return ONLY a JSON array, no markdown:
[
  {{"type":"multiple_choice","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A","explanation":"...","concept":"..."}},
  {{"type":"true_false","question":"...","options":["True","False"],"answer":"True","explanation":"...","concept":"..."}},
  {{"type":"open_ended","question":"...","options":[],"answer":"...","explanation":"...","concept":"..."}}
]

CODE:
{trimmed}"""

    raw = call_model(prompt)
    cleaned = raw[raw.find("["):raw.rfind("]") + 1]
    questions = json.loads(cleaned)

    for i, q in enumerate(questions):
        q["difficulty_level"] = get_adaptive_difficulty(i, 0)

    return questions


def generate_hint(question: str, ideal_answer: str, client=None) -> str:
    prompt = f"""Give a single short hint (1-2 sentences) for this question without revealing the answer.
Question: {question}
Answer (do not reveal): {ideal_answer}
Respond with ONLY the hint."""
    return call_model(prompt).strip()


def evaluate_open_ended(question: str, ideal_answer: str, user_answer: str) -> dict:
    keywords = [w.lower().strip(".,()[]{}:;\"'") for w in ideal_answer.split() if len(w) > 4]
    user_lower = user_answer.lower()
    matched = [kw for kw in keywords if kw in user_lower]
    keyword_score = len(matched) / len(keywords) if keywords else 0

    prompt = f"""Evaluate this answer. Respond ONLY in JSON, no markdown:
Question: {question}
Ideal: {ideal_answer}
Student: {user_answer}

{{"score": <0-10>, "feedback": "<2-3 sentences starting with Score: X/10>", "missing": "<missing concept or 'Nothing major'>"}}"""

    raw = call_model(prompt).strip()
    try:
        cleaned = raw[raw.find("{"):raw.rfind("}") + 1]
        result = json.loads(cleaned)
        ai_score = int(result.get("score", 0))
        feedback = result.get("feedback", raw)
        missing = result.get("missing", "")
    except Exception:
        ai_score = 5 if keyword_score >= 0.5 else 2
        feedback = raw
        missing = ""

    combined = (ai_score / 10) * 0.6 + keyword_score * 0.4
    correct = combined >= 0.5

    return {
        "correct": correct,
        "feedback": feedback,
        "missing": missing,
        "keywords_matched": matched,
        "keyword_score": round(keyword_score * 100),
        "ai_score": ai_score,
        "partial_credit": round(combined * 10, 1)
    }


def check_content_safety(text: str) -> dict:
    stripped = text.strip()
    if len(stripped) < 3:
        return {"safe": False, "reason": "Answer is too short."}
    alpha_ratio = sum(c.isalpha() for c in stripped) / len(stripped)
    if alpha_ratio < 0.4:
        return {"safe": False, "reason": "Answer appears to contain random characters."}
    words = stripped.split()
    if all(len(w) <= 2 for w in words) and len(words) > 3:
        return {"safe": False, "reason": "Answer appears to be random letters."}

    prompt = f"""Is this text safe? Check for slurs, NSFW, hate speech, self-harm, spam.
Text: "{text}"
Respond ONLY: {{"safe": true, "reason": ""}} or {{"safe": false, "reason": "reason here"}}"""

    try:
        raw = call_model(prompt).strip()
        cleaned = raw[raw.find("{"):raw.rfind("}") + 1]
        result = json.loads(cleaned)
        return {"safe": bool(result.get("safe", True)), "reason": result.get("reason", "")}
    except Exception:
        return {"safe": True, "reason": ""}


def generate_notes(file_contents: str) -> dict:
    trimmed = file_contents[:2000]

    prompt = f"""Analyze this code and return study notes as ONLY valid JSON, no markdown:
{{
  "title": "Study Notes: <main topic>",
  "sections": [
    {{
      "heading": "...",
      "summary": "2-3 sentences",
      "bullets": ["point 1", "point 2", "point 3"],
      "flashcards": [
        {{"front": "Question?", "back": "Answer"}},
        {{"front": "Question?", "back": "Answer"}}
      ]
    }}
  ]
}}

Generate 3-4 sections. CODE:
{trimmed}"""

    try:
        raw = call_model(prompt).strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception as e:
        return {
            "title": "Study Notes",
            "sections": [{
                "heading": "Error generating notes",
                "summary": str(e),
                "bullets": [],
                "flashcards": []
            }]
        }
