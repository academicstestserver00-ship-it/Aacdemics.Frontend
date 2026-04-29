import { useEffect, useState } from "react";
import axios from "axios";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import TeacherDashboard from "./components/TeacherDashboard";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import AuthPage from "./components/AuthPage";
import StudentDashboard from "./pages/StudentDashboard";
import PracticeProblems from "./pages/PracticeProblems";
import PracticeSolve from "./pages/PracticeSolve";
import MatchPage from "./pages/MatchPage";
import { getMe } from "./services/api";
import "./App.css";

const ROLE_ROOT_SUPERADMIN = "root_superadmin";
const ROLE_SUPERADMIN = "superadmin";
const ROLE_TEACHER = "teacher";
const ROLE_STUDENT = "student";

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if ([ROLE_ROOT_SUPERADMIN, ROLE_SUPERADMIN, ROLE_TEACHER, ROLE_STUDENT].includes(role)) return role;
  if (role === "admin") return ROLE_SUPERADMIN;
  if (role === "root") return ROLE_ROOT_SUPERADMIN;
  return ROLE_STUDENT;
}

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const ROLE_META = {
  root_superadmin: { label: "Root Superadmin", tone: "root" },
  superadmin: { label: "Superadmin", tone: "danger" },
  teacher: { label: "Teacher", tone: "success" },
  student: { label: "Student", tone: "primary" },
};

function TopBar({ user, onLogout }) {
  const normalizedRole = normalizeRole(user?.role);
  const meta = ROLE_META[normalizedRole] || ROLE_META.student;

  return (
    <header className="app-topbar">
      <div className="app-topbar-left">
        <img src="/academics-logo.png" alt="Academics logo" className="app-logo-mark" />
        <span className="app-brand">Academics</span>
        <span className={`app-role-chip tone-${meta.tone}`}>{meta.label}</span>
      </div>

      <div className="app-topbar-right">
        <span className="app-user-name">{user.name}</span>
        <button className="app-logout-btn" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </header>
  );
}

function PracticeRouter() {
  return (
    <Routes>
      <Route path=":language" element={<PracticeProblems />} />
      <Route path=":language/:pid" element={<PracticeSolve />} />
    </Routes>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return { ...parsed, role: normalizeRole(parsed?.role) };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let mounted = true;
    if (!token) return () => { mounted = false; };

    (async () => {
      try {
        const me = await getMe();
        if (!mounted) return;
        const normalized = { ...me, role: normalizeRole(me?.role) };
        setUser(normalized);
        localStorage.setItem("user", JSON.stringify(normalized));
      } catch {
        // keep local session as fallback; backend will enforce permissions anyway.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleLogin = (newToken, newUser) => {
    const normalized = { ...newUser, role: normalizeRole(newUser?.role) };
    setToken(newToken);
    setUser(normalized);
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(normalized));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  if (!token || !user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  const role = normalizeRole(user.role);

  if (role === "root_superadmin" || role === "superadmin") {
    return (
      <div className="app-shell">
        <TopBar user={user} onLogout={handleLogout} />
        <SuperAdminDashboard user={user} />
      </div>
    );
  }

  if (role === "teacher") {
    return (
      <div className="app-shell">
        <TopBar user={user} onLogout={handleLogout} />
        <TeacherDashboard />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <div className="app-shell">
              <TopBar user={user} onLogout={handleLogout} />
              <StudentDashboard />
            </div>
          }
        />
        <Route path="/test" element={<MatchPage />} />
        <Route path="/practice/*" element={<PracticeRouter />} />
        <Route path="/match" element={<MatchPage />} />
        <Route path="/match/:code" element={<MatchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
