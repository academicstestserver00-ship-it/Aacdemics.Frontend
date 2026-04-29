
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  XCircle,
} from 'lucide-react';
import CodeEditor from './CodeEditor';
import api from '../services/api';

const LANGUAGE_LABELS = {
  python: 'Python',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
};

const DEFAULT_CODE = {
  python: '# Write your code here\n',
  c: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n',
  java: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}\n',
};

const LANGUAGE_ALIASES = {
  py: 'python',
  python: 'python',
  python3: 'python',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  cxx: 'cpp',
  java: 'java',
};

const normalizeLanguage = (value) => {
  const key = String(value || '').trim().toLowerCase();
  return LANGUAGE_ALIASES[key] || 'python';
};

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_meters: position.coords.accuracy,
        });
      },
      () => reject(new Error('Location permission is required to start this geofenced test.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function TestAttempt({ test, onBack, entryRollNumber = '', entryLocation = null }) {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [attemptInfo, setAttemptInfo] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timeUp, setTimeUp] = useState(false);

  const [submissionsByQuestion, setSubmissionsByQuestion] = useState({});
  const [languageByQuestionId, setLanguageByQuestionId] = useState({});
  const [codeByQuestionId, setCodeByQuestionId] = useState({});
  const [mcqAnswersByQuestionId, setMcqAnswersByQuestionId] = useState({});

  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(DEFAULT_CODE.python);

  const [isExecuting, setIsExecuting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [endSubmitting, setEndSubmitting] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [finalMessage, setFinalMessage] = useState('');

  const [pasteCount, setPasteCount] = useState(0);
  const [pasteWarning, setPasteWarning] = useState(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [forfeited, setForfeited] = useState(false);
  const [forfeitMessage, setForfeitMessage] = useState(null);

  const forfeitInFlightRef = useRef(false);
  const lastSwitchRef = useRef(0);
  const pasteWarningTimerRef = useRef(null);
  const autoSubmitRef = useRef(false);
  const resultPanelRef = useRef(null);
  const lastFeedbackKeyRef = useRef('');
  const shouldAutoScrollResultsRef = useRef(false);

  const allowedLanguages = useMemo(() => {
    const raw = Array.isArray(test?.allowed_languages)
      ? test.allowed_languages
      : ['python', 'c', 'cpp', 'java'];
    const normalized = raw
      .map(normalizeLanguage)
      .filter((lang, index, arr) => arr.indexOf(lang) === index);
    return normalized.length > 0 ? normalized : ['python', 'c', 'cpp', 'java'];
  }, [test?.allowed_languages]);

  const tabSwitchLimit = Math.max(1, Number(test?.tab_switch_limit ?? 3));
  const tabSwitchEnabled = test?.tab_switch_enabled !== false;
  const pasteDisabled = test?.anti_paste_enabled !== false;

  const currentQuestion = questions[currentQuestionIndex];
  const currentSubmission = currentQuestion ? submissionsByQuestion[currentQuestion.id] : null;
  const isLocked = timeUp || !!currentSubmission || forfeited || testSubmitted;
  const isBusy = isExecuting || isSubmitting || isLocked || endSubmitting;

  const extractErrorMessage = (err) => {
    const status = err?.response?.status;
    if (status === 504) {
      return 'Your code took too long to run. This may be an infinite loop. Please optimize and try again.';
    }
    if (Array.isArray(err?.response?.data?.detail)) {
      return err.response.data.detail.map((e) => `${e.loc?.join('.')} - ${e.msg}`).join('\n');
    }
    if (typeof err?.response?.data?.detail === 'string') {
      const detail = err.response.data.detail;
      if (/timed out/i.test(detail)) {
        return 'Your code took too long to run. This may be an infinite loop. Please optimize and try again.';
      }
      return detail;
    }
    if (typeof err?.response?.data === 'string') return err.response.data;
    if (/timed out|timeout/i.test(err?.message || '')) {
      return 'Your code took too long to run. This may be an infinite loop. Please optimize and try again.';
    }
    return err?.message || 'An unknown error occurred';
  };

  const extractDiagnosticsFromText = (text) => {
    if (!text) return [];
    const lines = String(text).split(/\r?\n/);
    const hits = [];

    const pushHit = (lineNum, colNum, message) => {
      if (!Number.isFinite(lineNum)) return;
      hits.push({
        line: lineNum,
        column: Number.isFinite(colNum) ? colNum : 1,
        message: message || 'Error',
      });
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let match = trimmed.match(/:(\d+):(\d+):\s*(.*)$/);
      if (match) {
        pushHit(Number(match[1]), Number(match[2]), match[3] || trimmed);
        return;
      }

      match = trimmed.match(/:(\d+):\s*(.*)$/);
      if (match) {
        pushHit(Number(match[1]), 1, match[2] || trimmed);
        return;
      }

      match = trimmed.match(/File ".*", line (\d+)/);
      if (match) {
        pushHit(Number(match[1]), 1, trimmed);
        return;
      }

      match = trimmed.match(/\((?:[^():]+):(\d+)\)/);
      if (match) {
        pushHit(Number(match[1]), 1, trimmed);
      }
    });

    return hits.slice(0, 6);
  };

  const getErrorTextFromResponse = (safeResponse) => {
    if (!safeResponse) return '';
    if (safeResponse?.compilation_error) return safeResponse.compilation_error;
    const results = Array.isArray(safeResponse?.results) ? safeResponse.results : [];
    for (const r of results) {
      const msg = r?.stderr || r?.error;
      if (msg) return msg;
    }
    return '';
  };

  const getDifficultyStyle = (difficulty) => {
    if ((difficulty || '').toUpperCase() === 'EASY') return { color: '#ef4444', bg: '#fee2e2' };
    if ((difficulty || '').toUpperCase() === 'MEDIUM') return { color: '#f59e0b', bg: '#fff7ed' };
    if ((difficulty || '').toUpperCase() === 'HARD') return { color: '#ef4444', bg: '#fee2e2' };
    return { color: '#6b7280', bg: '#f3f4f6' };
  };

  const getVerdictStyle = (testResult) => {
    const verdict = testResult.verdict || (testResult.passed ? 'PASS' : 'FAIL');
    if (verdict === 'PASS') return { icon: <CheckCircle size={16} color="#22c55e" />, color: '#22c55e', label: 'PASS' };
    if (verdict === 'TIME_LIMIT_EXCEEDED') return { icon: <Clock size={16} color="#f59e0b" />, color: '#f59e0b', label: 'TLE' };
    return { icon: <XCircle size={16} color="#ef4444" />, color: '#ef4444', label: 'FAIL' };
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(Math.floor(seconds % 60)).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const computeWeightedCodingScore = (question, safeResponse) => {
    const results = Array.isArray(safeResponse?.results) ? safeResponse.results : [];
    const testCases = Array.isArray(question?.test_cases) ? question.test_cases : [];
    if (testCases.length === 0) {
      const passedCount = Number(safeResponse?.summary?.passed || 0);
      const totalCount = Number(safeResponse?.summary?.total || 0);
      return totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
    }
    let earned = 0;
    let total = 0;
    testCases.forEach((tc, index) => {
      const marks = Number(tc?.points ?? 1);
      const weight = Number.isFinite(marks) && marks > 0 ? marks : 1;
      total += weight;
      if (results[index]?.passed) earned += weight;
    });
    return total > 0 ? Math.round((earned / total) * 100) : 0;
  };

  const getExecutionTimeSeconds = (safeResponse) => {
    const results = Array.isArray(safeResponse?.results) ? safeResponse.results : [];
    const times = results
      .map((r) => Number(r?.time_ms))
      .filter((v) => Number.isFinite(v) && v >= 0);
    if (times.length === 0) return null;
    const totalMs = times.reduce((acc, v) => acc + v, 0);
    return Math.round((totalMs / 1000) * 1000) / 1000;
  };

  const scrollResultPanelIntoView = () => {
    const node = resultPanelRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const isVisible = rect.top >= 0 && rect.bottom <= viewportHeight;
    if (!isVisible) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    try {
      node.scrollTo({ top: 0, behavior: 'auto' });
    } catch {
      node.scrollTop = 0;
    }
  };

  useEffect(() => {
    const key = JSON.stringify({
      hasResult: !!result,
      hasError: !!error,
      submitSuccess: submitSuccess || '',
      forfeitMessage: forfeitMessage || '',
      pasteWarning: pasteWarning || '',
    });
    if (key !== lastFeedbackKeyRef.current) {
      lastFeedbackKeyRef.current = key;
      if (shouldAutoScrollResultsRef.current) {
        shouldAutoScrollResultsRef.current = false;
        requestAnimationFrame(scrollResultPanelIntoView);
      }
    }
  }, [result, error, submitSuccess, forfeitMessage, pasteWarning]);

  useEffect(() => {
    setLanguage(allowedLanguages[0] || 'python');
    setCode(DEFAULT_CODE[allowedLanguages[0] || 'python'] || DEFAULT_CODE.python);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSubmissionsByQuestion({});
    setLanguageByQuestionId({});
    setCodeByQuestionId({});
    setMcqAnswersByQuestionId({});
    setResult(null);
    setError(null);
    setSubmitSuccess(null);
    setPasteCount(0);
    setTabSwitches(0);
    setForfeited(false);
    setForfeitMessage(null);
    autoSubmitRef.current = false;
    setEndSubmitting(false);
    setTestSubmitted(false);
    setFinalMessage('');
  }, [test?.id, allowedLanguages]);

  useEffect(() => {
    async function fetchQuestions() {
      if (!test?.id) return;
      setIsLoadingQuestions(true);
      setLoadError(null);

      try {
        let location = entryLocation;
        if (test?.geo_fencing_enabled && !location) {
          location = await getBrowserLocation();
        }
        const [questionsData, submissionsData, attemptData] = await Promise.all([
          api.getStudentTestQuestions(test.id),
          api.getStudentTestSubmissions(test.id),
          api.startTestAttempt(test.id, entryRollNumber, location),
        ]);

        if (!Array.isArray(questionsData)) {
          throw new Error('Unexpected response format');
        }

        const submissionMap = {};
        if (Array.isArray(submissionsData)) {
          submissionsData.forEach((sub) => {
            if (sub?.question_id) submissionMap[sub.question_id] = sub;
          });
        }

        const nextLanguageMap = {};
        const nextCodeMap = {};
        const nextMcqMap = {};
        questionsData.forEach((q) => {
          if (submissionMap[q.id]?.language) {
            const lang = normalizeLanguage(submissionMap[q.id].language);
            nextLanguageMap[q.id] = lang;
            nextCodeMap[q.id] = submissionMap[q.id].code ?? (DEFAULT_CODE[lang] || DEFAULT_CODE.python);
          } else {
            const fallback = allowedLanguages[0] || 'python';
            nextLanguageMap[q.id] = fallback;
            nextCodeMap[q.id] = DEFAULT_CODE[fallback] || DEFAULT_CODE.python;
          }
          if (submissionMap[q.id]?.selected_option !== undefined) {
            nextMcqMap[q.id] = submissionMap[q.id].selected_option;
          }
        });

        setQuestions(questionsData);
        setSubmissionsByQuestion(submissionMap);
        setLanguageByQuestionId(nextLanguageMap);
        setCodeByQuestionId(nextCodeMap);
        setMcqAnswersByQuestionId(nextMcqMap);
        setAttemptInfo(attemptData || null);
        if (attemptData?.submitted) {
          setTestSubmitted(true);
          setFinalMessage('Your test response has been recorded. See you soon.');
        }

        if (attemptData?.forfeited) {
          setForfeited(true);
          setForfeitMessage('Test forfeited due to excessive tab switching.');
        }

        if (questionsData.length > 0) {
          const firstQ = questionsData[0];
          setCurrentQuestionIndex(0);
          setLanguage(nextLanguageMap[firstQ.id] || allowedLanguages[0] || 'python');
          setCode(nextCodeMap[firstQ.id] || DEFAULT_CODE.python);
        }
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoadingQuestions(false);
      }
    }

    fetchQuestions();
  }, [test?.id, allowedLanguages, entryRollNumber, entryLocation]);

  useEffect(() => {
    if (!attemptInfo || typeof attemptInfo.remaining_seconds !== 'number') return;
    const totalSeconds = Math.max(0, Math.floor(attemptInfo.remaining_seconds));
    setTimeLeft(totalSeconds);
    setTimeUp(totalSeconds <= 0);
    if (totalSeconds <= 0) return;

    const endAt = Date.now() + totalSeconds * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        setTimeUp(true);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [attemptInfo?.started_at, attemptInfo?.remaining_seconds]);

  useEffect(() => {
    const q = questions[currentQuestionIndex];
    if (!q) return;
    shouldAutoScrollResultsRef.current = false;
    const nextLang = normalizeLanguage(languageByQuestionId[q.id] || allowedLanguages[0] || 'python');
    const nextCode = codeByQuestionId[q.id] ?? (DEFAULT_CODE[nextLang] || DEFAULT_CODE.python);
    setLanguage(nextLang);
    setCode(nextCode);
    setResult(null);
    setError(null);
    setDiagnostics([]);
    if (submissionsByQuestion[q.id]) {
      const qType = String(q.question_type || 'coding').toLowerCase();
      if (qType === 'mcq') {
        setSubmitSuccess('Already submitted.');
      } else {
        setSubmitSuccess(`Already submitted. Score: ${submissionsByQuestion[q.id].score ?? 0}%`);
      }
    } else {
      setSubmitSuccess(null);
    }
  }, [currentQuestionIndex, questions, languageByQuestionId, codeByQuestionId, allowedLanguages, submissionsByQuestion]);

  useEffect(() => {
    const preventBackspaceNavigation = (event) => {
      if (event.key !== 'Backspace') return;
      const target = event.target;
      const isEditable = !!(
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      );
      if (!isEditable) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', preventBackspaceNavigation);
    return () => window.removeEventListener('keydown', preventBackspaceNavigation);
  }, []);

  const handleLanguageChange = (nextValue) => {
    if (!currentQuestion) return;
    const nextLang = normalizeLanguage(nextValue);
    setLanguage(nextLang);
    setLanguageByQuestionId((prev) => ({ ...prev, [currentQuestion.id]: nextLang }));

    // Always switch editor template to the selected language.
    // This prevents C template from sticking when user selects C++.
    const nextCode = DEFAULT_CODE[nextLang] || DEFAULT_CODE.python;
    setCode(nextCode);
    setCodeByQuestionId((prev) => ({ ...prev, [currentQuestion.id]: nextCode }));
    setResult(null);
    setError(null);
    setDiagnostics([]);
  };

  const handleCodeChange = (value) => {
    const next = value || '';
    setCode(next);
    if (currentQuestion?.id) {
      setCodeByQuestionId((prev) => ({ ...prev, [currentQuestion.id]: next }));
    }
  };

  const handleMcqSelect = (questionId, optionIndex) => {
    if (!questionId) return;
    setMcqAnswersByQuestionId((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const runCodeFor = async (question, codeText, lang, includeHidden = true) => {
    if (!question) return null;
    const safeLang = normalizeLanguage(lang);
    const tests = includeHidden
      ? (question.test_cases || [])
      : (question.test_cases || []).filter((tc) => !tc.is_hidden);

    const response = await api.executeCode(
      codeText,
      safeLang,
      tests,
      question.id,
      (question.time_limit_ms || 2000) / 1000,
      256000
    );

    const safeResponse = {
      ...response,
      compilation_time_ms: typeof response?.compilation_time_ms === 'number' ? response.compilation_time_ms : null,
      results: Array.isArray(response?.results) ? response.results : [],
      summary: response?.summary && typeof response.summary === 'object'
        ? response.summary
        : { score: 0, passed: 0, total: 0 },
    };
    setResult(safeResponse);
    const diagText = getErrorTextFromResponse(safeResponse);
    setDiagnostics(extractDiagnosticsFromText(diagText));
    return safeResponse;
  };

  const runCodeForAutoSubmit = async (question, codeText, lang) => {
    if (!question) return null;
    const safeLang = normalizeLanguage(lang);
    const tests = question.test_cases || [];
    const response = await api.executeCode(
      codeText,
      safeLang,
      tests,
      question.id,
      (question.time_limit_ms || 2000) / 1000,
      256000
    );
    return response;
  };

  const handleExecute = async () => {
    if (!currentQuestion || isLocked) return;
    if (String(currentQuestion.question_type || 'coding').toLowerCase() === 'mcq') return;
    shouldAutoScrollResultsRef.current = true;
    setIsExecuting(true);
    setError(null);
    setResult(null);
    setDiagnostics([]);
    setSubmitSuccess(null);
    try {
      await runCodeFor(currentQuestion, code, language, false);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentQuestion || isLocked) return;
    shouldAutoScrollResultsRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setDiagnostics([]);
    setSubmitSuccess(null);

    try {
      const qType = String(currentQuestion.question_type || 'coding').toLowerCase();
      if (qType === 'mcq') {
        const selected = mcqAnswersByQuestionId[currentQuestion.id];
        if (selected === undefined || selected === null) {
          setError('Please select an option before submitting.');
          setIsSubmitting(false);
          return;
        }
        await api.submitSolution({
          question_id: currentQuestion.id,
          test_id: test.id,
          selected_option: selected,
          auto_submit: false,
          submitted_at: new Date().toISOString(),
        });
        const submission = {
          question_id: currentQuestion.id,
          selected_option: selected,
          submitted_at: new Date().toISOString(),
          question_type: 'mcq',
        };
        setSubmissionsByQuestion((prev) => ({ ...prev, [currentQuestion.id]: submission }));
        setSubmitSuccess('Submitted successfully!');
      } else {
        const safeLang = normalizeLanguage(language);
        const safeResponse = await runCodeFor(currentQuestion, code, safeLang, true);
        if (!safeResponse) return;
        const passedCount = safeResponse.summary?.passed ?? 0;
        const totalCount = safeResponse.summary?.total ?? 0;
        const computedScore = computeWeightedCodingScore(currentQuestion, safeResponse);
        const executionTimeMs = Array.isArray(safeResponse.results)
          ? safeResponse.results.reduce((sum, r) => sum + (Number(r?.time_ms) || 0), 0)
          : null;

        await api.submitSolution({
          question_id: currentQuestion.id,
          test_id: test.id,
          language: safeLang,
          code,
          score: computedScore,
          passed: passedCount,
          total: totalCount,
          auto_submit: false,
          execution_time_ms: executionTimeMs,
          compilation_time_ms: safeResponse.compilation_time_ms,
          submitted_at: new Date().toISOString(),
        });

        const submission = {
          question_id: currentQuestion.id,
          language: safeLang,
          code,
          score: computedScore,
          passed: passedCount,
          total: totalCount,
          execution_time_ms: executionTimeMs,
          compilation_time_ms: safeResponse.compilation_time_ms,
          submitted_at: new Date().toISOString(),
        };

        setSubmissionsByQuestion((prev) => ({ ...prev, [currentQuestion.id]: submission }));
        setSubmitSuccess(`Submitted successfully! Score: ${computedScore}%`);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndTest = async () => {
    if (endSubmitting) return;
    setEndSubmitting(true);
    setError(null);
    try {
      for (const q of questions) {
        if (submissionsByQuestion[q.id]) continue;
        const qType = String(q.question_type || 'coding').toLowerCase();
        if (qType === 'mcq') {
          const selected = mcqAnswersByQuestionId[q.id];
          await api.submitSolution({
            question_id: q.id,
            test_id: test.id,
            selected_option: selected ?? null,
            auto_submit: true,
            submitted_at: new Date().toISOString(),
          });
          setSubmissionsByQuestion((prev) => ({
            ...prev,
            [q.id]: {
              question_id: q.id,
              selected_option: selected ?? null,
              submitted_at: new Date().toISOString(),
              question_type: 'mcq',
              auto_submit: true,
            }
          }));
        } else {
          const lang = normalizeLanguage(languageByQuestionId[q.id] || allowedLanguages[0] || 'python');
          const codeText = codeByQuestionId[q.id] ?? (DEFAULT_CODE[lang] || DEFAULT_CODE.python);
          const resp = await runCodeForAutoSubmit(q, codeText, lang);
          const summary = resp?.summary || { passed: 0, total: 0 };
          const passedCount = summary.passed ?? 0;
          const totalCount = summary.total ?? 0;
          const computedScore = computeWeightedCodingScore(q, resp);
          const executionTimeMs = Array.isArray(resp?.results)
            ? resp.results.reduce((sum, r) => sum + (Number(r?.time_ms) || 0), 0)
            : null;
          await api.submitSolution({
            question_id: q.id,
            test_id: test.id,
            language: lang,
            code: codeText,
            score: computedScore,
            passed: passedCount,
            total: totalCount,
            auto_submit: true,
            execution_time_ms: executionTimeMs,
            compilation_time_ms: resp?.compilation_time_ms ?? null,
            submitted_at: new Date().toISOString(),
          });
          setSubmissionsByQuestion((prev) => ({
            ...prev,
            [q.id]: {
              question_id: q.id,
              language: lang,
              code: codeText,
              score: computedScore,
              passed: passedCount,
              total: totalCount,
              execution_time_ms: executionTimeMs,
              compilation_time_ms: resp?.compilation_time_ms ?? null,
              submitted_at: new Date().toISOString(),
              auto_submit: true,
            }
          }));
        }
      }
      const submitResp = await api.submitTestAttempt(test.id);
      setTestSubmitted(true);
      setFinalMessage(submitResp?.message || 'Your test response has been recorded. See you soon.');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setEndSubmitting(false);
    }
  };

  const triggerForfeit = async (count) => {
    if (forfeitInFlightRef.current || forfeited) return;
    forfeitInFlightRef.current = true;
    setForfeited(true);
    setForfeitMessage('Test forfeited due to excessive tab switching.');
    try {
      await api.forfeitTestAttempt(test.id, count);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      forfeitInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!test?.id || !tabSwitchEnabled) return;
    const onSwitch = () => {
      if (forfeited) return;
      const now = Date.now();
      if (now - lastSwitchRef.current < 800) return;
      lastSwitchRef.current = now;
      setTabSwitches((prev) => {
        const next = prev + 1;
        void api.logTabSwitch(test.id, next, new Date().toISOString()).catch(() => {});
        if (next > tabSwitchLimit) void triggerForfeit(next);
        return next;
      });
    };

    const handleVisibility = () => {
      if (document.hidden) onSwitch();
    };

    const handleBlur = () => onSwitch();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [test?.id, tabSwitchEnabled, tabSwitchLimit, forfeited]);

  const recordPaste = () => {
    if (!test?.id) return;
    setPasteCount((prev) => {
      const next = prev + 1;
      void api.logPaste(test.id, next, new Date().toISOString()).catch(() => {});
      return next;
    });
  };

  const handlePasteDetected = () => recordPaste();

  const handlePasteBlocked = () => {
    if (!pasteDisabled) return;
    setPasteWarning('Pasting is disabled during the test.');
    if (pasteWarningTimerRef.current) clearTimeout(pasteWarningTimerRef.current);
    pasteWarningTimerRef.current = setTimeout(() => {
      setPasteWarning(null);
      pasteWarningTimerRef.current = null;
    }, 2000);
  };

  useEffect(() => () => {
    if (pasteWarningTimerRef.current) clearTimeout(pasteWarningTimerRef.current);
  }, []);

  useEffect(() => {
    if (!timeUp || autoSubmitRef.current || forfeited || !Array.isArray(questions) || questions.length === 0) return;
    autoSubmitRef.current = true;
    void handleEndTest();
  }, [timeUp, forfeited, questions]);

  if (testSubmitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, textAlign: 'center' }}>
          <CheckCircle size={44} color="#16a34a" style={{ margin: '0 auto 10px' }} />
          <h2 style={{ margin: '0 0 8px', color: '#0f172a' }}>Submission Complete</h2>
          <p style={{ margin: 0, color: '#334155', fontSize: 15 }}>
            {finalMessage || 'Your test response has been recorded. See you soon.'}
          </p>
          <div style={{ marginTop: 16 }}>
            <button onClick={onBack} style={{ background: '#0f172a', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', fontWeight: 700 }}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingQuestions) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>Loading questions...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, maxWidth: 420, textAlign: 'center' }}>
          <AlertCircle size={42} color="#ef4444" style={{ margin: '0 auto 10px' }} />
          <h2 style={{ margin: '0 0 8px' }}>Failed to Load Test</h2>
          <p style={{ color: '#475569' }}>{loadError}</p>
          <button onClick={onBack} style={{ background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, maxWidth: 420, textAlign: 'center' }}>
          <BookOpen size={42} color="#64748b" style={{ margin: '0 auto 10px' }} />
          <h2 style={{ margin: '0 0 8px' }}>No Questions Found</h2>
          <button onClick={onBack} style={{ background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const diffStyle = getDifficultyStyle(currentQuestion.difficulty);
  const isMcq = String(currentQuestion?.question_type || 'coding').toLowerCase() === 'mcq';

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: "'Sora', 'Segoe UI', sans-serif", color: '#1f2937' }}>
      <div style={{ height: 64, background: '#fff', borderBottom: '1px solid #d1d5db', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <button onClick={onBack} style={{ background: '#eef2f7', border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 12px', color: '#6b7280', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={14} /> Back
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'lowercase' }}>{test?.title}</div>
            <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} /> {test?.duration_minutes || 60} mins
            </div>
          </div>
        </div>
        <button style={{ width: 28, height: 28, borderRadius: 7, border: 0, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700 }}>{currentQuestionIndex + 1}</button>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          {timeLeft !== null && (
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, background: '#f8fafc', color: '#1f2937', fontSize: 28, fontWeight: 700, padding: '6px 10px', minWidth: 90, textAlign: 'center', lineHeight: 1 }}>
              {formatTime(timeLeft)}
            </div>
          )}
          {!isMcq && (
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isBusy}
              style={{ background: '#f8fafc', color: '#1f2937', border: '1px solid #cbd5e1', borderRadius: 10, padding: '8px 10px', fontSize: 16 }}
            >
              {allowedLanguages.map((lang) => <option key={lang} value={lang}>{LANGUAGE_LABELS[lang] || lang}</option>)}
            </select>
          )}
          {!isMcq && (
            <button onClick={handleExecute} disabled={isBusy} style={{ background: '#ef4444', color: '#fff', border: 0, borderRadius: 10, padding: '8px 14px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Play size={14} /> Run
            </button>
          )}
          <button onClick={handleSubmit} disabled={isBusy} style={{ background: '#111827', color: '#fff', border: 0, borderRadius: 10, padding: '8px 14px', fontSize: 16, fontWeight: 700 }}>
            Submit
          </button>
          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={endSubmitting}
            style={{ background: '#0f172a', color: '#fff', border: 0, borderRadius: 10, padding: '8px 14px', fontSize: 16, fontWeight: 700 }}
          >
            {endSubmitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, padding: 14, minHeight: 'calc(100vh - 64px)' }}>
        <div style={{ width: '36%', minWidth: 340, border: '1px solid #d1d5db', borderRadius: 12, background: '#f6f7fa', padding: '22px 24px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>Question {currentQuestionIndex + 1} / {questions.length}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))} disabled={currentQuestionIndex === 0} style={{ border: '1px solid #d1d5db', borderRadius: 10, background: '#eceff3', padding: '6px 9px', color: '#9ca3af' }}><ChevronLeft size={14} /></button>
              <button onClick={() => setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={currentQuestionIndex === questions.length - 1} style={{ border: '1px solid #d1d5db', borderRadius: 10, background: '#eceff3', padding: '6px 9px', color: '#9ca3af' }}><ChevronRight size={14} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {currentQuestion?.difficulty && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: diffStyle.bg, color: diffStyle.color }}>{(currentQuestion.difficulty || '').toUpperCase()}</span>}
            {currentQuestion?.topic && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#dbeafe', color: '#3b82f6' }}>{currentQuestion.topic}</span>}
            {currentQuestion?.points && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#fee2e2', color: '#ef4444' }}>{currentQuestion.points} pts</span>}
          </div>

          <h2 style={{ color: '#111827', fontSize: 32, fontWeight: 700, marginBottom: 12, textTransform: 'lowercase' }}>{currentQuestion?.title}</h2>
          <div style={{ color: '#94a3b8', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Task</div>
          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.55, marginBottom: 18, whiteSpace: 'pre-wrap' }}>{currentQuestion?.description}</p>
          {currentQuestion?.image_url && (
            <div style={{ marginBottom: 16 }}>
              <img
                src={currentQuestion.image_url}
                alt="Question visual"
                style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, border: '1px solid #dbe3ef', background: '#fff' }}
              />
            </div>
          )}
          {isMcq && (
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff7ed', color: '#9a3412', fontSize: 12, fontWeight: 600 }}>
              {currentQuestion?.mcq_negative_enabled
                ? `Negative marking enabled: -${currentQuestion?.mcq_negative_marks || 0} point(s) for wrong answer.`
                : 'No negative marking for this MCQ.'}
            </div>
          )}
          {!isMcq && test?.negative_marking_enabled && (
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff7ed', color: '#9a3412', fontSize: 12, fontWeight: 600 }}>
              Negative marking enabled: -{test?.negative_marking_marks || 0} point(s) for wrong submissions.
            </div>
          )}

          {!isMcq && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#94a3b8', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Allowed Languages</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {allowedLanguages.map((lang) => (
                  <span key={lang} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: language === lang ? '#3b82f6' : '#e5e7eb', color: language === lang ? '#fff' : '#1e40af', border: '1px solid #d1d5db' }}>
                    {LANGUAGE_LABELS[lang] || lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!isMcq && Array.isArray(currentQuestion?.test_cases) && currentQuestion.test_cases.filter((tc) => !tc.is_hidden).length > 0 && (
            <>
              <div style={{ color: '#111827', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Sample Test Cases</div>
              {currentQuestion.test_cases.filter((tc) => !tc.is_hidden).map((tc, idx) => (
                <div key={tc.id ?? idx} style={{ marginBottom: 14, border: '1px solid #dbe3ef', borderRadius: 10, padding: '10px 12px', background: '#f8fafc' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Example {idx + 1} <span style={{ color: '#64748b', fontSize: 12 }}>({tc.points || 1} marks)</span>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #dbe3ef', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 2 }}>Input:</div>
                    <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 13 }}>{tc.input || '(empty)'}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #dbe3ef', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 2 }}>Output:</div>
                    <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 13 }}>{tc.expected_output}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, border: '1px solid #d1d5db', borderRadius: 12, background: '#f8fafc', padding: 14, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 280, borderRadius: 10, overflow: 'hidden' }}>
            {isMcq ? (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px', height: '100%' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Choose the correct answer</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(currentQuestion?.mcq_options || []).map((opt, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: isLocked ? 'not-allowed' : 'pointer' }}>
                      <input
                        type="radio"
                        disabled={isLocked}
                        checked={mcqAnswersByQuestionId[currentQuestion.id] === idx}
                        onChange={() => handleMcqSelect(currentQuestion.id, idx)}
                      />
                      <span style={{ color: '#111827', fontSize: 14 }}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <CodeEditor
                code={code}
                onChange={handleCodeChange}
                language={language}
                readOnly={isBusy}
                disablePaste={pasteDisabled}
                onPasteBlocked={handlePasteBlocked}
                onPasteDetected={handlePasteDetected}
                diagnostics={diagnostics}
              />
            )}
          </div>

          {(result || error || submitSuccess || forfeitMessage || pasteWarning || timeUp) && (
            <div ref={resultPanelRef} style={{ marginTop: 10, maxHeight: '40vh', minHeight: 140, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 10, background: '#fff', padding: '14px 18px' }}>
              {pasteWarning && <div style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', borderRadius: 10, padding: 10, marginBottom: 10 }}>{pasteWarning}</div>}
              {forfeitMessage && <div style={{ border: '1px solid #fca5a5', background: '#fff1f2', color: '#be123c', borderRadius: 10, padding: 10, marginBottom: 10 }}>{forfeitMessage}</div>}
              {submitSuccess && <div style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d', borderRadius: 10, padding: 10, marginBottom: 10 }}>{submitSuccess}</div>}
              {timeUp && !error && <div style={{ border: '1px solid #fca5a5', background: '#fff1f2', color: '#be123c', borderRadius: 10, padding: 10, marginBottom: 10 }}>The test duration has ended.</div>}
              {error && <div style={{ border: '1px solid #fca5a5', background: '#fff1f2', color: '#be123c', borderRadius: 10, padding: 10, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{error}</div>}

              {!isMcq && result && (
                <div>
                  {getExecutionTimeSeconds(result) !== null && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                      Execution Time: {getExecutionTimeSeconds(result)}s
                    </div>
                  )}
                  {result.compilation_error && (
                    <div style={{ border: '1px solid #0f172a', background: '#0b1220', borderRadius: 12, padding: '12px 14px', marginBottom: 12, color: '#e2e8f0' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#f97316' }}>Compilation Error</div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, color: '#e2e8f0' }}>
                        {result.compilation_error}
                      </pre>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 12, color: '#1d4ed8', marginBottom: 4 }}>Score</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1f2937' }}>{result.summary.score}%</div>
                    </div>
                    <div style={{ flex: 1, border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 12, color: '#15803d', marginBottom: 4 }}>Passed</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1f2937' }}>{result.summary.passed}/{result.summary.total}</div>
                    </div>
                  </div>

                  {Array.isArray(result.results) && result.results.map((testResult, idx) => {
                    const vs = getVerdictStyle(testResult || {});
                    const verdictLabel = testResult?.passed ? 'Test Case' : 'Test Case (Failed)';
                    return (
                      <div key={testResult?.id ?? idx} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 10px', marginBottom: 8, background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, color: '#334155' }}>{verdictLabel} {idx + 1}</span>
                          <span style={{ color: vs.color, fontWeight: 700 }}>{vs.label}</span>
                        </div>
                        {testResult?.error && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#be123c', fontFamily: 'monospace', fontSize: 12 }}>{testResult.error}</pre>}
                        {testResult?.stdout && !testResult?.is_hidden && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{testResult.stdout}</pre>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEndConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '16px',
          }}
          onClick={() => setShowEndConfirm(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 18px 50px rgba(0,0,0,0.2)',
              padding: '18px 20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>Submit Test Now?</div>
            <div style={{ fontSize: '13px', color: '#475569', marginBottom: '14px' }}>
              All unanswered questions will be auto-submitted, then your test will be finalized.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                No
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); handleEndTest(); }}
                style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Yes, Submit Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TestAttempt;
