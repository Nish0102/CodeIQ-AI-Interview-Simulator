from ast_analyzer import analyze


def suggest_difficulty(source_code: str) -> str:
    a = analyze(source_code)
    score = 0
    score += 2 if a["recursion_detected"] else 0
    score += min(a["loop_count"], 3)
    score += min(a["try_except_blocks"], 2)
    score += 1 if a["lambda_usage"] > 0 else 0
    score += 1 if a["list_comprehensions"] > 0 else 0
    score += 2 if a["class_count"] > 0 else 0
    score += 1 if a["function_count"] > 3 else 0

    if score <= 2:   return "Beginner"
    elif score <= 5: return "Intermediate"
    else:            return "Advanced"