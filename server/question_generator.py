import json
from helpers import call_model
from constants import DIFFICULTY_PROMPTS


def generate_questions(file_contents: str, difficulty: str, count: int) -> list[dict]:
    instruction = DIFFICULTY_PROMPTS.get(difficulty, DIFFICULTY_PROMPTS["Intermediate"])

    prompt = f"""You are a technical quiz generator. Analyze the following project files and generate exactly {count} quiz questions.

DIFFICULTY: {difficulty}
INSTRUCTIONS: {instruction}

Generate a MIX of these types: multiple_choice (4 options A/B/C/D), true_false, open_ended.

Return ONLY a valid JSON array, no explanation, no markdown:
[
  {{"type":"multiple_choice","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A","explanation":"..."}},
  {{"type":"true_false","question":"...","options":["True","False"],"answer":"True","explanation":"..."}},
  {{"type":"open_ended","question":"...","options":[],"answer":"ideal answer here","explanation":"..."}}
]

PROJECT FILES:
{file_contents}"""

    raw = call_model(prompt)
    cleaned = raw[raw.find("["):raw.rfind("]") + 1]
    return json.loads(cleaned)


def evaluate_open_ended(question: str, ideal_answer: str, user_answer: str) -> dict:
    prompt = f"""Question: {question}
Ideal Answer: {ideal_answer}
User's Answer: {user_answer}

Evaluate in 2-3 sentences. Start with exactly "Good answer!" or "Needs improvement." then explain why."""

    feedback = call_model(prompt).strip()
    return {
        "correct": feedback.lower().startswith("good"),
        "feedback": feedback
    }