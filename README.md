
Readme · MD
Copy

# 🧠 CodeIQ — AI-Powered Code Quiz Generator

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Ollama](https://img.shields.io/badge/Ollama-llama3-black?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)

> Upload your code files, detect skills automatically, and get quizzed by a local AI — completely free, no API keys needed.

---

## ✨ Features

- 📁 **File Upload** — Upload any text-based code file (.py, .js, .ts, .html, .css, .java, .go, .cpp, .json, .md and more)
- 🔍 **AST Analysis** — Automatically detects skills like Recursion, OOP, Exception Handling, Functional Programming, and more
- 🎯 **Adaptive Difficulty** — Choose Beginner, Intermediate, or Advanced — or let the AI suggest based on your code
- 🤖 **Local AI** — Powered by Ollama (llama3) — runs 100% on your machine, no API keys, no cost
- ❓ **Mixed Question Types** — Multiple choice, True/False, and Open-ended questions
- 📊 **Score Tracking** — Track your score with instant feedback on every answer

---

## 🖥️ Demo

```
Upload a file → AI detects skills → Choose difficulty → Get quizzed → See your score
```

---

## 🗂️ Project Structure

```
CodeIQ/
├── server/                  # FastAPI backend
│   ├── app.py               # Main API routes
│   ├── ast_analyzer.py      # AST parsing & code analysis
│   ├── pattern_detector.py  # Skill detection from AST
│   ├── difficulty_engine.py # Auto difficulty suggestion
│   ├── question_generator.py# AI question generation & evaluation
│   ├── helpers.py           # File validation & Ollama client
│   └── constants.py         # Config & constants
└── frontend/                # React + Vite frontend
    └── src/
        └── App.jsx          # Main UI
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com) installed

### 1. Clone the repo

```bash
git clone https://github.com/Nish0102/CodeIQ-AI-Interview-Simulator.git
cd CodeIQ-AI-Interview-Simulator
```

### 2. Install Ollama & pull the model

Download Ollama from [ollama.com](https://ollama.com), then run:

```bash
ollama pull llama3
```

### 3. Set up the backend

```bash
cd server
pip install -r requirements.txt
```

### 4. Set up the frontend

```bash
cd frontend
npm install
```

---

## ▶️ Running the App

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd server
python -m uvicorn app:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open your browser at:
```
http://localhost:5173
