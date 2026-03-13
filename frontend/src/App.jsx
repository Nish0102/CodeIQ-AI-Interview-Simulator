import { useState, useCallback, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";

const DIFFICULTY_CONFIG = {
  Beginner:     { color: "#4ade80", bg: "#052e16", desc: "Basic concepts & surface-level understanding" },
  Intermediate: { color: "#facc15", bg: "#1c1505", desc: "Logic, patterns & deeper understanding" },
  Advanced:     { color: "#f87171", bg: "#1c0505", desc: "Architecture, edge cases & expert knowledge" },
};

function getFileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  const map = { js:"🟨",ts:"🔷",jsx:"⚛️",tsx:"⚛️",py:"🐍",java:"☕",cpp:"⚙️",c:"⚙️",go:"🐹",rs:"🦀",html:"🌐",css:"🎨",json:"📋",md:"📝",txt:"📄",sql:"🗃️" };
  return map[ext] || "📄";
}

function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1024*1024) return (b/1024).toFixed(1) + " KB";
  return (b/(1024*1024)).toFixed(1) + " MB";
}

const API = "http://127.0.0.1:8000";
const TIMER_SECONDS = 60;
const STORAGE_KEY = "codeiq_history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
}

function exportNotesPDF(notes) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  const addLine = (text, size=11, color=[60,60,80], bold=false) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(String(text), W - 30);
    doc.text(lines, 15, y);
    y += lines.length * (size * 0.5) + 2;
  };

  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, W, 40, "F");
  doc.setFontSize(20);
  doc.setTextColor(165, 180, 252);
  doc.setFont("helvetica", "bold");
  doc.text(notes.title || "Study Notes", 15, 25);
  y = 50;

  notes.sections.forEach((sec, i) => {
    addLine(sec.heading, 14, [165, 180, 252], true);
    y += 2;
    addLine(sec.summary, 11, [180, 180, 200]);
    y += 3;
    sec.bullets.forEach(b => addLine(`• ${b}`, 10, [140, 140, 170]));
    y += 4;
    if (sec.flashcards?.length) {
      addLine("Flashcards:", 10, [99, 102, 241], true);
      sec.flashcards.forEach(fc => {
        addLine(`Q: ${fc.front}`, 10, [200, 200, 220]);
        addLine(`A: ${fc.back}`, 10, [140, 180, 140]);
        y += 2;
      });
    }
    doc.setDrawColor(50, 50, 80);
    doc.line(15, y, W-15, y);
    y += 8;
  });

  doc.save("CodeIQ_Notes.pdf");
}

function exportPDF(questions, answers, feedback, score, difficulty, skillsDetected) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  const addLine = (text, size=11, color=[60,60,80], bold=false) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(size);
    doc.setTextColor(...color);
    if (bold) doc.setFont("helvetica","bold");
    else doc.setFont("helvetica","normal");
    const lines = doc.splitTextToSize(String(text), W - 30);
    doc.text(lines, 15, y);
    y += lines.length * (size * 0.5) + 2;
  };

  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, W, 40, "F");
  doc.setFontSize(22);
  doc.setTextColor(165, 180, 252);
  doc.setFont("helvetica", "bold");
  doc.text("CodeIQ Quiz Results", 15, 25);
  y = 50;

  addLine(`Difficulty: ${difficulty}`, 12, [100,100,140], true);
  addLine(`Score: ${score} out of ${questions.length}`, 12, [100,100,140], true);
  addLine(`Skills: ${skillsDetected.join(", ") || "N/A"}`, 11, [120,120,150]);
  addLine(`Date: ${new Date().toLocaleString()}`, 11, [120,120,150]);
  y += 6;

  doc.setDrawColor(99, 102, 241);
  doc.line(15, y, W-15, y);
  y += 10;

  questions.forEach((q, i) => {
    const fb = feedback[i];
    const correct = fb?.correct;
    const userAns = answers[i] || "Not answered";
    doc.setFillColor(correct ? 5 : 28, correct ? 46 : 5, correct ? 22 : 5);
    doc.roundedRect(12, y-4, W-24, 8, 2, 2, "F");
    addLine(`Q${i+1}  ${q.concept ? `[${q.concept}]` : ""}  ${correct ? "✓ CORRECT" : "✗ INCORRECT"}`, 11,
      correct ? [74,222,128] : [248,113,113], true);
    addLine(q.question, 11, [220, 220, 240]);
    y += 2;
    addLine(`Your Answer:    ${userAns}`, 10, correct ? [74,222,128] : [248,113,113]);
    addLine(`Correct Answer: ${q.answer}`, 10, [74, 222, 128]);
    if (q.explanation) addLine(`Explanation: ${q.explanation}`, 10, [150, 150, 180]);
    if (fb?.text && q.type === "open_ended") addLine(`AI Feedback: ${fb.text}`, 10, [150, 150, 180]);
    if (fb?.missing && fb.missing !== "Nothing major") addLine(`Missing: ${fb.missing}`, 10, [252, 165, 165]);
    y += 6;
    doc.setDrawColor(50, 50, 80);
    doc.line(15, y, W-15, y);
    y += 8;
  });

  doc.save("CodeIQ_Results.pdf");
}

