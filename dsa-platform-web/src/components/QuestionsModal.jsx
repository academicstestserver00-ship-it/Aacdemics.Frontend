import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Code2, Clock, Award, Play } from 'lucide-react';
import api from '../services/api';

const FALLBACK_LANGUAGES = ['python', 'c', 'cpp', 'java'];

function getStarterCode(lang) {
  if (lang === 'python') {
    return 'def solve():\n    # write your logic here\n    pass\n\nif __name__ == "__main__":\n    solve()';
  }
  if (lang === 'cpp') {
    return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your logic here\n    return 0;\n}';
  }
  if (lang === 'java') {
    return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // write your logic here\n    }\n}';
  }
  return '#include <stdio.h>\n\nint main() {\n    // write your logic here\n    return 0;\n}';
}

function resolveLanguages(question) {
  const langs = Array.isArray(question?.allowed_languages) && question.allowed_languages.length > 0
    ? question.allowed_languages
    : FALLBACK_LANGUAGES;
  return langs;
}

function resolveDefaultLanguage(question) {
  const langs = resolveLanguages(question);
  if (langs.includes('python')) return 'python';
  if (langs.includes('cpp')) return 'cpp';
  if (langs.includes('java')) return 'java';
  if (langs.includes('c')) return 'c';
  return langs[0] || 'python';
}

function getDifficultyStyle(difficulty) {
  const styles = {
    EASY: { bg: '#E8F5E9', color: '#4CAF50' },
    MEDIUM: { bg: '#FFF3E0', color: '#FF9800' },
    HARD: { bg: '#FFEBEE', color: '#F44336' },
  };
  return styles[difficulty] || { bg: '#f5f5f5', color: '#666' };
}

