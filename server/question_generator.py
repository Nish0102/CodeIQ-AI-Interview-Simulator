import json
from helpers import call_model
from constants import DIFFICULTY_PROMPTS


# ── Adaptive difficulty limits ────────────────────────────────────
# Each level has a max number of questions before forcing next level
ADAPTIVE_LIMITS = {
    "Beginner":     3,
    "Intermediate": 4,
    "Advanced":     999,
}

ADAPTIVE_ORDER = ["Beginner", "Intermediate", "Advanced"]


def get_adaptive_difficulty(q_index: int, current_score: int) -> str:
    """
    Starts at Beginner and scales up based on performance.
    - Questions 0-2: Beginner
    - Questions 3-6: Intermediate (if scoring >50%)
    - Questions 7+: Advanced (if scoring >65%)
    """
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

    prompt = f"""You are a technical quiz generator. Analyze the following project files and generate exactly {count} quiz questions.

DIFFICULTY: {difficulty}
INSTRUCTIONS: {instruction}

Generate a MIX of these types: multiple_choice (4 options A/B/C/D), true_false, open_ended.

Return ONLY a valid JSON array, no explanation, no markdown:
[
  {{"type":"multiple_choice","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A","explanation":"...","concept":"e.g. Recursion / OOP / Error Handling"}},
  {{"type":"true_false","question":"...","options":["True","False"],"answer":"True","explanation":"...","concept":"..."}},
  {{"type":"open_ended","question":"...","options":[],"answer":"ideal answer here","explanation":"...","concept":"..."}}
]

Each question must include a "concept" field identifying the CS/programming concept it tests.

PROJECT FILES:
{file_contents}"""

    raw = call_model(prompt)
    cleaned = raw[raw.find("["):raw.rfind("]") + 1]
    questions = json.loads(cleaned)

    # Tag each question with adaptive difficulty level
    for i, q in enumerate(questions):
        q["difficulty_level"] = get_adaptive_difficulty(i, 0)

    return questions


def generate_hint(question: str, ideal_answer: str, client=None) -> str:
    """
    Generates a hint that nudges without giving away the answer.
    """
    prompt = f"""You are a helpful tutor. Give a single short hint (1-2 sentences max) for this question.
DO NOT give away the answer. Just nudge the student in the right direction.

Question: {question}
Correct Answer (do not reveal): {ideal_answer}

Respond with ONLY the hint, nothing else."""

    return call_model(prompt).strip()


def evaluate_open_ended(question: str, ideal_answer: str, user_answer: str) -> dict:
    """
    Evaluates open-ended answers with:
    - Keyword matching (weighted)
    - AI scoring on 0-10 scale
    - Partial credit
    """
    # Extract meaningful keywords (>4 chars) from ideal answer
    keywords = [w.lower().strip(".,()[]{}:;\"'") for w in ideal_answer.split() if len(w) > 4]
    user_lower = user_answer.lower()
    matched = [kw for kw in keywords if kw in user_lower]
    keyword_score = len(matched) / len(keywords) if keywords else 0

    prompt = f"""You are a strict but fair technical evaluator.

Question: {question}
Ideal Answer: {ideal_answer}
Student's Answer: {user_answer}

Score the student's answer from 0 to 10 based on:
- Accuracy of key concepts (40%)
- Completeness (30%)
- Clarity (30%)

Respond in this exact JSON format, no markdown:
{{
  "score": <number 0-10>,
  "feedback": "<2-3 sentence evaluation. Start with the score like: Score: 7/10 — then explain>",
  "missing": "<what key concept was missing, or 'Nothing major' if score >= 7>"
}}"""

    raw = call_model(prompt).strip()
    try:
        # Extract JSON safely
        cleaned = raw[raw.find("{"):raw.rfind("}") + 1]
        result = json.loads(cleaned)
        ai_score = int(result.get("score", 0))
        feedback = result.get("feedback", raw)
        missing = result.get("missing", "")
    except Exception:
        # Fallback if AI doesn't return proper JSON
        ai_score = 5 if keyword_score >= 0.5 else 2
        feedback = raw
        missing = ""

    # Combined score: 60% AI + 40% keyword matching
    combined = (ai_score / 10) * 0.6 + keyword_score * 0.4
    correct = combined >= 0.5  # 50% threshold to pass

    return {
        "correct": correct,
        "feedback": feedback,
        "missing": missing,
        "keywords_matched": matched,
        "keyword_score": round(keyword_score * 100),
        "ai_score": ai_score,
        "partial_credit": round(combined * 10, 1)  # out of 10
    }


def check_content_safety(text: str) -> dict:
    """
    Checks user input for violations: NSFW, slurs, hate speech,
    random gibberish, self-harm, etc.
    Returns {safe: bool, reason: str}
    """
    # Quick local checks first (fast, no AI needed)
    stripped = text.strip()

    # Too short or random characters
    if len(stripped) < 3:
        return {"safe": False, "reason": "Answer is too short to evaluate."}

    # Check for gibberish: high ratio of non-alphabetic chars or repeated chars
    alpha_ratio = sum(c.isalpha() for c in stripped) / len(stripped)
    if alpha_ratio < 0.4:
        return {"safe": False, "reason": "Your answer appears to contain random characters. Please provide a meaningful response."}

    # Check for repeated single characters like "aaaaaaa" or "asdfasdf"
    words = stripped.split()
    if all(len(w) <= 2 for w in words) and len(words) > 3:
        return {"safe": False, "reason": "Your answer appears to be random letters. Please provide a meaningful response."}

    # AI-based content check for slurs, NSFW, hate speech, self-harm
    prompt = f"""You are a content moderation system. Analyze this text for violations.

Text: "{text}"

Check for: racial slurs, hate speech, NSFW/sexual content, self-harm references, spam/gibberish, or completely off-topic responses.

Respond ONLY in this JSON format:
{{"safe": true/false, "reason": "brief reason if unsafe, empty string if safe"}}"""

    try:
        raw = call_model(prompt).strip()
        cleaned = raw[raw.find("{"):raw.rfind("}") + 1]
        result = json.loads(cleaned)
        return {
            "safe": bool(result.get("safe", True)),
            "reason": result.get("reason", "")
        }
    except Exception:
        return {"safe": True, "reason": ""}