function HistoryChart({ history }) {
  if (!history.length) return null;
  const max = Math.max(...history.map(h => h.total), 1);
  const recent = [...history].reverse().slice(0, 10);
  return (
    <div>
      <div style={{fontSize:12,fontFamily:"monospace",color:"#6b7280",marginBottom:14}}>
        PAST {recent.length} ATTEMPT{recent.length>1?"S":""}
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:80,padding:"0 4px"}}>
        {recent.map((h,i) => {
          const pct = h.score / h.total;
          const color = pct >= 0.7 ? "#4ade80" : pct >= 0.4 ? "#facc15" : "#f87171";
          const barH = Math.max((h.score/max)*64, 8);
          return (
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:10,fontFamily:"monospace",color,fontWeight:700}}>{h.score}/{h.total}</div>
              <div style={{width:"100%",background:color,borderRadius:"4px 4px 0 0",height:`${barH}px`,opacity:0.85,transition:"height 0.3s"}}/>
              <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>{h.difficulty.slice(0,3)}</div>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:12,display:"flex",gap:16,justifyContent:"center"}}>
        {[["#4ade80","≥70%"],["#facc15","40-69%"],["#f87171","<40%"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:8,height:8,borderRadius:2,background:c}}/>
            <span style={{fontSize:10,color:"#6b7280",fontFamily:"monospace"}}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Flashcard({ front, back }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div onClick={() => setFlipped(f => !f)} style={{cursor:"pointer", perspective:"1000px", height:100, marginBottom:10}}>
      <div style={{
        position:"relative", width:"100%", height:"100%",
        transformStyle:"preserve-3d",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        transition:"transform 0.4s ease"
      }}>
        {/* Front */}
        <div style={{
          position:"absolute", inset:0, backfaceVisibility:"hidden",
          background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.2)",
          borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center",
          justifyContent:"center", textAlign:"center"
        }}>
          <div>
            <div style={{fontSize:10,fontFamily:"monospace",color:"#6366f1",marginBottom:6}}>QUESTION — click to reveal</div>
            <div style={{fontSize:13,color:"#e8e8f0",fontWeight:600}}>{front}</div>
          </div>
        </div>
        {/* Back */}
        <div style={{
          position:"absolute", inset:0, backfaceVisibility:"hidden",
          transform:"rotateY(180deg)",
          background:"rgba(74,222,128,0.06)", border:"1px solid rgba(74,222,128,0.2)",
          borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center",
          justifyContent:"center", textAlign:"center"
        }}>
          <div>
            <div style={{fontSize:10,fontFamily:"monospace",color:"#4ade80",marginBottom:6}}>ANSWER</div>
            <div style={{fontSize:13,color:"#e8e8f0"}}>{back}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesPage({ fileContents, onBack }) {
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSection, setOpenSection] = useState(0);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await fetch(`${API}/notes/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_contents: fileContents })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setNotes(data);
      } catch(e) {
        setError("Failed to generate notes: " + e.message);
      }
      setLoading(false);
    };
    fetchNotes();
  }, []);

  const S = {
    card: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:24, marginBottom:12 },
    sectionBtn: (open) => ({ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", background:"none", border:"none", cursor:"pointer", padding:"4px 0", color: open ? "#a5b4fc" : "#e8e8f0", textAlign:"left" }),
    bullet: { display:"flex", alignItems:"flex-start", gap:8, marginBottom:8, fontSize:13, color:"#c4b5fd", lineHeight:1.5 },
  };

  if (loading) return (
    <div style={{...S.card, textAlign:"center", padding:"56px 24px"}}>
      <div style={{width:44,height:44,border:"3px solid rgba(99,102,241,0.2)",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 20px"}}/>
      <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>Generating study notes…</div>
      <div style={{fontSize:12,color:"#4b5563",fontFamily:"monospace"}}>Analysing concepts · Building flashcards · Structuring notes</div>
    </div>
  );

  if (error) return (
    <div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:12,padding:14,color:"#fca5a5",fontSize:13}}>
      ⚠ {error}
    </div>
  );

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:800,color:"#f0f0fa",margin:0}}>{notes.title}</h2>
          <div style={{fontSize:12,color:"#6b7280",fontFamily:"monospace",marginTop:4}}>{notes.sections.length} sections · {notes.sections.reduce((a,s)=>a+(s.flashcards?.length||0),0)} flashcards</div>
        </div>
        <button onClick={()=>exportNotesPDF(notes)} style={{padding:"9px 18px",borderRadius:10,border:"1px solid rgba(74,222,128,0.3)",background:"rgba(74,222,128,0.08)",color:"#4ade80",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          📄 Export PDF
        </button>
      </div>

      {notes.sections.map((sec, i) => (
        <div key={i} style={S.card}>
          <button style={S.sectionBtn(openSection===i)} onClick={()=>setOpenSection(openSection===i?-1:i)}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{width:26,height:26,borderRadius:8,background:"rgba(99,102,241,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontFamily:"monospace",color:"#a5b4fc",flexShrink:0}}>{i+1}</span>
              <span style={{fontSize:15,fontWeight:700}}>{sec.heading}</span>
            </div>
            <span style={{fontSize:18,color:"#6b7280"}}>{openSection===i?"▲":"▼"}</span>
          </button>

          {openSection===i && (
            <div style={{marginTop:16}}>
              <p style={{fontSize:13,color:"#9ca3af",lineHeight:1.7,marginBottom:16}}>{sec.summary}</p>

              {sec.bullets?.length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:10,fontFamily:"monospace",color:"#6366f1",marginBottom:10}}>KEY POINTS</div>
                  {sec.bullets.map((b,bi) => (
                    <div key={bi} style={S.bullet}>
                      <span style={{color:"#6366f1",flexShrink:0,marginTop:2}}>▸</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}

              {sec.flashcards?.length > 0 && (
                <div>
                  <div style={{fontSize:10,fontFamily:"monospace",color:"#6366f1",marginBottom:10}}>FLASHCARDS</div>
                  {sec.flashcards.map((fc,fi) => (
                    <Flashcard key={fi} front={fc.front} back={fc.back} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [qCount, setQCount] = useState(5);
  const [phase, setPhase] = useState("setup");
  const [activeTab, setActiveTab] = useState("quiz");
  const [questions, setQuestions] = useState([]);
  const [fileContents, setFileContents] = useState("");
  const [skillsDetected, setSkillsDetected] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [timings, setTimings] = useState({});
  const [score, setScore] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [hints, setHints] = useState({});
  const [hintLoading, setHintLoading] = useState(false);
  const [hintUsed, setHintUsed] = useState({});
  const [safetyWarning, setSafetyWarning] = useState("");
  const [safetyChecking, setSafetyChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [questionStart, setQuestionStart] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const fileRef = useRef();
  const timerRef = useRef();

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (timerActive && timeLeft === 0) {
      handleTimeout();
    }
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timeLeft]);

  const startTimer = () => {
    setTimeLeft(TIMER_SECONDS);
    setTimerActive(true);
    setQuestionStart(Date.now());
  };

  const stopTimer = () => {
    setTimerActive(false);
    clearTimeout(timerRef.current);
    const elapsed = questionStart ? Math.round((Date.now() - questionStart) / 1000) : TIMER_SECONDS;
    setTimings(t => ({ ...t, [current]: elapsed }));
  };

  const handleTimeout = () => {
    stopTimer();
    const q = questions[current];
    if (!feedback[current]) {
      setAnswers(a => ({ ...a, [current]: "⏱ Time's up" }));
      setFeedback(f => ({ ...f, [current]: {
        correct: false,
        text: `Time's up! Correct answer: ${q.answer}. ${q.explanation}`,
        timedOut: true
      }}));
    }
  };

  const addFiles = useCallback((newFiles) => {
    const incoming = Array.from(newFiles);
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...incoming.filter(f => !names.has(f.name))];
    });
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const generateQuiz = async () => {
    if (!files.length) { setError("Please upload at least one file."); return; }
    setError(""); setPhase("loading");
    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      const uploadRes = await fetch(`${API}/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error(await uploadRes.text());
      const uploadData = await uploadRes.json();
      setFileContents(uploadData.file_contents);
      setSkillsDetected(uploadData.skills_detected);

      const quizRes = await fetch(`${API}/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_contents: uploadData.file_contents, difficulty, count: qCount })
      });
      if (!quizRes.ok) throw new Error(await quizRes.text());
      const quizData = await quizRes.json();
      setQuestions(quizData.questions);
      setAnswers({}); setFeedback({}); setScore(0); setCurrent(0);
      setHints({}); setHintUsed({}); setTimings({}); setSafetyWarning("");
      setReviewMode(false); setActiveTab("quiz");
      setPhase("quiz");
      setTimeout(() => startTimer(), 100);
    } catch(e) {
      setError("Failed: " + e.message);
      setPhase("setup");
    }
  };

  const checkSafety = async (text) => {
    setSafetyChecking(true);
    try {
      const res = await fetch(`${API}/quiz/safety`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      setSafetyChecking(false);
      return data;
    } catch {
      setSafetyChecking(false);
      return { safe: true };
    }
  };

  const submitAnswer = async (idx, answer) => {
    const q = questions[idx];
    if (q.type === "open_ended") {
      const safety = await checkSafety(answer);
      if (!safety.safe) {
        setSafetyWarning(safety.reason || "Your answer violates community guidelines.");
        return;
      }
      setSafetyWarning("");
    }
    stopTimer();
    setAnswers(a => ({ ...a, [idx]: answer }));
    if (q.type === "open_ended") {
      try {
        const res = await fetch(`${API}/quiz/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q.question, ideal_answer: q.answer, user_answer: answer })
        });
        const data = await res.json();
        if (data.correct) setScore(s => s + 1);
        setFeedback(f => ({ ...f, [idx]: {
          correct: data.correct, text: data.feedback, missing: data.missing,
          keywords: data.keywords_matched, keywordScore: data.keyword_score,
          aiScore: data.ai_score, partialCredit: data.partial_credit,
        }}));
      } catch {
        setFeedback(f => ({ ...f, [idx]: { correct: null, text: `Model answer: ${q.answer}` }}));
      }
    } else {
      const correct = answer.trim().startsWith(q.answer.trim()) || answer.trim() === q.answer.trim();
      if (correct) setScore(s => s + 1);
      setFeedback(f => ({ ...f, [idx]: { correct, text: q.explanation, answer: q.answer }}));
    }
  };

  const next = () => {
    setSafetyWarning("");
    if (current < questions.length - 1) { setCurrent(c => c + 1); startTimer(); }
    else finishQuiz();
  };

  const finishQuiz = () => {
    stopTimer();
    const avgTime = Object.values(timings).length
      ? Math.round(Object.values(timings).reduce((a,b)=>a+b,0) / Object.values(timings).length) : 0;
    const entry = { date: new Date().toLocaleString(), score, total: questions.length, difficulty, avgTime, skills: skillsDetected };
    saveHistory(entry);
    setHistory(loadHistory());
    setPhase("results");
  };

  const getHint = async (idx) => {
    if (hintUsed[idx]) return;
    setHintLoading(true);
    try {
      const q = questions[idx];
      const res = await fetch(`${API}/quiz/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.question, ideal_answer: q.answer })
      });
      const data = await res.json();
      setHints(h => ({ ...h, [idx]: data.hint }));
      setHintUsed(h => ({ ...h, [idx]: true }));
    } catch {
      setHints(h => ({ ...h, [idx]: "Hint unavailable right now." }));
    }
    setHintLoading(false);
  };

  const restart = () => {
    setPhase("setup"); setQuestions([]); setAnswers({}); setFeedback({});
    setScore(0); setCurrent(0); setFiles([]); setSkillsDetected([]);
    setHints({}); setHintUsed({}); setTimings({}); setSafetyWarning("");
    setReviewMode(false); setTimerActive(false); setFileContents("");
  };

  const cfg = DIFFICULTY_CONFIG[difficulty];
  const q = questions[current];
  const answeredCount = Object.keys(feedback).length;
  const avgTime = Object.values(timings).length
    ? Math.round(Object.values(timings).reduce((a,b)=>a+b,0) / Object.values(timings).length) : 0;
  const timerColor = timeLeft > 30 ? "#4ade80" : timeLeft > 10 ? "#facc15" : "#f87171";
  const timerPct = (timeLeft / TIMER_SECONDS) * 100;

  const S = {
    app: { minHeight:"100vh", background:"#080810", color:"#e8e8f0", fontFamily:"'Segoe UI',sans-serif" },
    container: { maxWidth:720, width:"100%", margin:"0 auto", padding:"40px 24px", boxSizing:"border-box" },
    badge: { display:"inline-flex", alignItems:"center", gap:8, background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", padding:"6px 16px", borderRadius:100, fontSize:12, fontFamily:"monospace", color:"#a5b4fc", marginBottom:24, letterSpacing:"0.05em" },
    h1: { fontSize:"clamp(28px,4vw,44px)", fontWeight:800, lineHeight:1.05, letterSpacing:"-0.03em", color:"#f0f0fa", marginBottom:14 },
    grad: { background:"linear-gradient(135deg,#818cf8,#c084fc)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
    card: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:28, marginBottom:16 },
    cardTitle: { fontSize:11, fontFamily:"monospace", color:"#6366f1", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:18 },
    uploadZone: (over) => ({ border:`2px dashed rgba(99,102,241,${over?0.7:0.3})`, background:over?"rgba(99,102,241,0.05)":"transparent", borderRadius:14, padding:"40px 24px", textAlign:"center", cursor:"pointer", transition:"all 0.2s" }),
    fileItem: { display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.15)", borderRadius:10, padding:"10px 14px", fontFamily:"monospace", fontSize:13, marginBottom:8 },
    diffGrid: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 },
    diffBtn: (active, c) => ({ padding:"16px 14px", borderRadius:12, border:`1px solid ${active?c.color:"rgba(255,255,255,0.08)"}`, background:active?c.bg:"rgba(255,255,255,0.03)", cursor:"pointer", textAlign:"left", transition:"all 0.2s" }),
    genBtn: { width:"100%", padding:16, borderRadius:14, border:"none", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"white", fontSize:16, fontWeight:700, cursor:"pointer", marginTop:4 },
    spinner: { width:44, height:44, border:"3px solid rgba(99,102,241,0.2)", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 20px" },
    optBtn: (cls) => ({ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", borderRadius:12, border:`1px solid ${cls==="selected"?"rgba(99,102,241,0.6)":"rgba(255,255,255,0.08)"}`, background:cls==="selected"?"rgba(99,102,241,0.12)":"rgba(255,255,255,0.02)", cursor:"pointer", color:cls==="selected"?"#a5b4fc":"#d1d5db", fontSize:14, width:"100%", marginBottom:8, textAlign:"left", transition:"all 0.15s" }),
    optBtnReview: (cls) => ({ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", borderRadius:12, border:`1px solid ${cls==="correct"?"rgba(74,222,128,0.5)":cls==="incorrect"?"rgba(248,113,113,0.5)":cls==="selected"?"rgba(99,102,241,0.4)":"rgba(255,255,255,0.06)"}`, background:cls==="correct"?"rgba(74,222,128,0.08)":cls==="incorrect"?"rgba(248,113,113,0.08)":cls==="selected"?"rgba(99,102,241,0.08)":"transparent", color:cls==="correct"?"#4ade80":cls==="incorrect"?"#f87171":cls==="selected"?"#a5b4fc":"#6b7280", fontSize:14, width:"100%", marginBottom:8, textAlign:"left" }),
    primaryBtn: { padding:"9px 20px", borderRadius:10, border:"1px solid rgba(99,102,241,0.4)", background:"rgba(99,102,241,0.15)", color:"#a5b4fc", fontSize:13, fontWeight:600, cursor:"pointer" },
    errBox: { background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:12, padding:14, color:"#fca5a5", fontSize:13, marginBottom:16 },
    warnBox: { background:"rgba(250,204,21,0.08)", border:"1px solid rgba(250,204,21,0.25)", borderRadius:10, padding:12, color:"#fde047", fontSize:13, marginBottom:12 },
    scoreCircle: { width:110, height:110, borderRadius:"50%", background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))", border:"2px solid rgba(99,102,241,0.4)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" },
    skillBadge: { display:"inline-block", padding:"3px 10px", borderRadius:100, fontSize:11, fontFamily:"monospace", background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.25)", color:"#a5b4fc", margin:"3px" },
    kwBadge: { display:"inline-block", padding:"2px 7px", borderRadius:100, fontSize:11, fontFamily:"monospace", background:"rgba(99,102,241,0.2)", color:"#a5b4fc", margin:"2px" },
    actionBtn: (color) => ({ padding:"11px 20px", borderRadius:12, border:`1px solid ${color}44`, background:`${color}11`, color, fontSize:13, fontWeight:700, cursor:"pointer" }),
    tab: (active) => ({ padding:"8px 20px", borderRadius:10, border:`1px solid ${active?"rgba(99,102,241,0.5)":"rgba(255,255,255,0.08)"}`, background:active?"rgba(99,102,241,0.15)":"transparent", color:active?"#a5b4fc":"#6b7280", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }),
  };

  // Tab bar shown during quiz/results
  const showTabs = (phase === "quiz" || phase === "results") && fileContents;

  return (
    <div style={S.app}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        button:hover{filter:brightness(1.12)}
        *{box-sizing:border-box}
      `}</style>
      <div style={S.container}>

        {/* HEADER */}
        <div style={{textAlign:"center", marginBottom:44}}>
          <div style={S.badge}>⚡ CodeIQ</div>
          <h1 style={S.h1}>Turn your code into<br/><span style={S.grad}>a knowledge test</span></h1>
          <p style={{color:"#6b7280", fontSize:15, margin:0}}>Upload files · Choose difficulty · Get quizzed by AI</p>
        </div>

        {/* TABS */}
        {showTabs && (
          <div style={{display:"flex", gap:8, marginBottom:24}}>
            <button style={S.tab(activeTab==="quiz")} onClick={()=>setActiveTab("quiz")}>🧠 Quiz</button>
            <button style={S.tab(activeTab==="notes")} onClick={()=>setActiveTab("notes")}>📒 Study Notes</button>
          </div>
        )}

        {/* NOTES TAB */}
        {showTabs && activeTab === "notes" && (
          <NotesPage fileContents={fileContents} />
        )}

        {/* QUIZ TAB or setup/loading */}
        {(!showTabs || activeTab === "quiz") && <>

        {/* ── SETUP ── */}
        {phase === "setup" && <>
          {error && <div style={S.errBox}>⚠ {error}</div>}
          <div style={S.card}>
            <div style={S.cardTitle}>— Upload Files</div>
            <div style={S.uploadZone(dragOver)}
              onDragOver={e=>{e.preventDefault();setDragOver(true)}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={onDrop}
              onClick={()=>fileRef.current.click()}>
              <div style={{fontSize:32, marginBottom:10}}>📁</div>
              <div style={{fontSize:17, fontWeight:700, marginBottom:5}}>Drop files or click to browse</div>
              <div style={{fontSize:11, color:"#4b5563", fontFamily:"monospace", lineHeight:1.7}}>
                .py .js .ts .html .css .java .go .cpp .json .md .txt .sql and more<br/>
                Max 100KB per file · 500KB total · 20 files
              </div>
              <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>
            </div>
            {files.length > 0 && <div style={{marginTop:14}}>
              {files.map((f,i) => (
                <div key={i} style={S.fileItem}>
                  <div style={{display:"flex", alignItems:"center", gap:10, color:"#a5b4fc"}}>
                    <span>{getFileIcon(f.name)}</span><span>{f.name}</span>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:10}}>
                    <span style={{color:"#4b5563", fontSize:11}}>{formatBytes(f.size)}</span>
                    <button style={{background:"none", border:"none", color:"#4b5563", cursor:"pointer", fontSize:16, padding:"0 4px"}} onClick={()=>setFiles(fs=>fs.filter((_,j)=>j!==i))}>×</button>
                  </div>
                </div>
              ))}
            </div>}
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>— Difficulty Level</div>
            <div style={S.diffGrid}>
              {Object.entries(DIFFICULTY_CONFIG).map(([lvl,c]) => (
                <button key={lvl} style={S.diffBtn(difficulty===lvl, c)} onClick={()=>setDifficulty(lvl)}>
                  <div style={{fontSize:14, fontWeight:700, marginBottom:5, color:difficulty===lvl?c.color:"#e8e8f0"}}>{lvl}</div>
                  <div style={{fontSize:10, color:"#6b7280", fontFamily:"monospace", lineHeight:1.4}}>{c.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>— Number of Questions</div>
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <span style={{color:"#9ca3af", fontSize:14}}>How many?</span>
              <div style={{display:"flex", gap:8}}>
                {[3,5,7,10].map(n => (
                  <button key={n} onClick={()=>setQCount(n)}
                    style={{width:40, height:40, borderRadius:10, border:`1px solid ${qCount===n?"rgba(99,102,241,0.5)":"rgba(255,255,255,0.1)"}`, background:qCount===n?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.03)", color:qCount===n?"#a5b4fc":"#9ca3af", fontFamily:"monospace", fontSize:14, cursor:"pointer"}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {history.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>— Your Progress</div>
              <HistoryChart history={history} />
              <div style={{marginTop:12, padding:"10px 14px", borderRadius:10, background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.12)"}}>
                <div style={{fontSize:11, color:"#6b7280", fontFamily:"monospace", marginBottom:4}}>LAST ATTEMPT</div>
                <div style={{fontSize:13, color:"#a5b4fc"}}>{history[0].score}/{history[0].total} correct · {history[0].difficulty} · {history[0].date}</div>
              </div>
            </div>
          )}

          <button style={{...S.genBtn, opacity:files.length?1:0.45}} onClick={generateQuiz} disabled={!files.length}>
            Generate Quiz →
          </button>
        </>}

        {/* ── LOADING ── */}
        {phase === "loading" && (
          <div style={{...S.card, textAlign:"center", padding:"56px 24px"}}>
            <div style={S.spinner}/>
            <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>Analysing your code…</div>
            <div style={{fontSize:12, color:"#4b5563", fontFamily:"monospace"}}>Reading files · Detecting patterns · Generating questions</div>
          </div>
        )}

        {/* ── QUIZ ── */}
        {phase === "quiz" && q && <>
          {skillsDetected.length > 0 && (
            <div style={{marginBottom:16, display:"flex", flexWrap:"wrap", alignItems:"center", gap:4}}>
              <span style={{fontSize:11, color:"#6b7280", fontFamily:"monospace", marginRight:4}}>Skills:</span>
              {skillsDetected.map(s => <span key={s} style={S.skillBadge}>{s}</span>)}
            </div>
          )}

          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:8, flexWrap:"wrap"}}>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <span style={{padding:"4px 12px", borderRadius:100, fontSize:11, fontWeight:700, fontFamily:"monospace", background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}33`}}>{difficulty}</span>
              <span style={{color:"#6b7280", fontFamily:"monospace", fontSize:12}}>{current+1}/{questions.length}</span>
              {q.concept && <span style={{padding:"2px 8px", borderRadius:5, fontSize:10, fontFamily:"monospace", background:"rgba(99,102,241,0.1)", color:"#818cf8"}}>{q.concept}</span>}
            </div>
            <div style={{display:"flex", alignItems:"center", gap:14}}>
              <span style={{color:"#6b7280", fontFamily:"monospace", fontSize:12}}>
                {answeredCount > 0 ? `${score}/${answeredCount} correct` : "—"}
              </span>
              <div style={{position:"relative", width:38, height:38}}>
                <svg width="38" height="38" style={{transform:"rotate(-90deg)"}}>
                  <circle cx="19" cy="19" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3"/>
                  <circle cx="19" cy="19" r="15" fill="none" stroke={timerColor} strokeWidth="3"
                    strokeDasharray={`${2*Math.PI*15}`}
                    strokeDashoffset={`${2*Math.PI*15*(1-timerPct/100)}`}
                    style={{transition:"stroke-dashoffset 1s linear, stroke 0.5s"}}/>
                </svg>
                <div style={{position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontFamily:"monospace", fontWeight:700, color:timerColor}}>
                  {timeLeft}
                </div>
              </div>
            </div>
          </div>

          <div style={{height:3, background:"rgba(255,255,255,0.05)", borderRadius:2, marginBottom:20, overflow:"hidden"}}>
            <div style={{height:"100%", background:"linear-gradient(90deg,#6366f1,#8b5cf6)", width:`${((current+1)/questions.length)*100}%`, transition:"width 0.4s"}}/>
          </div>

          <div style={S.card}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
              <span style={{fontSize:10, fontFamily:"monospace", color:"#6366f1", letterSpacing:"0.1em"}}>QUESTION {current+1}</span>
              <span style={{display:"inline-block", padding:"2px 9px", borderRadius:5, fontSize:9, fontFamily:"monospace", background:q.type==="multiple_choice"?"rgba(99,102,241,0.15)":q.type==="true_false"?"rgba(250,204,21,0.1)":"rgba(139,92,246,0.15)", color:q.type==="multiple_choice"?"#a5b4fc":q.type==="true_false"?"#fde047":"#c4b5fd"}}>
                {q.type==="multiple_choice"?"MCQ":q.type==="true_false"?"TRUE/FALSE":"OPEN ENDED"}
              </span>
            </div>

            <div style={{fontSize:18, fontWeight:700, lineHeight:1.45, color:"#f0f0fa", marginBottom:20}}>{q.question}</div>

            {hints[current] && (
              <div style={{marginBottom:14, padding:10, borderRadius:9, background:"rgba(250,204,21,0.07)", border:"1px solid rgba(250,204,21,0.18)", fontSize:12, color:"#fde047", lineHeight:1.5}}>
                💡 {hints[current]}
              </div>
            )}

            {safetyWarning && <div style={S.warnBox}>⚠ {safetyWarning}</div>}

            {q.type !== "open_ended" ? (
              <div>
                {q.options.map((opt,i) => {
                  const sel = answers[current] === opt;
                  return (
                    <button key={i} style={S.optBtn(sel?"selected":"")} disabled={!!feedback[current]} onClick={()=>!feedback[current]&&submitAnswer(current,opt)}>
                      <span style={{width:26, height:26, borderRadius:7, background:"rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace", fontSize:11, flexShrink:0}}>
                        {["A","B","C","D","T","F"][i]}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
                {!feedback[current] && !hintUsed[current] && (
                  <button style={{...S.primaryBtn, background:"rgba(250,204,21,0.08)", borderColor:"rgba(250,204,21,0.25)", color:"#fde047", fontSize:12, marginTop:4}} onClick={()=>getHint(current)} disabled={hintLoading}>
                    {hintLoading?"…":"💡 Hint"}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <textarea value={answers[current]||""} onChange={e=>{setAnswers(a=>({...a,[current]:e.target.value}));setSafetyWarning("");}} disabled={!!feedback[current]}
                  placeholder="Type your answer here…"
                  style={{width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:11, padding:14, color:"#e8e8f0", fontFamily:"monospace", fontSize:13, resize:"vertical", minHeight:110, outline:"none"}}/>
                {!feedback[current] && (
                  <div style={{display:"flex", gap:9, marginTop:10}}>
                    <button style={S.primaryBtn} onClick={()=>answers[current]?.trim()&&submitAnswer(current,answers[current])} disabled={safetyChecking}>
                      {safetyChecking?"Checking…":"Submit Answer"}
                    </button>
                    {!hintUsed[current] && (
                      <button style={{...S.primaryBtn, background:"rgba(250,204,21,0.08)", borderColor:"rgba(250,204,21,0.25)", color:"#fde047"}} onClick={()=>getHint(current)} disabled={hintLoading}>
                        {hintLoading?"…":"💡 Hint"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {feedback[current] && !feedback[current].timedOut && (
              <div style={{marginTop:14, padding:10, borderRadius:9, background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.18)", fontSize:12, color:"#818cf8", fontFamily:"monospace"}}>
                ✓ Answer recorded — full results revealed at the end
              </div>
            )}
            {feedback[current]?.timedOut && (
              <div style={{marginTop:14, padding:10, borderRadius:9, background:"rgba(248,113,113,0.07)", border:"1px solid rgba(248,113,113,0.18)", fontSize:12, color:"#fca5a5"}}>
                ⏱ Time's up! Moving on…
              </div>
            )}
          </div>

          {feedback[current] && (
            <div style={{display:"flex", justifyContent:"flex-end"}}>
              <button style={S.primaryBtn} onClick={next}>
                {current<questions.length-1?"Next Question →":"See Results →"}
              </button>
            </div>
          )}
        </>}

        {/* ── RESULTS ── */}
        {phase === "results" && !reviewMode && (
          <div>
            <div style={{...S.card, textAlign:"center", padding:"44px 28px"}}>
              <div style={S.scoreCircle}>
                <div style={{fontSize:34, fontWeight:800, color:"#a5b4fc", lineHeight:1}}>{score}</div>
                <div style={{fontSize:13, color:"#6b7280", fontFamily:"monospace"}}>of {questions.length}</div>
              </div>
              <div style={{fontSize:26, fontWeight:800, marginBottom:6}}>
                {score===questions.length?"🎉 Perfect Score!":score>=questions.length*0.7?"💪 Great Job!":score>=questions.length*0.4?"📚 Keep Learning!":"🔁 Try Again!"}
              </div>
              <div style={{color:"#6b7280", fontSize:14, marginBottom:6}}>
                You answered <strong style={{color:"#a5b4fc"}}>{score} out of {questions.length}</strong> correctly on <strong>{difficulty}</strong>
              </div>
              {avgTime > 0 && (
                <div style={{color:"#4b5563", fontSize:12, fontFamily:"monospace", marginBottom:16}}>⏱ Avg {avgTime}s per question</div>
              )}
              {skillsDetected.length > 0 && (
                <div style={{marginBottom:20}}>{skillsDetected.map(s => <span key={s} style={S.skillBadge}>{s}</span>)}</div>
              )}
              <div style={{display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap"}}>
                <button style={S.actionBtn("#a5b4fc")} onClick={()=>setReviewMode(true)}>📋 Review</button>
                <button style={S.actionBtn("#4ade80")} onClick={()=>exportPDF(questions,answers,feedback,score,difficulty,skillsDetected)}>📄 Export PDF</button>
                <button style={S.actionBtn("#c084fc")} onClick={()=>setActiveTab("notes")}>📒 Study Notes</button>
                <button style={S.actionBtn("#a5b4fc")} onClick={restart}>← New Files</button>
                <button style={S.actionBtn("#a5b4fc")} onClick={generateQuiz}>↺ Retry</button>
              </div>
            </div>
            {history.length > 0 && (
              <div style={S.card}>
                <div style={S.cardTitle}>— Your Progress</div>
                <HistoryChart history={history} />
              </div>
            )}
          </div>
        )}

        {/* ── REVIEW MODE ── */}
        {phase === "results" && reviewMode && (
          <div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
              <h2 style={{fontSize:18, fontWeight:700, color:"#f0f0fa", margin:0}}>📋 Answer Review</h2>
              <button style={S.primaryBtn} onClick={()=>setReviewMode(false)}>← Back</button>
            </div>

            {questions.map((q, i) => {
              const fb = feedback[i];
              const userAns = answers[i] || "Not answered";
              const isCorrect = fb?.correct;
              return (
                <div key={i} style={{...S.card, border:`1px solid ${isCorrect?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.2)"}`, background:isCorrect?"rgba(74,222,128,0.03)":"rgba(248,113,113,0.03)", marginBottom:14}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
                    <div style={{display:"flex", alignItems:"center", gap:8}}>
                      <span style={{fontFamily:"monospace", fontSize:11, color:"#6b7280"}}>Q{i+1}</span>
                      {q.concept && <span style={{padding:"2px 7px", borderRadius:4, fontSize:10, fontFamily:"monospace", background:"rgba(99,102,241,0.1)", color:"#818cf8"}}>{q.concept}</span>}
                      {timings[i] && <span style={{fontSize:10, color:"#4b5563", fontFamily:"monospace"}}>⏱{timings[i]}s</span>}
                    </div>
                    <span style={{fontSize:12, fontWeight:700, color:isCorrect?"#4ade80":"#f87171"}}>
                      {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                    </span>
                  </div>

                  <div style={{fontSize:15, fontWeight:600, color:"#f0f0fa", marginBottom:14, lineHeight:1.4}}>{q.question}</div>

                  {q.type !== "open_ended" ? (
                    <div style={{marginBottom:12}}>
                      {q.options.map((opt, oi) => {
                        const isCorrectOpt = opt.trim().startsWith(q.answer.trim()) || opt.trim() === q.answer.trim();
                        const isUserOpt = userAns === opt;
                        const cls = isCorrectOpt ? "correct" : (isUserOpt && !isCorrectOpt) ? "incorrect" : "";
                        return (
                          <div key={oi} style={S.optBtnReview(cls)}>
                            <span style={{width:24, height:24, borderRadius:6, background:"rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace", fontSize:11, flexShrink:0}}>
                              {["A","B","C","D","T","F"][oi]}
                            </span>
                            <span style={{flex:1}}>{opt}</span>
                            {isCorrectOpt && <span style={{fontSize:11, color:"#4ade80"}}>✓ correct</span>}
                            {isUserOpt && !isCorrectOpt && <span style={{fontSize:11, color:"#f87171"}}>✗ your answer</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12}}>
                      <div style={{padding:10, borderRadius:9, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)"}}>
                        <div style={{fontSize:10, fontFamily:"monospace", color:"#6b7280", marginBottom:5}}>YOUR ANSWER</div>
                        <div style={{fontSize:13, color:isCorrect?"#4ade80":"#f87171", lineHeight:1.4}}>{userAns}</div>
                      </div>
                      <div style={{padding:10, borderRadius:9, background:"rgba(74,222,128,0.05)", border:"1px solid rgba(74,222,128,0.12)"}}>
                        <div style={{fontSize:10, fontFamily:"monospace", color:"#6b7280", marginBottom:5}}>IDEAL ANSWER</div>
                        <div style={{fontSize:13, color:"#4ade80", lineHeight:1.4}}>{q.answer}</div>
                      </div>
                    </div>
                  )}

                  {q.explanation && (
                    <div style={{padding:10, borderRadius:9, background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.14)", fontSize:13, color:"#a5b4fc", lineHeight:1.6, marginBottom:fb?.text&&q.type==="open_ended"?8:0}}>
                      <span style={{fontSize:10, fontFamily:"monospace", color:"#6366f1", display:"block", marginBottom:4}}>EXPLANATION</span>
                      {q.explanation}
                    </div>
                  )}

                  {fb?.text && q.type === "open_ended" && (
                    <div style={{padding:10, borderRadius:9, background:"rgba(139,92,246,0.07)", border:"1px solid rgba(139,92,246,0.14)", fontSize:13, color:"#c4b5fd", lineHeight:1.6, marginTop:8}}>
                      <span style={{fontSize:10, fontFamily:"monospace", color:"#8b5cf6", display:"block", marginBottom:4}}>AI FEEDBACK</span>
                      {fb.text}
                      {fb.keywords?.length > 0 && (
                        <div style={{marginTop:8}}>
                          <span style={{fontSize:11, opacity:0.7}}>Keywords: </span>
                          {fb.keywords.map(k => <span key={k} style={S.kwBadge}>{k}</span>)}
                          <span style={{fontSize:11, opacity:0.7, marginLeft:6}}>{fb.keywordScore}% · {fb.aiScore}/10</span>
                        </div>
                      )}
                      {fb.missing && fb.missing !== "Nothing major" && (
                        <div style={{marginTop:6, fontSize:12, color:"#fca5a5"}}>Missing: {fb.missing}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{display:"flex", gap:8, justifyContent:"center", marginTop:8, marginBottom:16}}>
              <button style={S.actionBtn("#a5b4fc")} onClick={()=>setReviewMode(false)}>← Back to Results</button>
              <button style={S.actionBtn("#4ade80")} onClick={()=>exportPDF(questions,answers,feedback,score,difficulty,skillsDetected)}>📄 Export PDF</button>
            </div>
          </div>
        )}

        </>}
      </div>
    </div>
  );
}
