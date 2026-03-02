import streamlit as st
from core.ast_analyzer import analyze_code
from core.question_generator import generate_questions

st.title("🧠 CodeIQ - AI Code Interview Simulator")

uploaded_file = st.file_uploader("Upload a Python file", type=["py"])

difficulty = st.selectbox(
    "Select Difficulty",
    ["easy", "medium", "hard"]
)

if uploaded_file:
    code = uploaded_file.read().decode("utf-8")
    
    analysis = analyze_code(code)
    
    st.subheader("📊 Code Analysis")
    st.json(analysis)

    questions = generate_questions(analysis, difficulty)

    st.subheader("🎯 Interview Questions")
    for q in questions:
        st.write("-", q)