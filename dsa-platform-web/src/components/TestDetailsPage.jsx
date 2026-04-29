



import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Eye, Edit2, Trash2, Users, Clock, CheckCircle, XCircle, X, Download } from 'lucide-react';
import { apiClient } from '../services/api';

const API_URL = '/api/teacher';

function TestDetailsPage({ test, onBack, onAddQuestion, canEdit = true }) {
  const [questions, setQuestions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [detailedAnalytics, setDetailedAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('questions');
  const [loading, setLoading] = useState(true);
  const [linkStatus, setLinkStatus] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [hoveredLeaderboardId, setHoveredLeaderboardId] = useState(null);
  const [detailedReportDownloading, setDetailedReportDownloading] = useState(false);

  // Edit modal state
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Delete confirm state
  const [deletingQuestion, setDeletingQuestion] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'analytics' || activeTab === 'submissions' || activeTab === 'leaderboard') {
      fetchTestData({ silent: true });
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTestData();
    const id = setInterval(() => fetchTestData({ silent: true }), 5000);
    const handleFocus = () => fetchTestData({ silent: true });
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', handleFocus);
    };
  }, [test.id]);

  const fetchTestData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const questionsRes = await apiClient.get(`${API_URL}/test/${test.id}/questions`);
      setQuestions(questionsRes.data);
      
      const submissionsRes = await apiClient.get(`${API_URL}/submissions`);
      const testSubmissions = submissionsRes.data.filter(sub => 
        questionsRes.data.some(q => q.id === sub.question_id)
      );
      setSubmissions(testSubmissions);
      
      try {
        const analyticsRes = await apiClient.get(`${API_URL}/analytics/test/${test.id}`);
        setAnalytics(analyticsRes.data);
      } catch {
        console.log('Analytics not available');
      }

      try {
        const detailedRes = await apiClient.get(`${API_URL}/analytics/test/${test.id}/detailed`);
        setDetailedAnalytics(detailedRes.data);
      } catch {
        console.log('Detailed analytics not available');
      }
    } catch (error) {
      console.error('Error fetching test data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingQuestion) return;
    setDeleteLoading(true);
    try {
      await apiClient.delete(`${API_URL}/questions/${deletingQuestion.id}`);
      setQuestions(prev => prev.filter(q => q.id !== deletingQuestion.id));
      setDeletingQuestion(null);
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    const colors = { EASY: '#4caf50', MEDIUM: '#ff9800', HARD: '#f44336' };
    return colors[difficulty] || '#999';
  };

  const formatDateTime = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return `${d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })} IST`;
  };

  const formatLanguage = (value) => {
    const labels = { python: 'Python', py: 'Python', c: 'C', cpp: 'C++', 'c++': 'C++', java: 'Java', mcq: 'MCQ' };
    const key = String(value || '').trim().toLowerCase();
    return labels[key] || value || 'N/A';
  };

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return '-';
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}m ${s}s`;
  };

  const formatDurationMs = (ms) => {
    if (ms === null || ms === undefined) return '-';
    const total = Math.max(0, Math.floor(ms));
    if (total < 1000) return `${total}ms`;
    const s = Math.floor(total / 1000);
    const rem = total % 1000;
    return `${s}.${String(rem).padStart(3, '0')}s`;
  };

  const formatCompletionWithExec = (baseSeconds, execMs, compMs) => {
    if (baseSeconds === null || baseSeconds === undefined) return '-';
    const execSec = execMs ? execMs / 1000 : 0;
    const compSec = compMs ? compMs / 1000 : 0;
    return formatDuration(baseSeconds + execSec + compSec);
  };

  const submissionTimeByStudent = (() => {
    const map = {};
    submissions.forEach((sub) => {
      const sid = sub?.student_id;
      const ts = sub?.submitted_at ? Date.parse(sub.submitted_at) : NaN;
      if (!sid || Number.isNaN(ts)) return;
      const entry = map[sid] || { min: ts, max: ts };
      entry.min = Math.min(entry.min, ts);
      entry.max = Math.max(entry.max, ts);
      map[sid] = entry;
    });
    return map;
  })();

  const getFallbackSubmissionSeconds = (studentId) => {
    if (!studentId) return null;
    const studentSubs = submissions.filter(s => s.student_id === studentId);
    if (!studentSubs.length) return null;

    const studentAnalytics = detailedAnalytics?.students?.find(s => s.student_id === studentId);
    const startedAt = studentAnalytics?.started_at;
    if (!startedAt) return null;

    const latestSub = studentSubs.reduce((latest, s) =>
      (s.submitted_at > (latest?.submitted_at || '')) ? s : latest, null
    );
    if (!latestSub?.submitted_at) return null;

    const start = Date.parse(startedAt);
    const end = Date.parse(latestSub.submitted_at);
    if (isNaN(start) || isNaN(end)) return null;

    return Math.max(0, Math.floor((end - start) / 1000));
  };

  const linkCode = test?.assessment_id || test?.id;
  const shareUrl = linkCode ? `${window.location.origin}/match/${linkCode}` : '';

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkStatus('Link copied');
      setTimeout(() => setLinkStatus(''), 1500);
    } catch {
      setLinkStatus('Copy failed');
      setTimeout(() => setLinkStatus(''), 1500);
    }
  };

  const openStudentDetails = (student) => {
    setSelectedStudent(student || null);
  };

  const closeStudentDetails = () => {
    setSelectedStudent(null);
  };

  const analyticsQuestions = Array.isArray(analytics?.questions) ? analytics.questions : [];
  const totalQuestions = analytics?.total_questions ?? questions.length;
  const totalSubmissions = analyticsQuestions.length
    ? analyticsQuestions.reduce((sum, q) => sum + (q.total_submissions || 0), 0)
    : submissions.length;
  const averageScore = analyticsQuestions.length
    ? (() => {
        const weighted = analyticsQuestions.reduce((sum, q) => sum + (q.average_score || 0) * (q.total_submissions || 0), 0);
        return totalSubmissions > 0 ? Math.round(weighted / totalSubmissions) : 0;
      })()
    : submissions.length > 0
      ? Math.round(submissions.reduce((s, x) => s + (x.score || 0), 0) / submissions.length)
      : 0;
  const passRate = analyticsQuestions.length
    ? (() => {
        const passed = analyticsQuestions.reduce((sum, q) => sum + (q.passed || 0), 0);
        return totalSubmissions > 0 ? Math.round((passed / totalSubmissions) * 100) : 0;
      })()
    : submissions.length > 0
      ? Math.round((submissions.filter(s => s.verdict === 'PASS').length / submissions.length) * 100)
      : 0;

  const leaderboardRows = (() => {
    const students = Array.isArray(detailedAnalytics?.students) ? detailedAnalytics.students : [];
    const totalQ = (detailedAnalytics?.questions || questions || []).length;
    const rows = students.map((s) => {
      const qEntries = Object.values(s.questions || {});
      const solved = qEntries.filter(q => Number(q?.score || 0) >= 100).length;
      const score = Number(s.overall_score || 0);
      const points = Number(s.overall_points || 0);
      const timeSeconds = s.overall_submission_time_seconds ?? null;
      return {
        student_id: s.student_id,
        name: s.student_name || 'Unknown',
        email: s.student_email || 'Unknown',
        roll_number: s.student_roll_number || '-',
        score,
        points,
        solved,
        totalQ,
        timeSeconds,
        submittedAt: s.overall_submitted_at || s.deadline_at || null,
      };
    });
    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = a.timeSeconds ?? Number.POSITIVE_INFINITY;
      const tb = b.timeSeconds ?? Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  })();

  const escapeCsv = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const downloadCsv = (filename, headers, rows) => {
    const content = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(',')),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportQuestionsCsv = () => {
    const rows = [];
    questions.forEach((q) => {
      const qType = String(q.question_type || 'coding').toLowerCase();
      const testCases = Array.isArray(q.test_cases) ? q.test_cases : [];
      if (qType === 'coding' && testCases.length > 0) {
        testCases.forEach((tc, idx) => {
          rows.push({
            test_title: test.title,
            question_id: q.id,
            question_title: q.title,
            question_type: q.question_type || 'coding',
            description: q.description || '',
            image_url: q.image_url || '',
            difficulty: q.difficulty || '',
            topic: q.topic || '',
            question_marks: q.points ?? 0,
            time_limit_ms: q.time_limit_ms ?? 0,
            test_case_number: idx + 1,
            test_case_input: tc.input || '',
            test_case_expected_output: tc.expected_output || '',
            test_case_hidden: tc.is_hidden ? 'Yes' : 'No',
            test_case_marks: tc.points ?? 1,
            mcq_options: '',
            mcq_correct_option: '',
            mcq_negative_enabled: '',
            mcq_negative_marks: '',
          });
        });
      } else {
        rows.push({
          test_title: test.title,
          question_id: q.id,
          question_title: q.title,
          question_type: q.question_type || 'coding',
          description: q.description || '',
          image_url: q.image_url || '',
          difficulty: q.difficulty || '',
          topic: q.topic || '',
          question_marks: q.points ?? 0,
          time_limit_ms: q.time_limit_ms ?? 0,
          test_case_number: '',
          test_case_input: '',
          test_case_expected_output: '',
          test_case_hidden: '',
          test_case_marks: '',
          mcq_options: Array.isArray(q.mcq_options) ? q.mcq_options.join(' | ') : '',
          mcq_correct_option: q.mcq_correct_option ?? '',
          mcq_negative_enabled: q.mcq_negative_enabled ? 'Yes' : 'No',
          mcq_negative_marks: q.mcq_negative_marks ?? 0,
        });
      }
    });
    const headers = [
      'test_title', 'question_id', 'question_title', 'question_type', 'description', 'image_url',
      'difficulty', 'topic', 'question_marks', 'time_limit_ms', 'test_case_number', 'test_case_input',
      'test_case_expected_output', 'test_case_hidden', 'test_case_marks', 'mcq_options',
      'mcq_correct_option', 'mcq_negative_enabled', 'mcq_negative_marks',
    ];
    downloadCsv(`${(test.title || 'test').replace(/\s+/g, '_')}_questions.csv`, headers, rows);
  };

  const exportSubmissionsCsv = () => {
    const students = Array.isArray(detailedAnalytics?.students) ? detailedAnalytics.students : [];
    const rows = students.map((s) => ({
      student_name: s.student_name || '',
      student_email: s.student_email || '',
      student_roll_number: s.student_roll_number || '',
      test_start: s.started_at || '',
      test_end: s.overall_submitted_at || s.deadline_at || '',
      submission_time_seconds: s.overall_submission_time_seconds ?? '',
      language: s.primary_language || 'N/A',
      overall_marks_percent: s.overall_score ?? 0,
      overall_points: s.overall_points ?? 0,
      tab_switches: s.tab_switches ?? 0,
      paste_count: s.paste_count ?? 0,
    }));
    const headers = [
      'student_name', 'student_email', 'student_roll_number', 'test_start', 'test_end',
      'submission_time_seconds', 'language', 'overall_marks_percent', 'overall_points', 'tab_switches', 'paste_count',
    ];
    downloadCsv(`${(test.title || 'test').replace(/\s+/g, '_')}_submissions.csv`, headers, rows);
  };

  const exportAnalyticsCsv = () => {
    const rows = (detailedAnalytics?.questions || []).map((q) => ({
      question_id: q.id,
      question_title: q.title,
      question_points: q.points ?? 0,
      language: q.language || 'N/A',
      average_score_percent: q.average_score ?? 0,
      avg_execution_time_ms: q.avg_execution_time_ms ?? '',
      avg_compilation_time_ms: q.avg_compilation_time_ms ?? '',
    }));
    const headers = [
      'question_id', 'question_title', 'question_points',
      'language', 'average_score_percent', 'avg_execution_time_ms', 'avg_compilation_time_ms',
    ];
    downloadCsv(`${(test.title || 'test').replace(/\s+/g, '_')}_analytics.csv`, headers, rows);
  };

  const exportLeaderboardCsv = () => {
    const rows = leaderboardRows.map((r) => ({
      rank: r.rank,
      student_name: r.name,
      student_email: r.email,
      student_roll_number: r.roll_number || '',
      score_percent: r.score,
      overall_points: r.points,
      solved: r.solved,
      total_questions: r.totalQ,
      total_time_seconds: r.timeSeconds ?? '',
      last_submit: r.submittedAt || '',
    }));
    const headers = [
      'rank', 'student_name', 'student_email', 'student_roll_number', 'score_percent',
      'overall_points', 'solved', 'total_questions', 'total_time_seconds', 'last_submit',
    ];
    downloadCsv(`${(test.title || 'test').replace(/\s+/g, '_')}_leaderboard.csv`, headers, rows);
  };

  const downloadDetailedExcelReport = async () => {
    if (!test?.id || detailedReportDownloading) return;
    setDetailedReportDownloading(true);
    try {
      const response = await apiClient.get(`${API_URL}/test-report/${test.id}`, {
        responseType: 'blob',
      });
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = (test.title || 'SlashCoder_Test').replace(/[^\w-]+/g, '_');
      link.href = url;
      link.download = `${safeName}_Detailed_Report.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download detailed Excel report:', error);
      alert('Failed to download detailed Excel report. Please try again.');
    } finally {
      setDetailedReportDownloading(false);
    }
  };

  const activeExport = (() => {
    if (activeTab === 'questions') return { label: 'Download Questions (Excel)', onClick: exportQuestionsCsv };
    if (activeTab === 'submissions') return { label: 'Download Submissions (Excel)', onClick: exportSubmissionsCsv };
    if (activeTab === 'analytics') return { label: 'Download Analytics (Excel)', onClick: exportAnalyticsCsv };
    if (activeTab === 'leaderboard') return { label: 'Download Leaderboard (Excel)', onClick: exportLeaderboardCsv };
    return null;
  })();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', padding: '20px 40px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer',
            fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px',
            marginBottom: '12px', padding: 0
          }}
        >
          <ArrowLeft size={16} /> Back to tests
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
              {test.title}
            </h1>
            <p style={{ fontSize: '14px', color: '#666' }}>{test.description || 'No description'}</p>
            <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '13px', color: '#999' }}>
              <span><Clock size={14} style={{ verticalAlign: 'middle' }} /> {test.duration_minutes} mins</span>
              <span><Users size={14} style={{ verticalAlign: 'middle' }} /> {submissions.length} submissions</span>
              <span>{questions.length} questions</span>
            </div>
            {!canEdit && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#1565c0', fontWeight: 600 }}>
                View-only access enabled for this test.
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {shareUrl && (
              <button
                onClick={handleCopyLink}
                style={{
                  padding: '10px 16px', backgroundColor: '#ef4444', color: '#fff',
                  border: 'none', borderRadius: '4px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600
                }}
              >
                Copy Test Link
              </button>
            )}
            {linkStatus && (
              <span style={{ fontSize: '12px', color: '#16a34a' }}>{linkStatus}</span>
            )}
            {canEdit && (
              <button
                onClick={() => onAddQuestion(test)}
                style={{
                  padding: '10px 20px', backgroundColor: '#2196F3', color: 'white',
                  border: 'none', borderRadius: '4px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <Plus size={18} /> Add Question
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', padding: '0 40px' }}>
        <div style={{ display: 'flex', gap: '32px' }}>
          {['questions', 'submissions', 'analytics', 'leaderboard'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid #2196F3' : '2px solid transparent',
                color: activeTab === tab ? '#2196F3' : '#666',
                cursor: 'pointer', fontSize: '14px', fontWeight: 500, padding: '12px 0',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'questions' ? `Questions (${questions.length})` :
               tab === 'submissions'
                 ? `Submissions (${Array.isArray(detailedAnalytics?.students) ? detailedAnalytics.students.length : submissions.length})`
                 : tab === 'analytics'
                   ? 'Analytics'
                   : 'Leaderboard'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 40px' }}>
        {activeExport && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button
              onClick={activeExport.onClick}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #90CAF9',
                background: '#fff',
                color: '#1565c0',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Download size={14} />
              {activeExport.label}
            </button>
            <button
              onClick={downloadDetailedExcelReport}
              disabled={detailedReportDownloading}
              title="Detailed report includes full analysis"
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #1d4ed8',
                background: detailedReportDownloading ? '#eff6ff' : '#1d4ed8',
                color: detailedReportDownloading ? '#1d4ed8' : '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: detailedReportDownloading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: detailedReportDownloading ? 0.72 : 1,
              }}
            >
              <Download size={14} />
              {detailedReportDownloading ? 'Preparing Excel...' : 'Download Detailed Excel Report'}
            </button>
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{
              width: '40px', height: '40px', border: '4px solid #f3f3f3',
              borderTop: '4px solid #2196F3', borderRadius: '50%',
              animation: 'spin 1s linear infinite', margin: '0 auto'
            }} />
          </div>
        ) : (
          <>
            {/* Questions Tab */}
            {activeTab === 'questions' && (
              <div>
                {questions.length === 0 ? (
                  <div style={{
                    backgroundColor: '#fff', border: '1px solid #e0e0e0',
                    borderRadius: '4px', padding: '60px', textAlign: 'center'
                  }}>
                    <p style={{ color: '#999', marginBottom: '16px' }}>No questions added yet</p>
                    {canEdit && (
                      <button
                        onClick={() => onAddQuestion(test)}
                        style={{
                          padding: '10px 20px', backgroundColor: '#2196F3', color: 'white',
                          border: 'none', borderRadius: '4px', cursor: 'pointer',
                          fontSize: '14px', fontWeight: 500
                        }}
                      >
                        <Plus size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        Add First Question
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {questions.map((question, index) => (
                      <div
                        key={question.id}
                        style={{
                          backgroundColor: '#fff', border: '1px solid #e0e0e0',
                          borderRadius: '4px', padding: '20px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                              <span style={{
                                backgroundColor: '#f0f0f0', color: '#666',
                                padding: '4px 12px', borderRadius: '12px',
                                fontSize: '12px', fontWeight: 600
                              }}>Q{index + 1}</span>
                              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#333', margin: 0 }}>
                                {question.title}
                              </h3>
                              <span style={{
                                backgroundColor: getDifficultyColor(question.difficulty) + '20',
                                color: getDifficultyColor(question.difficulty),
                                padding: '3px 10px', borderRadius: '12px',
                                fontSize: '12px', fontWeight: 600
                              }}>{question.difficulty}</span>
                              <span style={{
                                backgroundColor: '#E3F2FD', color: '#1976D2',
                                padding: '3px 10px', borderRadius: '12px',
                                fontSize: '12px', fontWeight: 500
                              }}>{question.topic.replace(/_/g, ' ')}</span>
                              {String(question.question_type || 'coding').toLowerCase() === 'mcq' && (
                                <span style={{
                                  backgroundColor: '#ede9fe', color: '#6d28d9',
                                  padding: '3px 10px', borderRadius: '12px',
                                  fontSize: '12px', fontWeight: 600
                                }}>MCQ</span>
                              )}
                            </div>
                            
                            <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px', lineHeight: '1.5' }}>
                              {question.description.length > 150
                                ? question.description.substring(0, 150) + '...'
                                : question.description}
                            </p>
                            {question.image_url && (
                              <div style={{ marginBottom: '12px' }}>
                                <img
                                  src={question.image_url}
                                  alt="Question visual"
                                  style={{ maxWidth: '320px', width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                />
                              </div>
                            )}
                            
                            <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#999' }}>
                              <span>{question.points} points</span>
                              <span>{question.time_limit_ms}ms time limit</span>
                              {String(question.question_type || 'coding').toLowerCase() === 'mcq'
                                ? <span>{(question.mcq_options || []).length} options</span>
                                : <span>{question.test_cases?.length || 0} test cases</span>}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          {canEdit && (
                            <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                              {/* Edit Button */}
                              <button
                                onClick={() => setEditingQuestion(question)}
                                title="Edit question"
                                style={{
                                  padding: '6px 12px', backgroundColor: 'transparent',
                                  color: '#2196F3', border: '1px solid #2196F3',
                                  borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
                                  display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                <Edit2 size={14} /> Edit
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => setDeletingQuestion(question)}
                                title="Delete question"
                                style={{
                                  padding: '6px 12px', backgroundColor: 'transparent',
                                  color: '#f44336', border: '1px solid #f44336',
                                  borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
                                  display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Submissions Tab */}
            {activeTab === 'submissions' && (
              <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                {detailedAnalytics && Array.isArray(detailedAnalytics.students) ? (
                  detailedAnalytics.students.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
                      <tr>
                        {[
                          'NAME',
                          'EMAIL ID',
                          'ROLL NO',
                          'TEST START',
                            'TEST END',
                            'SUBMISSION TIME',
                            'LANGUAGE',
                            'OVERALL MARKS',
                            'OVERALL POINTS',
                            'TAB SWITCHES',
                            'PASTED'
                          ].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailedAnalytics.students.map((s) => (
                        <tr key={s.student_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                            <button
                              onClick={() => openStudentDetails(s)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                margin: 0,
                                color: '#2196F3',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                              }}
                              title="View student details"
                            >
                              {s.student_name || 'Unknown'}
                            </button>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>{s.student_email || 'Unknown'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', fontWeight: 600 }}>
                            {s.student_roll_number || '-'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                            {formatDateTime(s.started_at)}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                            {formatDateTime(s.overall_submitted_at || s.deadline_at)}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                            {formatDuration(s.overall_submission_time_seconds)}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: '999px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontWeight: 700 }}>
                              {formatLanguage(s.primary_language)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                              backgroundColor: s.overall_score >= 90 ? '#E8F5E9' : s.overall_score >= 50 ? '#FFF3E0' : '#FFEBEE',
                              color: s.overall_score >= 90 ? '#4CAF50' : s.overall_score >= 50 ? '#FF9800' : '#F44336'
                            }}>
                              {s.overall_score ?? 0}%
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', fontWeight: 600 }}>
                            {s.overall_points ?? 0}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                            {s.tab_switches ?? 0}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                            {(s.paste_count ?? 0) > 0 ? `Yes (${s.paste_count})` : 'No'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '60px', textAlign: 'center' }}>
                    <Users size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
                    <p style={{ color: '#999' }}>No submissions yet</p>
                  </div>
                )
                ) : submissions.length === 0 ? (
                  <div style={{ padding: '60px', textAlign: 'center' }}>
                    <Users size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
                    <p style={{ color: '#999' }}>No submissions yet</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
                      <tr>
                        {['STUDENT', 'ROLL NO', 'QUESTION', 'LANGUAGE', 'SCORE', 'EXEC TIME', 'SUBMISSION TIME', 'SUBMITTED'].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission) => {
                        const studentOverall = detailedAnalytics?.students?.find(
                          s => s.student_id === submission.student_id
                        );
                        const overallSeconds =
                          studentOverall?.overall_submission_time_seconds ??
                          getFallbackSubmissionSeconds(submission.student_id);
                        return (
                        <tr key={submission.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                            <div style={{ fontWeight: 600, color: '#333' }}>
                              {submission.student_name || `Student #${submission.student_id}`}
                            </div>
                            {submission.student_email && (
                              <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                                {submission.student_email}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', fontWeight: 600 }}>
                            {submission.student_roll_number || studentOverall?.student_roll_number || '-'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                            {submission.question_title || `Q#${submission.question_id}`}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: '999px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontWeight: 700 }}>
                              {formatLanguage(submission.language)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                              backgroundColor: submission.score === 100 ? '#E8F5E9' : submission.score >= 50 ? '#FFF3E0' : '#FFEBEE',
                              color: submission.score === 100 ? '#4CAF50' : submission.score >= 50 ? '#FF9800' : '#F44336'
                            }}>{submission.score}%</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#666' }}>
                            {formatDurationMs(submission.execution_time_ms)}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#666' }}>
                            {formatDuration(overallSeconds)}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#999' }}>
                            {`${new Date(submission.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })} IST`}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                  {[
                    { label: 'Total Questions', value: totalQuestions, color: '#2196F3' },
                    { label: 'Total Submissions', value: totalSubmissions, color: '#4CAF50' },
                    { label: 'Average Score', value: `${averageScore}%`, color: '#FF9800' },
                    { label: 'Pass Rate', value: `${passRate}%`, color: '#9C27B0' }
                  ].map(card => (
                    <div key={card.label} style={{
                      backgroundColor: '#fff', border: '1px solid #e0e0e0',
                      borderRadius: '4px', padding: '20px', borderLeft: `4px solid ${card.color}`
                    }}>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{card.label}</div>
                      <div style={{ fontSize: '28px', fontWeight: 600, color: '#333' }}>{card.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '20px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Detailed Student Analytics</h3>
                  {!detailedAnalytics || !Array.isArray(detailedAnalytics.students) ? (
                    <div style={{ color: '#999', fontSize: '14px' }}>Detailed analytics not available.</div>
                  ) : detailedAnalytics.students.length === 0 ? (
                    <div style={{ color: '#999', fontSize: '14px' }}>No student attempts yet.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
                          <tr>
                            {[
                              'STUDENT',
                              'EMAIL',
                              'ROLL NO',
                              'TEST START',
                              'OVERALL SUBMITTED',
                              'OVERALL TIME',
                              'LANGUAGE',
                              'OVERALL SCORE',
                              'OVERALL POINTS'
                            ].map(h => (
                              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666' }}>
                                {h}
                              </th>
                            ))}
                            {(detailedAnalytics.questions || questions).map((q, i) => (
                              <th key={q.id || i} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666' }}>
                                Q{i + 1} END
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detailedAnalytics.students.map((s) => {
                            const qList = detailedAnalytics.questions || questions;
                            return (
                              <tr key={s.student_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600 }}>{s.student_name}</td>
                                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{s.student_email}</td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>{s.student_roll_number || '-'}</td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>{formatDateTime(s.started_at)}</td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>{formatDateTime(s.overall_submitted_at)}</td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>{formatDuration(s.overall_submission_time_seconds)}</td>
                                <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                                  <span style={{ padding: '3px 9px', borderRadius: '999px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontWeight: 700 }}>
                                    {formatLanguage(s.primary_language)}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    backgroundColor: s.overall_score >= 70 ? '#E8F5E9' : s.overall_score >= 40 ? '#FFF3E0' : '#FFEBEE',
                                    color: s.overall_score >= 70 ? '#4CAF50' : s.overall_score >= 40 ? '#FF9800' : '#F44336'
                                  }}>
                                    {s.overall_score}%
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', fontWeight: 600 }}>
                                  {s.overall_points ?? 0}
                                </td>
                                {qList.map((q, i) => {
                                  const qEntry = s.questions?.[q.id];
                                  const submittedAt = qEntry?.submitted_at;
                                  const score = qEntry?.score;
                                  const language = formatLanguage(qEntry?.language);
                                  const pointsEarnedRaw = qEntry?.points_earned;
                                  const qPoints = q.points ?? 0;
                                  const pointsEarned = pointsEarnedRaw !== undefined && pointsEarnedRaw !== null
                                    ? pointsEarnedRaw
                                    : (score !== undefined ? ((score / 100) * qPoints) : null);
                                  const hasSubmittedAt = submittedAt && submittedAt !== '-' && submittedAt !== '—' && submittedAt !== 'â€”';
                                  return (
                                    <td key={q.id || i} style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                                      {hasSubmittedAt
                                        ? `${formatDateTime(submittedAt)} - ${language}${score !== undefined ? ` (${score}%${pointsEarned !== null ? ` / ${Number(pointsEarned).toFixed(2)} pts` : ''})` : ''}`
                                        : '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Question-wise Performance</h3>
                  {(detailedAnalytics?.questions || questions).map((question, index) => {
                    const questionSubs = submissions.filter(s => s.question_id === question.id);
                    const analyticsEntry = analyticsQuestions.find(q => q.question_id === question.id);
                    const submissionCount = analyticsEntry?.total_submissions ?? questionSubs.length;
                    const avgScoreBase = question.average_score ?? analyticsEntry?.average_score;
                    const avgScore = avgScoreBase !== undefined
                      ? Math.round(avgScoreBase)
                      : questionSubs.length > 0
                        ? Math.round(questionSubs.reduce((sum, s) => sum + s.score, 0) / questionSubs.length)
                        : 0;
                    const avgExecMs = question.avg_execution_time_ms ?? null;
                    const avgCompMs = question.avg_compilation_time_ms ?? null;
                    return (
                      <div key={question.id} style={{
                        display: 'flex', alignItems: 'center', padding: '12px 0',
                        borderBottom: index < questions.length - 1 ? '1px solid #f0f0f0' : 'none'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                            Q{index + 1}: {question.title}
                          </div>
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            {submissionCount} submissions - Language: {formatLanguage(question.language || analyticsEntry?.language)} - Avg: {avgScore}% - Exec: {formatDurationMs(avgExecMs)} - Comp: {formatDurationMs(avgCompMs)}
                          </div>
                        </div>
                        <div style={{ width: '200px' }}>
                          <div style={{ height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${avgScore}%`,
                              backgroundColor: avgScore >= 70 ? '#4CAF50' : avgScore >= 40 ? '#FF9800' : '#F44336',
                              transition: 'width 0.3s'
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div>
                <style>{`
                  @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                  }
                `}</style>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', minWidth: '180px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Participants</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#333' }}>{leaderboardRows.length}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', minWidth: '180px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Tie Breaker</div>
                    <div style={{ fontSize: '12px', color: '#333', fontWeight: 600 }}>Higher score, faster time</div>
                    <div style={{ fontSize: '11px', color: '#999' }}>Sorted by score, then total time</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', minWidth: '180px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Live</div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', borderRadius: '999px',
                      fontSize: '12px', fontWeight: 700,
                      color: test?.is_active ? '#166534' : '#6b7280',
                      background: test?.is_active
                        ? 'linear-gradient(90deg, #dcfce7 0%, #bbf7d0 50%, #dcfce7 100%)'
                        : '#f3f4f6',
                      backgroundSize: '200% 100%',
                      animation: test?.is_active ? 'shimmer 1.6s linear infinite' : 'none',
                    }}>
                      {test?.is_active ? 'Live Updates' : 'Paused'}
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#333' }}>Leaderboard</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>Updates every few seconds</div>
                  </div>
                  {leaderboardRows.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No attempts yet.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
                        <thead style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
                          <tr>
                              {['RANK', 'STUDENT', 'ROLL NO', 'SCORE', 'OVERALL POINTS', 'SOLVED', 'TIME', 'LAST SUBMIT'].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#666' }}>
                                  {h}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboardRows.map((row) => {
                            const rankColor = row.rank === 1 ? '#f59e0b' : row.rank === 2 ? '#94a3b8' : row.rank === 3 ? '#b45309' : '#cbd5f5';
                            const rankBg = row.rank === 1 ? '#fff7ed' : row.rank === 2 ? '#f8fafc' : row.rank === 3 ? '#fff7ed' : '#f1f5f9';
                            const isHovered = hoveredLeaderboardId === row.student_id;
                            const qList = detailedAnalytics?.questions || questions || [];
                            return (
                              <tr
                                key={row.student_id}
                                onMouseEnter={() => setHoveredLeaderboardId(row.student_id)}
                                onMouseLeave={() => setHoveredLeaderboardId(null)}
                                style={{ borderBottom: '1px solid #f0f0f0' }}
                              >
                                <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', height: '24px', borderRadius: '999px', background: rankBg, color: rankColor, fontWeight: 700 }}>
                                    #{row.rank}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', position: 'relative' }}>
                                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>{row.name}</div>
                                  <div style={{ fontSize: '12px', color: '#999' }}>{row.email}</div>
                                  {isHovered && qList.length > 0 && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '100%',
                                      left: 0,
                                      marginTop: '8px',
                                      width: '320px',
                                      background: '#fff',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: '8px',
                                      boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                                      zIndex: 20,
                                      padding: '10px 12px'
                                    }}>
                                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                                        Per-question breakdown
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                                        {qList.map((q, i) => {
                                          const qEntry = (detailedAnalytics?.students || []).find(s => s.student_id === row.student_id)?.questions?.[q.id];
                                          const score = qEntry?.score;
                                          const submittedAt = qEntry?.submitted_at;
                                          return (
                                            <div key={q.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                              <div style={{ color: '#334155' }}>Q{i + 1}: {q.title || q.id}</div>
                                              <div style={{ color: '#64748b' }}>
                                                {score !== undefined ? `${Math.round(score)}%` : '-'} {submittedAt ? `· ${formatDateTime(submittedAt)}` : ''}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>
                                  {row.roll_number || '-'}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{
                                    padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
                                    backgroundColor: row.score >= 90 ? '#E8F5E9' : row.score >= 50 ? '#FFF3E0' : '#FFEBEE',
                                    color: row.score >= 90 ? '#4CAF50' : row.score >= 50 ? '#FF9800' : '#F44336'
                                  }}>
                                    {row.score}%
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', fontWeight: 700 }}>
                                  {row.points} pts
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                                  {row.totalQ ? `${row.solved}/${row.totalQ}` : '-'}
                                </td>
                                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                                    {row.timeSeconds !== null ? formatDuration(row.timeSeconds) : '-'}
                                  </td>
                                <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                                  {row.submittedAt ? formatDateTime(row.submittedAt) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* âœ… EDIT QUESTION MODAL */}
      {editingQuestion && canEdit && (
        <EditQuestionModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSuccess={(updatedQuestion) => {
            setQuestions(prev => prev.map(q => q.id === updatedQuestion.id ? updatedQuestion : q));
            setEditingQuestion(null);
          }}
        />
      )}

      {/* âœ… DELETE CONFIRMATION DIALOG */}
      {deletingQuestion && canEdit && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.22)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '8px', padding: '28px',
            width: '100%', maxWidth: '420px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                backgroundColor: '#FFEBEE', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Trash2 size={20} color="#F44336" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#333', margin: 0 }}>
                Delete Question?
              </h3>
            </div>

            <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px', lineHeight: '1.5' }}>
              Are you sure you want to delete:
            </p>
            <div style={{
              backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0',
              borderRadius: '4px', padding: '12px', marginBottom: '20px'
            }}>
              <strong style={{ fontSize: '14px', color: '#333' }}>{deletingQuestion.title}</strong>
              <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0' }}>
                This will also delete all test cases and submissions for this question. This action cannot be undone.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeletingQuestion(null)}
                disabled={deleteLoading}
                style={{
                  flex: 1, padding: '10px', border: '1px solid #ddd',
                  borderRadius: '4px', cursor: 'pointer', fontSize: '14px',
                  fontWeight: 500, backgroundColor: 'white', color: '#333'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  flex: 1, padding: '10px', backgroundColor: deleteLoading ? '#ef9a9a' : '#F44336',
                  color: 'white', border: 'none', borderRadius: '4px',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 500
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Details Modal */}
      {selectedStudent && detailedAnalytics && Array.isArray(detailedAnalytics.questions) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.22)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px'
        }}
          onClick={closeStudentDetails}
        >
          <div style={{
            backgroundColor: '#fff', borderRadius: '8px', padding: '24px',
            width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 6px 24px rgba(0,0,0,0.18)'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#333' }}>
                  {selectedStudent.student_name || 'Student'}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {selectedStudent.student_email || '-'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Roll No: {selectedStudent.student_roll_number || '-'}
                </div>
              </div>
              <button
                onClick={closeStudentDetails}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '11px', color: '#999' }}>Test Start</div>
                <div style={{ fontSize: '13px', color: '#333', fontWeight: 600 }}>{formatDateTime(selectedStudent.started_at)}</div>
              </div>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '11px', color: '#999' }}>Last Submit</div>
                <div style={{ fontSize: '13px', color: '#333', fontWeight: 600 }}>{formatDateTime(selectedStudent.overall_submitted_at || selectedStudent.deadline_at)}</div>
              </div>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '11px', color: '#999' }}>Time to Submit</div>
                <div style={{ fontSize: '13px', color: '#333', fontWeight: 600 }}>{formatDuration(selectedStudent.overall_submission_time_seconds)}</div>
              </div>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '11px', color: '#999' }}>Total w/ Exec</div>
                <div style={{ fontSize: '13px', color: '#333', fontWeight: 600 }}>
                  {formatCompletionWithExec(
                    selectedStudent.overall_submission_time_seconds,
                    selectedStudent.total_execution_time_ms,
                    selectedStudent.total_compilation_time_ms
                  )}
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
                <thead style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #e0e0e0' }}>
                  <tr>
                    {['QUESTION', 'SCORE', 'POINTS', 'LANG', 'SUBMITTED', 'EXEC TIME', 'COMP TIME', 'AUTO'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailedAnalytics.questions.map((q) => {
                    const qEntry = selectedStudent.questions?.[q.id] || null;
                    const qPoints = q.points ?? 0;
                    const pointsEarnedRaw = qEntry?.points_earned;
                    const pointsEarned = pointsEarnedRaw !== undefined && pointsEarnedRaw !== null
                      ? pointsEarnedRaw
                      : (qEntry?.score !== undefined ? ((qEntry.score / 100) * qPoints) : null);
                    return (
                      <tr key={q.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: '#333' }}>
                          {q.title || q.id}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: '#333' }}>
                          {qEntry?.score ?? '-'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: '#333' }}>
                          {pointsEarned !== null ? Number(pointsEarned).toFixed(2) : '-'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#666' }}>
                          {formatLanguage(qEntry?.language)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#666' }}>
                          {formatDateTime(qEntry?.submitted_at)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#666' }}>
                          {formatDurationMs(qEntry?.execution_time_ms)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#666' }}>
                          {formatDurationMs(qEntry?.compilation_time_ms)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#666' }}>
                          {qEntry?.auto_submit ? 'Yes' : 'No'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// âœ… EDIT QUESTION MODAL COMPONENT - with full test case editing
function EditQuestionModal({ question, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: question.title,
    description: question.description,
    image_url: question.image_url || '',
    difficulty: question.difficulty,
    topic: question.topic,
    points: question.points,
    time_limit_ms: question.time_limit_ms
  });
  const [questionType, setQuestionType] = useState(
    String(question.question_type || 'coding').toLowerCase() === 'mcq' ? 'mcq' : 'coding'
  );
  const [mcqOptions, setMcqOptions] = useState(
    Array.isArray(question.mcq_options) && question.mcq_options.length > 0 ? question.mcq_options : ['', '']
  );
  const [mcqCorrect, setMcqCorrect] = useState(
    Number.isInteger(question.mcq_correct_option) ? question.mcq_correct_option : 0
  );
  const [mcqNegativeEnabled, setMcqNegativeEnabled] = useState(Boolean(question.mcq_negative_enabled));
  const [mcqNegativeMarks, setMcqNegativeMarks] = useState(Number(question.mcq_negative_marks || 0));
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [isCustomDifficulty, setIsCustomDifficulty] = useState(false);
  const [customDifficulty, setCustomDifficulty] = useState('');
  const [saving, setSaving] = useState(false);

  // Each test case: { id (if existing), input, expected_output, is_hidden, points, _status: 'existing'|'new'|'deleted' }
  const [testCases, setTestCases] = useState(
    (question.test_cases || []).map(tc => ({ ...tc, _status: 'existing' }))
  );

  const PRESET_TOPICS = [
    'ARRAYS', 'STRINGS', 'LINKED_LISTS', 'TREES', 'GRAPHS',
    'SORTING', 'SEARCHING', 'DYNAMIC_PROGRAMMING', 'RECURSION',
    'BACKTRACKING', 'STACK_QUEUE', 'HEAP'
  ];

  const PRESET_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

  useEffect(() => {
    const topicUpper = question.topic.toUpperCase();
    if (!PRESET_TOPICS.includes(topicUpper)) {
      setIsCustomTopic(true);
      setCustomTopic(question.topic.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));
    } else {
      setFormData(prev => ({ ...prev, topic: topicUpper }));
    }

    const difficultyUpper = String(question.difficulty || '').toUpperCase();
    if (!PRESET_DIFFICULTIES.includes(difficultyUpper)) {
      setIsCustomDifficulty(true);
      setCustomDifficulty(String(question.difficulty || '').replace(/_/g, ' '));
    } else {
      setFormData(prev => ({ ...prev, difficulty: difficultyUpper }));
    }
  }, []);

  const handleTopicChange = (e) => {
    const value = e.target.value;
    if (value === 'CUSTOM') {
      setIsCustomTopic(true);
      setFormData({ ...formData, topic: '' });
    } else {
      setIsCustomTopic(false);
      setCustomTopic('');
      setFormData({ ...formData, topic: value });
    }
  };

  const handleDifficultyChange = (e) => {
    const value = e.target.value;
    if (value === 'CUSTOM') {
      setIsCustomDifficulty(true);
      setFormData({ ...formData, difficulty: '' });
      return;
    }
    setIsCustomDifficulty(false);
    setCustomDifficulty('');
    setFormData({ ...formData, difficulty: value });
  };

  const updateTestCase = (index, field, value) => {
    setTestCases(prev => prev.map((tc, i) => i === index ? { ...tc, [field]: value } : tc));
  };

  const markDeleted = (index) => {
    setTestCases(prev => prev.map((tc, i) => i === index ? { ...tc, _status: 'deleted' } : tc));
  };

  const addNewTestCase = () => {
    setTestCases(prev => [...prev, {
      input: '', expected_output: '', is_hidden: false, points: 1, _status: 'new'
    }]);
  };

  const visibleTestCases = testCases.map((tc, i) => ({ ...tc, _index: i })).filter(tc => tc._status !== 'deleted');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isCustomTopic && !customTopic.trim()) {
      alert('Please enter a custom topic name.');
      return;
    }
    setSaving(true);
    try {
      if (questionType === 'mcq') {
        const options = mcqOptions.map(o => o.trim()).filter(Boolean);
        if (options.length < 2) { alert('MCQ needs at least 2 options.'); setSaving(false); return; }
        if (mcqCorrect < 0 || mcqCorrect >= options.length) { alert('Select a valid correct option.'); setSaving(false); return; }
        const response = await apiClient.put(`${API_URL}/questions/${question.id}`, {
          ...formData,
          question_type: 'mcq',
          mcq_options: options,
          mcq_correct_option: mcqCorrect,
          mcq_negative_enabled: mcqNegativeEnabled,
          mcq_negative_marks: mcqNegativeEnabled ? parseFloat(mcqNegativeMarks) || 0 : 0,
        });
        onSuccess(response.data);
      } else {
        // 1. Update question fields
        const response = await apiClient.put(`${API_URL}/questions/${question.id}`, { ...formData, question_type: 'coding' });

        // 2. Delete test cases marked as deleted
        const toDelete = testCases.filter(tc => tc._status === 'deleted' && tc.id);
        for (const tc of toDelete) {
          await apiClient.delete(`${API_URL}/test-cases/${tc.id}`);
        }

        // 3. Update existing test cases that were modified
        const toUpdate = testCases.filter(tc => tc._status === 'existing' && tc.id);
        for (const tc of toUpdate) {
          await apiClient.put(`${API_URL}/test-cases/${tc.id}`, {
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden,
            points: tc.points
          });
        }

        // 4. Create new test cases
        const toCreate = testCases.filter(tc => tc._status === 'new');
        for (const tc of toCreate) {
          await apiClient.post(`${API_URL}/test-cases`, {
            question_id: question.id,
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden,
            points: tc.points
          });
        }

        onSuccess(response.data);
      }
    } catch (error) {
      console.error('Error updating question:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15,23,42,0.22)', display: 'flex',
      alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto',
      padding: '20px 0'
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '8px', padding: '24px',
        width: '100%', maxWidth: '700px', margin: '0 20px'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#333', margin: 0 }}>Edit Question</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Question Type */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Question Type</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setQuestionType('coding')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${questionType === 'coding' ? '#2196F3' : '#ddd'}`,
                  background: questionType === 'coding' ? '#e3f2fd' : '#fff',
                  color: questionType === 'coding' ? '#1565c0' : '#555',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Normal (Coding)
              </button>
              <button
                type="button"
                onClick={() => setQuestionType('mcq')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${questionType === 'mcq' ? '#2196F3' : '#ddd'}`,
                  background: questionType === 'mcq' ? '#e3f2fd' : '#fff',
                  color: questionType === 'mcq' ? '#1565c0' : '#555',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                MCQ
              </button>
            </div>
          </div>
          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Question Title</label>
            <input
              type="text" value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
              required
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', minHeight: '100px', boxSizing: 'border-box' }}
              required
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Question Image URL</label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
              placeholder="https://example.com/question-image.png"
            />
          </div>

          {/* Difficulty + Topic */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Difficulty</label>
              <select
                value={isCustomDifficulty ? 'CUSTOM' : formData.difficulty}
                onChange={handleDifficultyChange}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
                <option value="CUSTOM">Custom Difficulty...</option>
              </select>
              {isCustomDifficulty && (
                <input
                  type="text"
                  placeholder="e.g. Beginner, Expert, Company-Level"
                  value={customDifficulty}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setCustomDifficulty(raw);
                    setFormData({ ...formData, difficulty: raw.trim().toUpperCase().replace(/\s+/g, '_') });
                  }}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #2196F3', borderRadius: '4px', fontSize: '14px', marginTop: '8px', boxSizing: 'border-box' }}
                  required={isCustomDifficulty}
                />
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Topic</label>
              <select
                value={isCustomTopic ? 'CUSTOM' : formData.topic}
                onChange={handleTopicChange}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
              >
                {PRESET_TOPICS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                <option value="CUSTOM">Custom Topic...</option>
              </select>
              {isCustomTopic && (
                <>
                  <input
                    type="text" placeholder="e.g. Machine Learning" value={customTopic}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCustomTopic(raw);
                      setFormData({ ...formData, topic: raw.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') });
                    }}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #2196F3', borderRadius: '4px', fontSize: '14px', marginTop: '8px', boxSizing: 'border-box' }}
                    autoFocus required={isCustomTopic}
                  />
                  {customTopic && <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>Saved as: <code style={{ color: '#2196F3' }}>{formData.topic}</code></div>}
                </>
              )}
            </div>
          </div>

          {/* Points + Time Limit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Points</label>
              <input type="number" value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                min="1"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Time Limit (ms)</label>
              <input type="number" value={formData.time_limit_ms}
                onChange={(e) => setFormData({ ...formData, time_limit_ms: parseInt(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                min="100" step="100"
              />
            </div>
          </div>

          {questionType === 'coding' ? (
          <div style={{ borderTop: '1px solid #eee', paddingTop: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#333', margin: 0 }}>
                Test Cases
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#999', marginLeft: '8px' }}>
                  ({visibleTestCases.length} total)
                </span>
              </h4>
              <button
                type="button" onClick={addNewTestCase}
                style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                + Add Test Case
              </button>
            </div>

            {visibleTestCases.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '4px', color: '#999', fontSize: '14px' }}>
                No test cases. Click "+ Add Test Case" to add one.
              </div>
            )}

            {visibleTestCases.map((tc) => {
              const idx = tc._index;
              const isNew = tc._status === 'new';
              return (
                <div key={idx} style={{
                  backgroundColor: isNew ? '#F3F9FF' : '#f9f9f9',
                  border: `1px solid ${isNew ? '#BBDEFB' : '#eee'}`,
                  borderRadius: '4px', padding: '12px', marginBottom: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>
                      {isNew ? 'New Test Case' : `Test Case #${idx + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => isNew
                        ? setTestCases(prev => prev.filter((_, i) => i !== idx))
                        : markDeleted(idx)
                      }
                      style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#555' }}>Input</label>
                      <textarea
                        value={tc.input}
                        onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minHeight: '56px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#555' }}>Expected Output</label>
                      <textarea
                        value={tc.expected_output}
                        onChange={(e) => updateTestCase(idx, 'expected_output', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minHeight: '56px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                        required
                      />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', marginTop: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox" checked={tc.is_hidden}
                      onChange={(e) => updateTestCase(idx, 'is_hidden', e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    Hidden Test Case
                  </label>
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#555' }}>Marks</label>
                    <input
                      type="number"
                      min="1"
                      value={tc.points}
                      onChange={(e) => updateTestCase(idx, 'points', parseInt(e.target.value, 10) || 1)}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
          <div style={{ borderTop: '1px solid #eee', paddingTop: '16px', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#333', marginBottom: '10px' }}>MCQ Options</h4>
            {mcqOptions.map((opt, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <input type="radio" checked={mcqCorrect === idx} onChange={() => setMcqCorrect(idx)} />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...mcqOptions];
                    next[idx] = e.target.value;
                    setMcqOptions(next);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                />
                {mcqOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = mcqOptions.filter((_, i) => i !== idx);
                      setMcqOptions(next);
                      if (mcqCorrect >= next.length) setMcqCorrect(next.length - 1);
                    }}
                    style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMcqOptions(prev => [...prev, ''])}
              style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
            >
              + Add Option
            </button>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={mcqNegativeEnabled}
                  onChange={(e) => setMcqNegativeEnabled(e.target.checked)}
                />
                Enable Negative Marking
              </label>
              <input
                type="number"
                min="0"
                step="0.25"
                value={mcqNegativeMarks}
                disabled={!mcqNegativeEnabled}
                onChange={(e) => setMcqNegativeMarks(e.target.value)}
                style={{ width: '140px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: mcqNegativeEnabled ? '#fff' : '#f5f5f5' }}
                placeholder="Negative points"
              />
            </div>
          </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, backgroundColor: 'white', color: '#333' }}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 1, padding: '10px', backgroundColor: saving ? '#90CAF9' : '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500 }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TestDetailsPage;
