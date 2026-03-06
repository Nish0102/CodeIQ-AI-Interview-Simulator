import ollama
from constants import BLOCKED_EXTENSIONS, MAX_FILE_SIZE_BYTES, OLLAMA_MODEL, OLLAMA_HOST


def validate_file(filename: str, size: int) -> str | None:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in BLOCKED_EXTENSIONS:
        return f'"{filename}" — binary/media files cannot be read as text.'
    if size > MAX_FILE_SIZE_BYTES:
        return f'"{filename}" — exceeds 100KB limit ({size // 1024}KB).'
    return None


def format_file_contents(files: list[dict]) -> str:
    return "\n\n".join(f"=== FILE: {f['name']} ===\n{f['content']}" for f in files)


def call_model(prompt: str) -> str:
    client = ollama.Client(host=OLLAMA_HOST)
    response = client.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return response["message"]["content"]