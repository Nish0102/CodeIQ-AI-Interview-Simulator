# core/question_generator.py

def generate_questions(analysis_result, difficulty="easy"):
    questions = []

    if difficulty == "easy":
        if analysis_result["functions"]:
            questions.append(
                f"Can you explain what the function '{analysis_result['functions'][0]}' does?"
            )
        questions.append("What is the time complexity of the loops used?")

    elif difficulty == "medium":
        if analysis_result["recursion_detected"]:
            questions.append("Can you convert this recursive solution into an iterative one?")
        questions.append("What edge cases might break this code?")

    elif difficulty == "hard":
        questions.append("How would you optimize this code for handling 10^7 inputs?")
        questions.append("Can you refactor this code to reduce space complexity?")

    return questions