function DryRunEditorModal({
  testTitle,
  question,
  language,
  onLanguageChange,
  code,
  onCodeChange,
  onRun,
  running,
  runResult,
  runError,
  onClose,
}) {
  if (!question) return null;

  const languages = resolveLanguages(question);
  const results = runResult?.results || [];
  const summary = runResult?.summary;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.62)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px',
        fontFamily: "'Segoe UI', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1280px',
          height: '90vh',
          background: '#fff',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 70px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            background: '#1e40af',
            color: '#fff',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.4px', textTransform: 'uppercase', opacity: 0.85 }}>Teacher Dry Run</div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>{question.title}</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>{testTitle} | Run only on self-hosted Judge0 | No submission</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', minHeight: 0 }}>
          <div style={{ padding: '14px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={language}
                  onChange={(e) => onLanguageChange(e.target.value)}
                  style={{ border: '1px solid #334155', borderRadius: '4px', padding: '7px 9px', fontSize: '12px', background: '#fff' }}
                >
                  {languages.map((lang) => (
                    <option key={lang} value={lang}>{lang === 'cpp' ? 'C++' : lang.toUpperCase()}</option>
                  ))}
                </select>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Time limit: {question.time_limit_ms || 2000} ms</span>
              </div>
              <button
                onClick={onRun}
                disabled={running}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running ? 0.7 : 1,
                }}
              >
                <Play size={13} />
                {running ? 'Running...' : 'Run Code'}
              </button>
            </div>

            <textarea
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                minHeight: '260px',
                width: '100%',
                resize: 'none',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '12px',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '13px',
                lineHeight: 1.55,
                background: '#f8fafc',
                color: '#1e293b',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ padding: '14px', overflowY: 'auto' }}>
            <div style={{ marginBottom: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '9px 10px', fontSize: '12px', color: '#1e3a8a', fontWeight: 600 }}>
              Dry Run Only. Nothing is submitted or stored in student submissions.
            </div>

            {runError && (
              <div style={{ marginBottom: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '9px 10px', color: '#b91c1c', fontSize: '12px' }}>
                {runError}
              </div>
            )}

            {summary && (
              <div style={{ marginBottom: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: '#334155' }}>Passed {summary.passed} / {summary.total}</span>
                  <span style={{ color: '#334155', fontWeight: 700 }}>Score: {summary.score}%</span>
                </div>
                <div>
                  {results.map((r, idx) => (
                    <div key={`${r.id}-${idx}`} style={{ padding: '8px 10px', borderBottom: idx === results.length - 1 ? 'none' : '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Test Case {idx + 1}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: r.passed ? '#166534' : '#b91c1c', background: r.passed ? '#dcfce7' : '#fee2e2' }}>{r.verdict}</span>
                      </div>
                      {!r.passed && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          <div>Expected: <span style={{ fontFamily: 'monospace' }}>{r.expected_output || '(empty)'}</span></div>
                          <div>Actual: <span style={{ fontFamily: 'monospace' }}>{r.actual_output || '(empty)'}</span></div>
                          {r.error && <div style={{ color: '#b91c1c' }}>Error: {r.error}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '8px 10px', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                Test Cases ({(question.test_cases || []).length})
              </div>
              <div>
                {(question.test_cases || []).map((tc, idx) => (
                  <div key={tc.id || idx} style={{ padding: '8px 10px', borderBottom: idx === (question.test_cases || []).length - 1 ? 'none' : '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#334155', fontWeight: 700, marginBottom: '4px' }}>Case {idx + 1}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>Input</div>
                    <pre style={{ margin: 0, marginBottom: '6px', fontSize: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px', whiteSpace: 'pre-wrap', color: '#334155', fontFamily: 'monospace' }}>{tc.input || '(empty)'}</pre>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>Expected</div>
                    <pre style={{ margin: 0, fontSize: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px', whiteSpace: 'pre-wrap', color: '#334155', fontFamily: 'monospace' }}>{tc.expected_output || '(empty)'}</pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuestionsModal({ testId, testTitle, isOpen, onClose }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);

  const [codeByQuestion, setCodeByQuestion] = useState({});
  const [languageByQuestion, setLanguageByQuestion] = useState({});
  const [runningByQuestion, setRunningByQuestion] = useState({});
  const [runResultByQuestion, setRunResultByQuestion] = useState({});
  const [runErrorByQuestion, setRunErrorByQuestion] = useState({});

  useEffect(() => {
    if (isOpen && testId) {
      fetchQuestions();
    }
  }, [isOpen, testId]);

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getTestQuestions(testId);
      setQuestions(response);
      setCurrentIndex(0);
      setIsDryRunOpen(false);
      setRunResultByQuestion({});
      setRunErrorByQuestion({});
    } catch (err) {
      setError(err.message || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (!isOpen) return null;

  const currentQuestion = questions[currentIndex];
  const currentQuestionId = currentQuestion?.id;
  const isMcq = String(currentQuestion?.question_type || 'coding').toLowerCase() === 'mcq';

  const getLanguage = (question) => {
    if (!question?.id) return 'python';
    return languageByQuestion[question.id] || resolveDefaultLanguage(question);
  };

  const getCode = (question) => {
    if (!question?.id) return '';
    const existing = codeByQuestion[question.id];
    if (existing !== undefined) return existing;
    return getStarterCode(getLanguage(question));
  };

  const setCode = (question, code) => {
    if (!question?.id) return;
    setCodeByQuestion((prev) => ({ ...prev, [question.id]: code }));
  };

  const setLanguage = (question, language) => {
    if (!question?.id) return;
    setLanguageByQuestion((prev) => ({ ...prev, [question.id]: language }));
    setCodeByQuestion((prev) => {
      if (prev[question.id] !== undefined) return prev;
      return { ...prev, [question.id]: getStarterCode(language) };
    });
  };

  const openDryRun = () => {
    if (!currentQuestion?.id) return;
    const lang = getLanguage(currentQuestion);
    setLanguageByQuestion((prev) => ({ ...prev, [currentQuestion.id]: prev[currentQuestion.id] || lang }));
    setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: prev[currentQuestion.id] ?? getStarterCode(lang) }));
    setIsDryRunOpen(true);
  };

  const handleRunCode = async () => {
    if (!currentQuestionId) return;

    const code = getCode(currentQuestion);
    const language = getLanguage(currentQuestion);
    const testCases = (currentQuestion.test_cases || []).map((tc) => ({
      id: tc.id,
      input: tc.input || '',
      expected_output: tc.expected_output || '',
      is_hidden: Boolean(tc.is_hidden),
      points: Number(tc.points || 1),
    }));

    if (!code.trim()) {
      setRunErrorByQuestion((prev) => ({ ...prev, [currentQuestionId]: 'Please enter code before running.' }));
      setRunResultByQuestion((prev) => ({ ...prev, [currentQuestionId]: null }));
      return;
    }

    if (testCases.length === 0) {
      setRunErrorByQuestion((prev) => ({ ...prev, [currentQuestionId]: 'No test cases found for this question.' }));
      setRunResultByQuestion((prev) => ({ ...prev, [currentQuestionId]: null }));
      return;
    }

    try {
      setRunningByQuestion((prev) => ({ ...prev, [currentQuestionId]: true }));
      setRunErrorByQuestion((prev) => ({ ...prev, [currentQuestionId]: null }));

      const response = await api.executeCode(
        code,
        language,
        testCases,
        currentQuestionId,
        Math.max(1, Number(currentQuestion.time_limit_ms || 2000) / 1000),
      );

      setRunResultByQuestion((prev) => ({ ...prev, [currentQuestionId]: response }));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d) => d?.msg).join(', ')
        : (detail || err.message || 'Run failed');

      setRunErrorByQuestion((prev) => ({ ...prev, [currentQuestionId]: message }));
      setRunResultByQuestion((prev) => ({ ...prev, [currentQuestionId]: null }));
    } finally {
      setRunningByQuestion((prev) => ({ ...prev, [currentQuestionId]: false }));
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
          fontFamily: "'Segoe UI', sans-serif",
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: '#2196F3',
              color: '#fff',
              padding: '24px',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '600', margin: '0 0 4px' }}>{testTitle}</h2>
              <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>
                {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '4px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={24} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {loading && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #e0e0e0',
                    borderTopColor: '#2196F3',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    margin: '0 auto 16px',
                  }}
                />
                <p style={{ color: '#666', fontSize: '14px' }}>Loading questions...</p>
                <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
              </div>
            )}

            {error && (
              <div
                style={{
                  background: '#FFEBEE',
                  border: '1px solid #FFCDD2',
                  borderRadius: '4px',
                  padding: '16px',
                  color: '#F44336',
                }}
              >
                {error}
              </div>
            )}

            {!loading && !error && questions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Code2 size={64} color="#ccc" style={{ margin: '0 auto 16px', display: 'block' }} />
                <p style={{ color: '#666', fontSize: '16px', marginBottom: '8px' }}>No questions in this test yet.</p>
                <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>Click "Add Question" to create one.</p>
              </div>
            )}

            {!loading && !error && currentQuestion && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#2196F3',
                      background: '#E3F2FD',
                      padding: '6px 12px',
                      borderRadius: '20px',
                    }}
                  >
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(() => {
                      const diffStyle = getDifficultyStyle(currentQuestion.difficulty);
                      return (
                        <span
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: diffStyle.bg,
                            color: diffStyle.color,
                          }}
                        >
                          {currentQuestion.difficulty}
                        </span>
                      );
                    })()}
                    <span
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: '#E3F2FD',
                        color: '#2196F3',
                      }}
                    >
                      {currentQuestion.topic.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#333', margin: '0 0 16px' }}>
                  {currentQuestion.title}
                </h3>

                <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Award size={16} color="#FF9800" />
                    <span style={{ fontWeight: '500' }}>{currentQuestion.points} points</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} color="#2196F3" />
                    <span style={{ fontWeight: '500' }}>{currentQuestion.time_limit_ms}ms time limit</span>
                  </div>
                </div>

                <div
                  style={{
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    padding: '16px',
                    border: '1px solid #e0e0e0',
                    marginBottom: '20px',
                  }}
                >
                  <h4 style={{ fontWeight: '600', color: '#333', margin: '0 0 8px', fontSize: '14px' }}>Description:</h4>
                  <p style={{ color: '#666', whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0, fontSize: '14px' }}>
                    {currentQuestion.description}
                  </p>
                </div>
                {currentQuestion.image_url && (
                  <div style={{ marginBottom: '20px' }}>
                    <img
                      src={currentQuestion.image_url}
                      alt="Question visual"
                      style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #dbe3ef' }}
                    />
                  </div>
                )}

                {!isMcq && (
                  <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      onClick={openDryRun}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '9px 14px',
                        border: '1px solid #93c5fd',
                        borderRadius: '6px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Play size={14} />
                      Teacher Dry Run
                    </button>
                  </div>
                )}

                {isMcq && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontWeight: '600', color: '#333', marginBottom: '12px', fontSize: '16px' }}>
                      MCQ Options
                    </h4>
                    <div style={{ fontSize: '12px', color: '#9a3412', marginBottom: '10px' }}>
                      {currentQuestion.mcq_negative_enabled
                        ? `Negative marking: -${currentQuestion.mcq_negative_marks || 0} point(s)`
                        : 'No negative marking'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(currentQuestion.mcq_options || []).map((opt, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px',
                            padding: '10px 12px',
                            background: idx === currentQuestion.mcq_correct_option ? '#E8F5E9' : '#fff',
                            color: idx === currentQuestion.mcq_correct_option ? '#2E7D32' : '#333',
                            fontWeight: idx === currentQuestion.mcq_correct_option ? 600 : 500,
                          }}
                        >
                          {String.fromCharCode(65 + idx)}. {opt}
                          {idx === currentQuestion.mcq_correct_option && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: '#2E7D32' }}>(Correct)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isMcq && currentQuestion.test_cases && currentQuestion.test_cases.length > 0 && (
                  <div>
                    <h4 style={{ fontWeight: '600', color: '#333', marginBottom: '12px', fontSize: '16px' }}>
                      Test Cases ({currentQuestion.test_cases.length}):
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {currentQuestion.test_cases.map((tc, idx) => (
                        <div
                          key={tc.id}
                          style={{
                            background: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              background: '#f5f5f5',
                              padding: '10px 16px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderBottom: '1px solid #e0e0e0',
                            }}
                          >
                            <span style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>Test Case {idx + 1}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {tc.is_hidden && (
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    background: '#FFF3E0',
                                    color: '#FF9800',
                                  }}
                                >
                                  Hidden
                                </span>
                              )}
                              <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>{tc.points} pts</span>
                            </div>
                          </div>
                          <div style={{ padding: '16px' }}>
                            <div style={{ marginBottom: '12px' }}>
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#666',
                                  display: 'block',
                                  marginBottom: '6px',
                                }}
                              >
                                Input:
                              </span>
                              <pre
                                style={{
                                  background: '#f5f5f5',
                                  color: '#333',
                                  padding: '12px',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  fontFamily: 'monospace',
                                  margin: 0,
                                  whiteSpace: 'pre-wrap',
                                  border: '1px solid #e0e0e0',
                                }}
                              >
{tc.input || '(empty)'}
                              </pre>
                            </div>
                            <div>
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#666',
                                  display: 'block',
                                  marginBottom: '6px',
                                }}
                              >
                                Expected Output:
                              </span>
                              <pre
                                style={{
                                  background: '#f5f5f5',
                                  color: '#333',
                                  padding: '12px',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  fontFamily: 'monospace',
                                  margin: 0,
                                  whiteSpace: 'pre-wrap',
                                  border: '1px solid #e0e0e0',
                                }}
                              >
{tc.expected_output}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!loading && questions.length > 0 && (
            <div
              style={{
                borderTop: '1px solid #e0e0e0',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f5f5f5',
                borderRadius: '0 0 8px 8px',
              }}
            >
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontWeight: '500',
                  fontSize: '14px',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  background: '#fff',
                  border: '1px solid #e0e0e0',
                  color: '#666',
                  opacity: currentIndex === 0 ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>
                {currentIndex + 1} / {questions.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex === questions.length - 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontWeight: '500',
                  fontSize: '14px',
                  cursor: currentIndex === questions.length - 1 ? 'not-allowed' : 'pointer',
                  background: '#2196F3',
                  border: 'none',
                  color: '#fff',
                  opacity: currentIndex === questions.length - 1 ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {isDryRunOpen && currentQuestion && (
        <DryRunEditorModal
          testTitle={testTitle}
          question={currentQuestion}
          language={getLanguage(currentQuestion)}
          onLanguageChange={(lang) => setLanguage(currentQuestion, lang)}
          code={getCode(currentQuestion)}
          onCodeChange={(nextCode) => setCode(currentQuestion, nextCode)}
          onRun={handleRunCode}
          running={Boolean(runningByQuestion[currentQuestionId])}
          runResult={runResultByQuestion[currentQuestionId]}
          runError={runErrorByQuestion[currentQuestionId]}
          onClose={() => setIsDryRunOpen(false)}
        />
      )}
    </>
  );
}
