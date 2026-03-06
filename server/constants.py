OLLAMA_MODEL = "llama3"
OLLAMA_HOST  = "http://localhost:11434"

DIFFICULTY_PROMPTS = {
    "Beginner": (
        "Ask simple beginner-friendly questions about what the code does at a high level. "
        "Focus on purpose, basic syntax, and obvious functionality."
    ),
    "Intermediate": (
        "Ask intermediate questions about how the code works, design patterns used, "
        "data flow, and why certain approaches were chosen."
    ),
    "Advanced": (
        "Ask advanced questions about architecture decisions, performance implications, "
        "edge cases, potential bugs, security concerns, and how to improve the code."
    ),
}

BLOCKED_EXTENSIONS = {
    "exe", "dll", "so", "dylib", "bin", "class", "pyc", "o", "a", "wasm",
    "mp4", "mp3", "wav", "avi", "mov", "mkv", "flac", "ogg", "webm",
    "jpg", "jpeg", "png", "gif", "bmp", "ico", "webp", "tiff",
    "zip", "tar", "gz", "rar", "7z", "bz2",
    "parquet", "feather", "hdf5", "h5", "npy", "npz", "arrow", "avro", "orc",
}

MAX_FILE_SIZE_BYTES  = 100 * 1024
MAX_TOTAL_SIZE_BYTES = 500 * 1024
MAX_FILE_COUNT       = 20
MAX_FILE_CHARS       = 3000