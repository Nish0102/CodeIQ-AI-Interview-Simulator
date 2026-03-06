import ast
from typing import Any


def analyze(source_code: str) -> dict[str, Any]:
    result = {
        "recursion_detected": False,
        "loop_count": 0,
        "dictionary_usage": 0,
        "list_comprehensions": 0,
        "try_except_blocks": 0,
        "lambda_usage": 0,
        "function_count": 0,
        "class_count": 0,
        "import_count": 0,
    }
    try:
        tree = ast.parse(source_code)
    except SyntaxError:
        return result

    function_names = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            result["function_count"] += 1
            function_names.add(node.name)
        elif isinstance(node, ast.ClassDef):
            result["class_count"] += 1
        elif isinstance(node, (ast.For, ast.While)):
            result["loop_count"] += 1
        elif isinstance(node, ast.Dict):
            result["dictionary_usage"] += 1
        elif isinstance(node, ast.ListComp):
            result["list_comprehensions"] += 1
        elif isinstance(node, ast.Try):
            result["try_except_blocks"] += 1
        elif isinstance(node, ast.Lambda):
            result["lambda_usage"] += 1
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            result["import_count"] += 1
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in function_names:
                result["recursion_detected"] = True
    return result