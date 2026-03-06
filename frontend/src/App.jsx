import { useState, useCallback, useRef } from "react";

const DIFFICULTY_CONFIG = {
  Beginner: { color: "#4ade80", bg: "#052e16", desc: "Basic concepts & surface-level understanding" },
  Intermediate: { color: "#facc15", bg: "#1c1505", desc: "Logic, patterns & deeper understanding" },
  Advanced: { color: "#f87171", bg: "#1c0505", desc: "Architecture, edge cases & expert knowledge" },
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

export default function App() {
  const [files, setFiles] = useState([]);
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [qCount, setQCount] = useState(5);
  const [phase, setPhase] = useState("setup");
  const [questions, setQuestions] = useState([]);
  const [fileContents, setFileContents] = useState("");
  const [skillsDetected, setSkillsDetected] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [score, setScore] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

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
      // Step 1: Upload files
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      const uploadRes = await fetch(`${API}/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error(await uploadRes.text());
      const uploadData = await uploadRes.json();
      setFileContents(uploadData.file_contents);
      setSkillsDetected(uploadData.skills_detected);

      // Step 2: Generate quiz
      const quizRes = await fetch(`${API}/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_contents: uploadData.file_contents, difficulty, count: qCount })
      });
      if (!quizRes.ok) throw new Error(await quizRes.text());
      const quizData = await quizRes.json();
      setQuestions(quizData.questions);
      setAnswers({}); setFeedback({}); setScore(0); setCurrent(0);
      setPhase("quiz");
    } catch(e) {
      setError("Failed: " + e.message);
      setPhase("setup");
    }
  };

  const submitAnswer = async (idx, answer) => {
    const q = questions[idx];
    setAnswers(a => ({...a, [idx]: answer}));
    if (q.type === "open_ended") {
      try {
        const res = await fetch(`${API}/quiz/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q.question, ideal_answer: q.answer, user_answer: answer })
        });
        const data = await res.json();
        if (data.correct) setScore(s => s+1);
        setFeedback(f => ({...f, [idx]: { correct: data.correct, text: data.feedback }}));
      } catch {
        setFeedback(f => ({...f, [idx]: { correct: null, text: `Model answer: ${q.answer}` }}));
      }
    } else {
      const correct = answer.trim().startsWith(q.answer.trim()) || answer.trim() === q.answer.trim();
      if (correct) setScore(s => s+1);
      setFeedback(f => ({...f, [idx]: { correct, text: correct ? `✓ Correct! ${q.explanation}` : `✗ Answer: ${q.answer}. ${q.explanation}` }}));
    }
  };

  const next = () => { if (current < questions.length-1) setCurrent(c=>c+1); else setPhase("results"); };
  const restart = () => { setPhase("setup"); setQuestions([]); setAnswers({}); setFeedback({}); setScore(0); setCurrent(0); setFiles([]); setSkillsDetected([]); };

  const cfg = DIFFICULTY_CONFIG[difficulty];
  const q = questions[current];

  const S = {
    app: { minHeight:"100vh", background:"#080810", color:"#e8e8f0", fontFamily:"'Segoe UI',sans-serif" },
    container: { maxWidth:860, margin:"0 auto", padding:"40px 24px" },
    badge: { display:"inline-flex", alignItems:"center", gap:8, background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", padding:"6px 16px", borderRadius:100, fontSize:12, fontFamily:"monospace", color:"#a5b4fc", marginBottom:24, letterSpacing:"0.05em" },
    h1: { fontSize:"clamp(32px,5vw,50px)", fontWeight:800, lineHeight:1.05, letterSpacing:"-0.03em", color:"#f0f0fa", marginBottom:14 },
    grad: { background:"linear-gradient(135deg,#818cf8,#c084fc)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
    card: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:32, marginBottom:20 },
    cardTitle: { fontSize:12, fontFamily:"monospace", color:"#6366f1", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:20 },
    uploadZone: (over) => ({ border:`2px dashed rgba(99,102,241,${over?0.7:0.3})`, background:over?"rgba(99,102,241,0.05)":"transparent", borderRadius:16, padding:"48px 24px", textAlign:"center", cursor:"pointer", transition:"all 0.2s" }),
    fileItem: { display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.15)", borderRadius:10, padding:"10px 14px", fontFamily:"monospace", fontSize:13, marginBottom:8 },
    diffGrid: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 },
    diffBtn: (active, c) => ({ padding:"20px 16px", borderRadius:14, border:`1px solid ${active?c.color:"rgba(255,255,255,0.08)"}`, background:active?c.bg:"rgba(255,255,255,0.03)", cursor:"pointer", textAlign:"left", transition:"all 0.2s" }),
    genBtn: { width:"100%", padding:18, borderRadius:14, border:"none", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"white", fontSize:16, fontWeight:700, cursor:"pointer" },
    spinner: { width:48, height:48, border:"3px solid rgba(99,102,241,0.2)", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 20px" },
    optBtn: (cls) => ({ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", borderRadius:12, border:`1px solid ${cls==="correct"?"rgba(74,222,128,0.6)":cls==="incorrect"?"rgba(248,113,113,0.6)":cls==="selected"?"rgba(99,102,241,0.6)":"rgba(255,255,255,0.08)"}`, background:cls==="correct"?"rgba(74,222,128,0.1)":cls==="incorrect"?"rgba(248,113,113,0.1)":cls==="selected"?"rgba(99,102,241,0.12)":"rgba(255,255,255,0.02)", cursor:"pointer", color:cls==="correct"?"#4ade80":cls==="incorrect"?"#f87171":cls==="selected"?"#a5b4fc":"#d1d5db", fontSize:15, width:"100%", marginBottom:8, textAlign:"left" }),
    primaryBtn: { padding:"10px 22px", borderRadius:10, border:"1px solid rgba(99,102,241,0.4)", background:"rgba(99,102,241,0.15)", color:"#a5b4fc", fontSize:14, fontWeight:600, cursor:"pointer" },
    errBox: { background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:12, padding:16, color:"#fca5a5", fontSize:14, marginBottom:16 },
    scoreCircle: { width:120, height:120, borderRadius:"50%", background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))", border:"2px solid rgba(99,102,241,0.4)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", margin:"0 auto 24px" },
    skillBadge: { display:"inline-block", padding:"4px 12px", borderRadius:100, fontSize:11, fontFamily:"monospace", background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#a5b4fc", margin:"4px" },
  };

  return (
    <div style={S.app}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} button:hover{opacity:0.9}`}</style>
      <div style={S.container}>

        {/* HEADER */}
        <div style={{textAlign:"center", marginBottom:52}}>
          <div style={S.badge}>⚡ CodeIQ</div>
          <h1 style={S.h1}>Turn your code into<br/><span style={S.grad}>a knowledge test</span></h1>
          <p style={{color:"#6b7280", fontSize:16}}>Upload files · Choose difficulty · Get quizzed by AI</p>
        </div>

        {/* SETUP */}
        {phase === "setup" && <>
          {error && <div style={S.errBox}>⚠ {error}</div>}
          <div style={S.card}>
            <div style={S.cardTitle}>— Upload Files</div>
            <div style={S.uploadZone(dragOver)}
              onDragOver={e=>{e.preventDefault();setDragOver(true)}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={onDrop}
              onClick={()=>fileRef.current.click()}>
              <div style={{fontSize:36, marginBottom:12}}>📁</div>
              <div style={{fontSize:18, fontWeight:700, marginBottom:6}}>Drop files or click to browse</div>
              <div style={{fontSize:12, color:"#4b5563", fontFamily:"monospace"}}>
                .py .js .ts .html .css .java .go .cpp .json .md .txt .sql and more<br/>
                Max 100KB per file · 500KB total · 20 files
              </div>
              <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>
            </div>
            {files.length > 0 && <div style={{marginTop:16}}>
              {files.map((f,i) => (
                <div key={i} style={S.fileItem}>
                  <div style={{display:"flex", alignItems:"center", gap:10, color:"#a5b4fc"}}>
                    <span>{getFileIcon(f.name)}</span>
                    <span>{f.name}</span>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:10}}>
                    <span style={{color:"#4b5563", fontSize:11}}>{formatBytes(f.size)}</span>
                    <button style={{background:"none", border:"none", color:"#4b5563", cursor:"pointer", fontSize:16}} onClick={()=>setFiles(fs=>fs.filter((_,j)=>j!==i))}>×</button>
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
                  <div style={{fontSize:15, fontWeight:700, marginBottom:6, color:difficulty===lvl?c.color:"#e8e8f0"}}>{lvl}</div>
                  <div style={{fontSize:11, color:"#6b7280", fontFamily:"monospace"}}>{c.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>— Number of Questions</div>
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <span style={{color:"#9ca3af"}}>How many?</span>
              <div style={{display:"flex", gap:8}}>
                {[3,5,7,10].map(n => (
                  <button key={n} onClick={()=>setQCount(n)}
                    style={{width:40, height:40, borderRadius:10, border:`1px solid ${qCount===n?"rgba(99,102,241,0.5)":"rgba(255,255,255,0.1)"}`, background:qCount===n?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.03)", color:qCount===n?"#a5b4fc":"#9ca3af", fontFamily:"monospace", cursor:"pointer"}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button style={{...S.genBtn, opacity:files.length?1:0.5}} onClick={generateQuiz} disabled={!files.length}>
            Generate Quiz →
          </button>
        </>}

        {/* LOADING */}
        {phase === "loading" && <div style={{...S.card, textAlign:"center", padding:"60px 24px"}}>
          <div style={S.spinner}/>
          <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>Analysing your code…</div>
          <div style={{fontSize:13, color:"#4b5563", fontFamily:"monospace"}}>Reading files · Detecting patterns · Generating questions</div>
        </div>}

        {/* QUIZ */}
        {phase === "quiz" && q && <>
          {skillsDetected.length > 0 && (
            <div style={{marginBottom:20}}>
              <span style={{fontSize:12, color:"#6b7280", fontFamily:"monospace", marginRight:8}}>Skills detected:</span>
              {skillsDetected.map(s => <span key={s} style={S.skillBadge}>{s}</span>)}
            </div>
          )}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <span style={{padding:"5px 14px", borderRadius:100, fontSize:12, fontWeight:700, fontFamily:"monospace", background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}33`}}>{difficulty}</span>
              <span style={{color:"#6b7280", fontFamily:"monospace", fontSize:13}}>{current+1} / {questions.length}</span>
            </div>
            <span style={{color:"#6b7280", fontFamily:"monospace", fontSize:13}}>Score: {score}/{Object.keys(feedback).length}</span>
          </div>

          <div style={{height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, marginBottom:28, overflow:"hidden"}}>
            <div style={{height:"100%", background:"linear-gradient(90deg,#6366f1,#8b5cf6)", width:`${((current+1)/questions.length)*100}%`, transition:"width 0.4s"}}/>
          </div>

          <div style={S.card}>
            <div style={{fontSize:11, fontFamily:"monospace", color:"#6366f1", marginBottom:12}}>QUESTION {current+1}</div>
            <div style={{fontSize:20, fontWeight:700, lineHeight:1.4, color:"#f0f0fa", marginBottom:20}}>{q.question}</div>
            <span style={{display:"inline-block", padding:"3px 10px", borderRadius:6, fontSize:10, fontFamily:"monospace", marginBottom:20, background:q.type==="multiple_choice"?"rgba(99,102,241,0.15)":q.type==="true_false"?"rgba(250,204,21,0.1)":"rgba(139,92,246,0.15)", color:q.type==="multiple_choice"?"#a5b4fc":q.type==="true_false"?"#fde047":"#c4b5fd"}}>
              {q.type==="multiple_choice"?"MULTIPLE CHOICE":q.type==="true_false"?"TRUE / FALSE":"OPEN ENDED"}
            </span>

            {q.type !== "open_ended" ? (
              <div>{q.options.map((opt,i) => {
                const letter = ["A","B","C","D","True","False"][i];
                const fb = feedback[current];
                const isCorrect = opt.trim().startsWith(q.answer.trim()) || opt.trim()===q.answer.trim();
                const sel = answers[current]===opt;
                const cls = fb?(isCorrect?"correct":sel&&!fb.correct?"incorrect":""):sel?"selected":"";
                return (
                  <button key={i} style={S.optBtn(cls)} disabled={!!fb} onClick={()=>!fb&&submitAnswer(current,opt)}>
                    <span style={{width:28, height:28, borderRadius:8, background:"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace", fontSize:12, flexShrink:0}}>{letter}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}</div>
            ) : (
              <div>
                <textarea value={answers[current]||""} onChange={e=>setAnswers(a=>({...a,[current]:e.target.value}))} disabled={!!feedback[current]}
                  placeholder="Type your answer here…"
                  style={{width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:16, color:"#e8e8f0", fontFamily:"monospace", fontSize:14, resize:"vertical", minHeight:120, outline:"none"}}/>
                {!feedback[current] && <button style={{...S.primaryBtn, marginTop:12}} onClick={()=>answers[current]?.trim()&&submitAnswer(current,answers[current])}>Submit Answer</button>}
              </div>
            )}

            {feedback[current] && (
              <div style={{marginTop:16, padding:16, borderRadius:12, fontSize:14, lineHeight:1.6, background:feedback[current].correct===true?"rgba(74,222,128,0.07)":feedback[current].correct===false?"rgba(248,113,113,0.07)":"rgba(99,102,241,0.07)", border:`1px solid ${feedback[current].correct===true?"rgba(74,222,128,0.2)":feedback[current].correct===false?"rgba(248,113,113,0.2)":"rgba(99,102,241,0.2)"}`, color:feedback[current].correct===true?"#86efac":feedback[current].correct===false?"#fca5a5":"#a5b4fc"}}>
                {feedback[current].text}
              </div>
            )}
          </div>

          {feedback[current] && (
            <div style={{display:"flex", justifyContent:"flex-end"}}>
              <button style={S.primaryBtn} onClick={next}>{current<questions.length-1?"Next Question →":"See Results →"}</button>
            </div>
          )}
        </>}

        {/* RESULTS */}
        {phase === "results" && <div style={{...S.card, textAlign:"center", padding:"60px 32px"}}>
          <div style={S.scoreCircle}>
            <div style={{fontSize:36, fontWeight:800, color:"#a5b4fc", lineHeight:1}}>{score}</div>
            <div style={{fontSize:14, color:"#6b7280", fontFamily:"monospace"}}>of {questions.length}</div>
          </div>
          <div style={{fontSize:28, fontWeight:800, marginBottom:8}}>
            {score===questions.length?"🎉 Perfect Score!":score>=questions.length*0.7?"💪 Great Job!":score>=questions.length*0.4?"📚 Keep Learning!":"🔁 Try Again!"}
          </div>
          <div style={{color:"#6b7280", fontSize:14, marginBottom:28}}>
            You answered {score} of {questions.length} correctly on <strong>{difficulty}</strong> difficulty
          </div>
          {skillsDetected.length > 0 && (
            <div style={{marginBottom:28}}>
              <div style={{fontSize:12, color:"#6b7280", fontFamily:"monospace", marginBottom:8}}>Skills covered in this quiz:</div>
              {skillsDetected.map(s => <span key={s} style={S.skillBadge}>{s}</span>)}
            </div>
          )}
          <div style={{display:"flex", gap:12, justifyContent:"center"}}>
            <button style={{padding:"14px 28px", borderRadius:12, border:"1px solid rgba(99,102,241,0.4)", background:"rgba(99,102,241,0.12)", color:"#a5b4fc", fontSize:15, fontWeight:700, cursor:"pointer"}} onClick={restart}>← New Files</button>
            <button style={{padding:"14px 28px", borderRadius:12, border:"1px solid rgba(99,102,241,0.4)", background:"rgba(99,102,241,0.12)", color:"#a5b4fc", fontSize:15, fontWeight:700, cursor:"pointer"}} onClick={generateQuiz}>Retry Quiz ↺</button>
          </div>
        </div>}

      </div>
    </div>
  );
}