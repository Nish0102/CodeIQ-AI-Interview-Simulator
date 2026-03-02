# core/ast_analyzer.py

import ast

class CodeAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.functions = []
        self.classes = []
        self.loops = 0
        self.recursion = False
        self.imports = []
        self.list_comprehensions = 0

    def visit_FunctionDef(self, node):
        self.functions.append(node.name)
        
        # Check recursion
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name) and child.func.id == node.name:
                    self.recursion = True
        
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        self.classes.append(node.name)
        self.generic_visit(node)

    def visit_For(self, node):
        self.loops += 1
        self.generic_visit(node)

    def visit_While(self, node):
        self.loops += 1
        self.generic_visit(node)

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append(alias.name)

    def visit_ImportFrom(self, node):
        if node.module:
            self.imports.append(node.module)

    def visit_ListComp(self, node):
        self.list_comprehensions += 1
        self.generic_visit(node)

def analyze_code(code_string):
    tree = ast.parse(code_string)
    analyzer = CodeAnalyzer()
    analyzer.visit(tree)

    return {
        "functions": analyzer.functions,
        "classes": analyzer.classes,
        "loop_count": analyzer.loops,
        "recursion_detected": analyzer.recursion,
        "imports": analyzer.imports,
        "list_comprehensions": analyzer.list_comprehensions
    }