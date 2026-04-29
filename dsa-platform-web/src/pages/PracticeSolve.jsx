import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { API_BASE } from "../config";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

function getStarterTemplate(language) {
  switch (language) {
    case "python":
      return "# Write your Python solution here\n";
    case "java":
      return "public class Main {\n  public static void main(String[] args) {\n    // Write your Java solution here\n  }\n}\n";
    case "c":
      return "#include <stdio.h>\n\nint main() {\n  // Write your C solution here\n  return 0;\n}\n";
    case "cpp":
      return "#include <iostream>\nusing namespace std;\n\nint main() {\n  // Write your C++ solution here\n  return 0;\n}\n";
    default:
      return "";
  }
}

function Section({ title, children }) {
  return (
    <div className="ps-section">
      <div className="ps-section-title">{title}</div>
      <div className="ps-section-body">{children}</div>
    </div>
  );
}

function CodeBlock({ text }) {
  return <pre className="ps-code">{text || "-"}</pre>;
}

export default function PracticeSolve() {
  const { pid, language: urlLang } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeLanguage = (urlLang || "").toLowerCase();

  const [problem, setProblem] = useState(location.state || null);
  const [problemList, setProblemList] = useState([]);
  const [completedProblems, setCompletedProblems] = useState([]);

  const [language, setLanguage] = useState(routeLanguage || "python");
  const [code, setCode] = useState("");

  const [runOutput, setRunOutput] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [execTime, setExecTime] = useState(null);

  const [justSolved, setJustSolved] = useState(false);

  useEffect(() => {
    if (routeLanguage) setLanguage(routeLanguage);
  }, [routeLanguage]);

  useEffect(() => {
    setCode(getStarterTemplate(language));
  }, [language]);

  useEffect(() => {
    setRunOutput(null);
    setSubmitResult(null);
    setExecTime(null);
    setJustSolved(false);
    setCode(getStarterTemplate(language));
  }, [pid, language]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const ref = doc(db, "users", auth.currentUser.uid);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        setCompletedProblems(snap.data().practiceCompleted || []);
      }
    });
  }, []);

  const isCompleted = completedProblems.includes(pid) || justSolved;

  useEffect(() => {
    if (!pid) return;

    if (routeLanguage) {
      fetch(`${API_BASE}/api/practice/problems/${routeLanguage}`)
        .then((r) => r.json())
        .then((list) => {
          if (Array.isArray(list)) {
            setProblemList(list);
            const found = list.find((p) => p.id === pid);
            setProblem(found || null);
          }
        })
        .catch(() => setProblem(null));
      return;
    }

    // Fallback for routes that provide only pid (no language in URL)
    fetch(`${API_BASE}/api/practice/problem/${pid}`)
      .then((r) => r.json())
      .then((single) => {
        if (single && !single.error) {
          setProblem(single);
          if (single.language) setLanguage(String(single.language).toLowerCase());
          setProblemList((prev) => (Array.isArray(prev) && prev.length ? prev : [single]));
        } else {
          setProblem(null);
        }
      })
      .catch(() => setProblem(null));
  }, [pid, routeLanguage]);

  const currentIndex = problemList.findIndex((p) => p.id === pid);
  const previousProblem = problemList[currentIndex - 1];

  const handleRun = async () => {
    if (!problem) return;
    setRunning(true);
    setRunOutput(null);
    setExecTime(null);
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/api/practice/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin: problem.sample_input || "" }),
      });
      const data = await res.json();
      setExecTime(((performance.now() - start) / 1000).toFixed(3));
      setRunOutput(data.stdout || data.error || "No output");
    } catch {
      setRunOutput("Error running code.");
    }
    setRunning(false);
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return alert("Login required");
    if (isCompleted) return;
    setSubmitting(true);
    setSubmitResult(null);
    setExecTime(null);
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/api/practice/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: auth.currentUser.uid, pid, language, code }),
      });
      const data = await res.json();
      setExecTime(((performance.now() - start) / 1000).toFixed(3));
      setSubmitResult(data);
      if (data.completed && !data.already_solved) {
        setJustSolved(true);
        setCompletedProblems((prev) => [...prev, pid]);
      }
    } catch {
      alert("Submission failed.");
    }
    setSubmitting(false);
  };

  const goToNextQuestion = () => {
    const next = problemList[currentIndex + 1];
    const langForRoute = routeLanguage || language;
    if (next) navigate(`/practice/${langForRoute}/${next.id}`);
  };

  const goToPreviousQuestion = () => {
    const langForRoute = routeLanguage || language;
    if (previousProblem) navigate(`/practice/${langForRoute}/${previousProblem.id}`);
  };

  if (!problem) {
    return <div className="ps-loading">Loading problem...</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pid}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="ps-root"
      >
        <style>{`
          .ps-root { min-height: calc(100vh - 64px); padding: 16px; }
          .ps-layout { max-width: 1320px; margin: 0 auto; background: #fff; border: 1px solid var(--sc-border); border-radius: 16px; box-shadow: var(--sc-shadow); overflow: hidden; display: grid; grid-template-columns: 360px minmax(0, 1fr); }
          .ps-sidebar { background: #fff7f8; border-right: 1px solid #e5e7eb; padding: 16px; max-height: calc(100vh - 96px); overflow-y: auto; }
          .ps-main { display: flex; flex-direction: column; height: calc(100vh - 96px); min-height: 0; }
          .ps-editor-wrap { flex: 1; min-height: 260px; }
          .ps-toolbar { display: flex; gap: 8px; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb; background: #fff; }
          .ps-btn { border-radius: 10px; border: 1px solid #dbe3ef; background: #fff; color: var(--sc-text-strong); padding: 8px 12px; font-size: 12px; font-weight: 700; }
          .ps-btn.primary { border: none; color: #fff; background: linear-gradient(120deg, var(--sc-primary), var(--sc-primary-strong)); }
          .ps-section { margin-bottom: 14px; }
          .ps-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; margin-bottom: 5px; font-weight: 700; }
          .ps-section-body { font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-wrap; }
          .ps-code { background: #fff; border: 1px solid #dbe3ef; border-radius: 10px; padding: 10px; font-size: 12px; color: #1e293b; white-space: pre-wrap; }
          .ps-title { font-size: 20px; font-weight: 800; color: var(--sc-text-strong); margin-bottom: 4px; }
          .ps-meta { font-size: 12px; color: #64748b; margin-bottom: 8px; }
          .ps-badge { display: inline-block; border-radius: 999px; padding: 4px 10px; background: #dcfce7; border: 1px solid #86efac; color: #15803d; font-size: 11px; font-weight: 700; margin-bottom: 12px; }
          .ps-output { border-top: 1px solid #e5e7eb; background: #fff8fa; padding: 12px; max-height: 42vh; min-height: 160px; overflow-y: auto; }
          .ps-loading { min-height: calc(100vh - 64px); display: flex; align-items: center; justify-content: center; color: var(--sc-text-muted); }
          @media (max-width: 980px) {
            .ps-layout { grid-template-columns: 1fr; }
            .ps-sidebar { max-height: none; border-right: none; border-bottom: 1px solid #e5e7eb; }
            .ps-main { height: auto; min-height: 62vh; }
            .ps-editor-wrap { min-height: 320px; }
          }
        `}</style>

        <div className="ps-layout">
          <div className="ps-sidebar">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <button className="ps-btn" onClick={goToPreviousQuestion} disabled={!previousProblem}>Prev</button>
              <button className="ps-btn" onClick={goToNextQuestion} disabled={!problemList[currentIndex + 1]}>Next</button>
            </div>

            <button className="ps-btn" onClick={() => navigate(`/practice/${routeLanguage || language}`)} style={{ marginBottom: 10 }}>
              Back to Problems
            </button>

            <div className="ps-title">{problem.title}</div>
            <div className="ps-meta">{problem.difficulty}</div>
            {isCompleted && <div className="ps-badge">Solved</div>}

            <Section title="Task">{problem.task}</Section>
            <Section title="Input Format">{problem.input_format}</Section>
            <Section title="Output Format">{problem.output_format}</Section>
            <Section title="Sample Input"><CodeBlock text={problem.sample_input} /></Section>
            <Section title="Sample Output"><CodeBlock text={problem.sample_output} /></Section>
          </div>

          <div className="ps-main">
            <div className="ps-toolbar">
              <button className="ps-btn primary" onClick={handleRun} disabled={running}>{running ? "Running..." : "Run"}</button>
              <button className="ps-btn" onClick={handleSubmit} disabled={submitting || isCompleted}>{isCompleted ? "Already Solved" : submitting ? "Submitting..." : "Submit"}</button>
            </div>

            <div className="ps-editor-wrap">
              <Editor
                height="100%"
                language={language === "cpp" ? "cpp" : language}
                value={code}
                onChange={(v) => setCode(v || "")}
                theme="vs-light"
                options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }}
              />
            </div>

            {(runOutput || submitResult) && (
              <div className="ps-output">
                {execTime && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Execution Time: {execTime}s</div>}

                {runOutput && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Run Output</div>
                    <pre className="ps-code">{runOutput}</pre>
                  </div>
                )}

                {submitResult && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                      Passed {submitResult.passed} / {submitResult.total}
                    </div>

                    {submitResult.completed && !submitResult.already_solved && (
                      <div style={{ color: "#15803d", fontWeight: 700, marginBottom: 10 }}>XP Awarded: {submitResult.xp_gain}</div>
                    )}
                    {submitResult.completed && submitResult.already_solved && (
                      <div style={{ color: "#92400e", fontWeight: 700, marginBottom: 10 }}>Already Solved - No XP</div>
                    )}

                    {submitResult.results?.map((t, i) => (
                      <div key={i} style={{ padding: 10, borderRadius: 10, border: `1px solid ${t.passed ? "#86efac" : "#fca5a5"}`, background: t.passed ? "#f0fdf4" : "#fff1f2", marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Test Case {t.index} - {t.passed ? "PASSED" : "FAILED"}</div>
                        {!t.passed && (
                          <div style={{ fontSize: 12, color: "#334155" }}>
                            <div>Expected: {t.expected}</div>
                            <div>Got: {t.got}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
