import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, getStudentTestHistory } from "../services/api";

const LANGUAGES = [
  {
    id: "java",
    label: "Java",
    desc: "Object-oriented patterns and interview-ready practice.",
    color: "#ea580c",
    defaultImage: "/languages/java.png",
    cardTone: "sd-card-java",
  },
  {
    id: "python",
    label: "Python",
    desc: "Fast problem solving with clean expressive syntax.",
    color: "#1d4ed8",
    defaultImage: "/languages/python.png",
    cardTone: "sd-card-python",
  },
  {
    id: "c",
    label: "C",
    desc: "Build strong foundations in memory and core logic.",
    color: "#0f766e",
    defaultImage: "/languages/c.png",
    cardTone: "sd-card-c",
  },
  {
    id: "cpp",
    label: "C++",
    desc: "STL-backed competitive programming workflows.",
    color: "#6d28d9",
    defaultImage: "/languages/cpp.png",
    cardTone: "sd-card-cpp",
  },
];

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [testCode, setTestCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testPreview, setTestPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const data = await getStudentTestHistory();
        if (mounted) setHistory(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) setHistoryError("Could not load test history.");
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleFindTest = async () => {
    const code = testCode.trim();
    if (!code) return;
    setLoading(true);
    setError("");
    setTestPreview(null);
    try {
      const res = await apiClient.get(`/api/teacher/student/test/lookup/${encodeURIComponent(code)}`);
      setTestPreview(res.data);
    } catch (e) {
      if (e?.response?.status === 403) {
        setError("You do not have permission to attempt tests with this account.");
      } else if (e?.response?.status === 404) {
        setError("No test found with that code. Please check and try again.");
      } else if (e?.response?.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError("Could not connect to server. Please try again.");
      }
    }
    setLoading(false);
  };

  const handleBeginTest = () => {
    if (!testPreview) return;
    const code = testPreview.assessment_id || testPreview.id;
    navigate(`/match?code=${encodeURIComponent(code)}`, { state: { test: testPreview } });
  };

  return (
    <div className="sd-root">
      <style>{`
        .sd-root {
          min-height: calc(100vh - 64px);
          padding: 28px 22px 36px;
          background:
            radial-gradient(1200px 520px at 10% 0%, rgba(206, 225, 255, 0.50), transparent 65%),
            radial-gradient(1000px 520px at 90% 0%, rgba(255, 214, 223, 0.45), transparent 60%),
            linear-gradient(180deg, #f5f7fb 0%, #f3f5fa 45%, #f2f4f8 100%);
        }
        .sd-wrap {
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          gap: 26px;
          grid-template-columns: minmax(0, 1.6fr) minmax(360px, 0.95fr);
          align-items: stretch;
        }
        .sd-left { padding: 6px 2px; }
        .sd-head {
          margin: 0;
          font-size: clamp(2rem, 3vw, 3rem);
          line-height: 1.06;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #33446b;
        }
        .sd-sub {
          margin-top: 10px;
          margin-bottom: 20px;
          color: #647296;
          font-size: clamp(1rem, 1.65vw, 1.8rem);
          line-height: 1.25;
          max-width: 760px;
        }
        .sd-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .sd-lang {
          border-radius: 18px;
          border: 1px solid #dfe5f2;
          background: #fff;
          min-height: 190px;
          padding: 18px 18px 16px;
          text-align: left;
          box-shadow: 0 8px 24px rgba(30, 41, 59, 0.06);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
          cursor: pointer;
        }
        .sd-lang:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px rgba(30, 41, 59, 0.11);
        }
        .sd-card-java { background: linear-gradient(150deg, #fff6ee 0%, #ffffff 88%); }
        .sd-card-python { background: linear-gradient(150deg, #eef4ff 0%, #ffffff 88%); }
        .sd-card-c { background: linear-gradient(150deg, #ecfbf8 0%, #ffffff 88%); }
        .sd-card-cpp { background: linear-gradient(150deg, #f2efff 0%, #ffffff 88%); }
        .sd-lang-top {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .sd-logo-wrap {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.82);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.95);
          overflow: hidden;
          flex-shrink: 0;
        }
        .sd-logo {
          width: 38px;
          height: 38px;
          object-fit: contain;
          object-position: center;
          display: block;
        }
        .sd-title {
          font-size: 1.9rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #33446b;
          line-height: 1.05;
        }
        .sd-desc {
          color: #677498;
          font-size: 1.05rem;
          line-height: 1.36;
          min-height: 58px;
        }
        .sd-start {
          margin-top: 12px;
          font-size: 1.1rem;
          font-weight: 800;
        }
        .sd-right {
          border-radius: 22px;
          border: 1px solid #dbe2ef;
          background: rgba(255,255,255,0.78);
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.09);
          padding: 24px 22px;
          backdrop-filter: blur(2px);
        }
        .sd-right h2 {
          margin: 0 0 7px;
          color: #33446b;
          font-size: clamp(1.6rem, 2.4vw, 2.25rem);
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .sd-right p {
          margin: 0 0 14px;
          color: #6b7898;
          font-size: 1rem;
          line-height: 1.45;
        }
        .sd-find {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }
        .sd-input {
          min-width: 0;
          border: 1px solid #dbe3ef;
          background: #fff;
          border-radius: 12px;
          padding: 12px 13px;
          color: #33446b;
          font-size: 0.98rem;
          outline: none;
        }
        .sd-input::placeholder { color: #a8b4cf; }
        .sd-input:focus {
          border-color: #f59eae;
          box-shadow: 0 0 0 4px rgba(244,114,127,0.17);
        }
        .sd-btn {
          border: none;
          border-radius: 12px;
          padding: 12px 17px;
          min-width: 84px;
          font-size: 0.96rem;
          font-weight: 800;
          cursor: pointer;
          color: #fff;
          background: linear-gradient(120deg, #f59ba2, #ef818c);
        }
        .sd-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .sd-alert, .sd-preview, .sd-empty {
          margin-top: 12px;
          border-radius: 14px;
          padding: 12px;
          font-size: 0.92rem;
          border: 1px solid #e5e7eb;
          background: #fff;
        }
        .sd-alert { border-color: #fecaca; background: #fff1f2; color: #be123c; }
        .sd-empty { color: #7180a2; background: rgba(248,250,255,0.85); text-align: center; }
        .sd-preview-title {
          font-size: 1.08rem;
          font-weight: 800;
          color: #33446b;
          margin-bottom: 3px;
        }
        .sd-preview-desc {
          color: #6b7898;
          font-size: 0.9rem;
          margin-bottom: 10px;
          line-height: 1.4;
        }
        .sd-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .sd-meta-box {
          border-radius: 11px;
          border: 1px solid #e1e8f3;
          background: #f7f9ff;
          text-align: center;
          padding: 10px 7px;
        }
        .sd-meta-val {
          color: #33446b;
          font-weight: 800;
          font-size: 0.95rem;
          margin-bottom: 2px;
        }
        .sd-meta-label { color: #8290af; font-size: 0.76rem; }
        .sd-full { width: 100%; }
        .sd-history {
          margin-top: 16px;
          border-top: 1px solid #e4e9f3;
          padding-top: 16px;
        }
        .sd-history-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .sd-history-title {
          color: #33446b;
          font-size: 1rem;
          font-weight: 800;
        }
        .sd-history-count {
          color: #8290af;
          font-size: 0.78rem;
          font-weight: 700;
        }
        .sd-history-list {
          display: grid;
          gap: 9px;
          max-height: 330px;
          overflow-y: auto;
          padding-right: 2px;
        }
        .sd-history-row {
          border: 1px solid #e1e8f3;
          border-radius: 12px;
          background: #fff;
          padding: 10px 11px;
        }
        .sd-history-main {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        .sd-history-name {
          min-width: 0;
          color: #33446b;
          font-size: 0.93rem;
          font-weight: 800;
          line-height: 1.25;
        }
        .sd-history-marks {
          color: #0f766e;
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 0.78rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .sd-history-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          color: #6b7898;
          font-size: 0.78rem;
          font-weight: 700;
        }
        .sd-lang-badge {
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          padding: 2px 8px;
        }
        @media (max-width: 1060px) {
          .sd-wrap { grid-template-columns: 1fr; max-width: 920px; }
          .sd-right { max-width: 620px; }
        }
        @media (max-width: 760px) {
          .sd-root { padding: 14px; }
          .sd-grid { grid-template-columns: 1fr; }
          .sd-find { grid-template-columns: 1fr; }
          .sd-btn { width: 100%; }
          .sd-meta { grid-template-columns: 1fr; }
          .sd-title { font-size: 1.55rem; }
          .sd-desc { font-size: 0.95rem; min-height: 0; }
        }
      `}</style>

      <div className="sd-wrap">
        <section className="sd-left">
          <h1 className="sd-head">Practice Programming</h1>
          <div className="sd-sub">Choose your language and start solving curated DSA tracks.</div>

          <div className="sd-grid">
            {LANGUAGES.map((lang) => {
              return (
                <button
                  key={lang.id}
                  className={`sd-lang ${lang.cardTone}`}
                  onClick={() => navigate(`/practice/${lang.id}`)}
                  style={{ borderColor: `${lang.color}2f` }}
                >
                  <div className="sd-lang-top">
                    <div className="sd-logo-wrap">
                      <img
                        src={lang.defaultImage}
                        alt={`${lang.label} logo`}
                        className="sd-logo"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="sd-title">{lang.label}</div>
                  </div>
                  <div className="sd-desc">{lang.desc}</div>
                  <div className="sd-start" style={{ color: lang.color }}>Start →</div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="sd-right">
          <h2>Attempt a Test</h2>
          <p>Enter the test code shared by your teacher.</p>

          <div className="sd-find">
            <input
              className="sd-input"
              type="text"
              value={testCode}
              onChange={(e) => {
                setTestCode(e.target.value);
                setError("");
                setTestPreview(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleFindTest()}
              placeholder="Enter test code"
            />
            <button className="sd-btn" onClick={handleFindTest} disabled={loading || !testCode.trim()}>
              {loading ? "..." : "Find"}
            </button>
          </div>

          {error && <div className="sd-alert">{error}</div>}

          {testPreview && (
            <div className="sd-preview">
              <div className="sd-preview-title">{testPreview.title}</div>
              {testPreview.description && <div className="sd-preview-desc">{testPreview.description}</div>}

              <div className="sd-meta">
                {testPreview.duration_minutes && (
                  <div className="sd-meta-box">
                    <div className="sd-meta-val">{testPreview.duration_minutes}</div>
                    <div className="sd-meta-label">Minutes</div>
                  </div>
                )}
                {testPreview.question_count && (
                  <div className="sd-meta-box">
                    <div className="sd-meta-val">{testPreview.question_count}</div>
                    <div className="sd-meta-label">Questions</div>
                  </div>
                )}
                {testPreview.allowed_languages && (
                  <div className="sd-meta-box">
                    <div className="sd-meta-val" style={{ textTransform: "capitalize" }}>{testPreview.allowed_languages[0]}</div>
                    <div className="sd-meta-label">Language</div>
                  </div>
                )}
              </div>

              <button className="sd-btn sd-full" onClick={handleBeginTest}>Begin Test</button>
            </div>
          )}

          {!testPreview && !error && <div className="sd-empty">Enter a test code above to get started.</div>}

          <div className="sd-history">
            <div className="sd-history-head">
              <div className="sd-history-title">Test History</div>
              <div className="sd-history-count">{history.length} attempted</div>
            </div>

            {historyLoading && <div className="sd-empty">Loading test history...</div>}
            {!historyLoading && historyError && <div className="sd-alert">{historyError}</div>}
            {!historyLoading && !historyError && history.length === 0 && (
              <div className="sd-empty">No tests attempted yet</div>
            )}
            {!historyLoading && !historyError && history.length > 0 && (
              <div className="sd-history-list">
                {history.map((item) => (
                  <div key={`${item.test_id}-${item.session_id}`} className="sd-history-row">
                    <div className="sd-history-main">
                      <div className="sd-history-name">{item.test_name || "Unknown Test"}</div>
                      <div className="sd-history-marks">
                        {item.marks ?? 0}/{item.total_marks ?? 0}
                      </div>
                    </div>
                    <div className="sd-history-meta">
                      <span className="sd-lang-badge">{item.language || "N/A"}</span>
                      <span>{item.date || "N/A"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
