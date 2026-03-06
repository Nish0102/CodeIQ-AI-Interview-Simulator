from ast_analyzer import analyze


def detect_skills(source_code: str) -> list[str]:
    a = analyze(source_code)
    skills = []
    if a["recursion_detected"]:       skills.append("Recursion")
    if a["loop_count"] > 0:           skills.append("Iteration")
    if a["dictionary_usage"] > 0:     skills.append("Dictionary Usage")
    if a["list_comprehensions"] > 0:  skills.append("List Comprehensions")
    if a["try_except_blocks"] > 0:    skills.append("Exception Handling")
    if a["lambda_usage"] > 0:         skills.append("Functional Programming")
    if a["class_count"] > 0:          skills.append("Object-Oriented Programming")
    if a["function_count"] > 3:       skills.append("Modular Design")
    if a["import_count"] > 5:         skills.append("Dependency Management")
    return skills