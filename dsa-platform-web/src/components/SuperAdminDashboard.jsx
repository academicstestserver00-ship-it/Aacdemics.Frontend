import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../services/api";
import TeacherDashboard from "./TeacherDashboard";

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

function hasPermission(role, permission) {
  const normalized = normalizeRole(role);
  const map = {
    [ROLE_ROOT_SUPERADMIN]: new Set([
      "assign_teacher",
      "revoke_teacher",
      "create_test",
      "attempt_test",
      "assign_root_superadmin",
      "revoke_root_superadmin",
      "assign_superadmin",
      "revoke_superadmin",
      "view_all_tests",
      "get_all_test_records",
      "get_teacher_test_mapping",
    ]),
    [ROLE_SUPERADMIN]: new Set(["assign_teacher", "revoke_teacher", "create_test", "attempt_test"]),
    [ROLE_TEACHER]: new Set(["create_test", "attempt_test"]),
    [ROLE_STUDENT]: new Set(["attempt_test"]),
  };
  return map[normalized]?.has(permission) || false;
}

function isRootRole(role) {
  return normalizeRole(role) === ROLE_ROOT_SUPERADMIN;
}

const PRIMARY_ROOT_FLAG = "is_primary_root_superadmin";
const IST_TIMEZONE = "Asia/Kolkata";

const WORKSPACE_TABS = [
  { id: "admin", label: "Admin" },
  { id: "teacher", label: "Test Studio", permission: "create_test" },
];

const ROOT_ADMIN_TABS = [
  { id: "users", label: "Users" },
  { id: "tests", label: "Tests" },
  { id: "submissions", label: "Submissions" },
  { id: "analytics", label: "Analytics" },
];

function formatDateTime(iso) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return `${d.toLocaleString("en-IN", { timeZone: IST_TIMEZONE, hour12: true })} IST`;
}

function extractError(e, fallback) {
  return e?.response?.data?.detail || fallback;
}

function UsersAdminTab({ currentUser, isRoot }) {
  const currentRole = normalizeRole(currentUser?.role);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");

  const [targetEmail, setTargetEmail] = useState("");
  const [targetRole, setTargetRole] = useState("teacher");

  const loadUsers = async () => {
    if (!isRoot) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/api/admin/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(extractError(e, "Failed to load users."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [isRoot]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return [u.name, u.email, u.role].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [users, query]);

  const addTeacher = async () => {
    if (!addName.trim() || !addEmail.trim()) return;
    setError("");
    setSuccess("");
    try {
      const res = await apiClient.post("/api/admin/add-teacher", {
        name: addName.trim(),
        email: addEmail.trim(),
      });
      setSuccess(res.data?.message || "Teacher added successfully.");
      setAddName("");
      setAddEmail("");
      await loadUsers();
    } catch (e) {
      setError(extractError(e, "Failed to add teacher."));
    }
  };

  const updateRoleByEmail = async () => {
    if (!targetEmail.trim()) return;
    setError("");
    setSuccess("");
    try {
      const res = await apiClient.patch("/api/admin/users/role", {
        email: targetEmail.trim(),
        role: targetRole,
      });
      setSuccess(res.data?.message || `Role updated to ${targetRole}.`);
      setTargetEmail("");
      await loadUsers();
    } catch (e) {
      setError(extractError(e, "Failed to update role."));
    }
  };

  const runAction = async (path, okMessage) => {
    setError("");
    setSuccess("");
    try {
      const res = await apiClient.post(path);
      setSuccess(res.data?.message || okMessage);
      await loadUsers();
    } catch (e) {
      setError(extractError(e, "Action failed."));
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Delete this user?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await apiClient.delete(`/api/admin/users/${userId}`);
      setSuccess(res.data?.message || "User deleted.");
      await loadUsers();
    } catch (e) {
      setError(extractError(e, "Failed to delete user."));
    }
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>User Management</h2>
      <p style={styles.sectionSubtitle}>
        {isRoot
          ? "Manage all user roles, including root/superadmin governance."
          : "Manage teacher assignment and onboarding. Root-only role controls are hidden."}
      </p>

      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.grid3}>
          <input placeholder="Teacher name" value={addName} onChange={(e) => setAddName(e.target.value)} style={styles.input} />
          <input placeholder="Teacher email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} style={styles.input} />
          <button onClick={addTeacher} style={styles.btnPrimary}>Add Teacher</button>
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.grid3}>
          <input
            placeholder="User email"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            style={styles.input}
          />
          <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} style={styles.input}>
            <option value="teacher">Assign Teacher</option>
            <option value="student">Revoke Teacher (to Student)</option>
            {isRoot && <option value="superadmin">Assign Superadmin</option>}
            {isRoot && <option value="root_superadmin">Assign Root Superadmin</option>}
          </select>
          <button onClick={updateRoleByEmail} style={styles.btnBlue}>Apply By Email</button>
        </div>
      </div>

      {!isRoot && (
        <div style={styles.noteBox}>
          Superadmin mode: you can assign/revoke teacher and add teacher accounts. Full user list and root-level actions are available only to root superadmin.
        </div>
      )}

      {isRoot && (
        <div style={{ ...styles.card, marginBottom: 14 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name/email/role..."
            style={styles.input}
          />
        </div>
      )}

      {error && <div style={styles.alertError}>{error}</div>}
      {success && <div style={styles.alertSuccess}>{success}</div>}

      {isRoot && loading && <div style={styles.loading}>Loading users...</div>}

      {isRoot && !loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Name", "Email", "Role", "Primary", "Created", "Actions"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const role = normalizeRole(u.role);
                const isPrimaryRoot = Boolean(u?.[PRIMARY_ROOT_FLAG]);
                const isSelf = u.id === currentUser?.id;
                const disableRoleOps = isPrimaryRoot;

                return (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}>{u.name || "--"}</td>
                    <td style={styles.td}>{u.email || "--"}</td>
                    <td style={styles.td}>{role}</td>
                    <td style={styles.td}>{isPrimaryRoot ? "Yes" : "No"}</td>
                    <td style={styles.td}>{formatDateTime(u.created_at)}</td>
                    <td style={styles.td}>
                      <div style={styles.actionWrap}>
                        <button disabled={disableRoleOps || role === "teacher"} onClick={() => runAction(`/api/admin/users/${u.id}/assign-teacher`, "Teacher role assigned.")} style={styles.btnBlue}>Assign Teacher</button>
                        <button disabled={disableRoleOps || role === "student"} onClick={() => runAction(`/api/admin/users/${u.id}/revoke-teacher`, "Teacher role revoked.")} style={styles.btnGreen}>Revoke Teacher</button>
                        <button disabled={disableRoleOps || role === "superadmin"} onClick={() => runAction(`/api/admin/users/${u.id}/assign-superadmin`, "Superadmin role assigned.")} style={styles.btnPurple}>Assign Superadmin</button>
                        <button disabled={disableRoleOps || role !== "superadmin"} onClick={() => runAction(`/api/admin/users/${u.id}/revoke-superadmin`, "Superadmin role revoked.")} style={styles.btnPurpleAlt}>Revoke Superadmin</button>
                        <button disabled={disableRoleOps || role === "root_superadmin"} onClick={() => runAction(`/api/admin/users/${u.id}/assign-root-superadmin`, "Root superadmin role assigned.")} style={styles.btnGold}>Assign Root</button>
                        <button disabled={disableRoleOps || role !== "root_superadmin"} onClick={() => runAction(`/api/admin/users/${u.id}/revoke-root-superadmin`, "Root superadmin role revoked.")} style={styles.btnGoldAlt}>Revoke Root</button>
                        <button disabled={disableRoleOps || isSelf || currentRole !== "root_superadmin"} onClick={() => deleteUser(u.id)} style={styles.btnRed}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TestsOverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/api/admin/root/tests-overview");
        setData(res.data);
      } catch (e) {
        setError(extractError(e, "Failed to load tests overview."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={styles.loading}>Loading tests overview...</div>;
  if (error) return <div style={styles.alertError}>{error}</div>;

  return (
    <div>
      <h2 style={styles.sectionTitle}>Platform Test Overview</h2>
      <p style={styles.sectionSubtitle}>Root-only visibility of all tests, ownership, and activity.</p>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}><div style={styles.statNum}>{data?.totals?.tests ?? 0}</div><div style={styles.statLabel}>Total Tests</div></div>
        <div style={styles.statCard}><div style={styles.statNum}>{data?.totals?.teachers_with_tests ?? 0}</div><div style={styles.statLabel}>Teachers With Tests</div></div>
        <div style={styles.statCard}><div style={styles.statNum}>{data?.totals?.questions ?? 0}</div><div style={styles.statLabel}>Questions</div></div>
        <div style={styles.statCard}><div style={styles.statNum}>{data?.totals?.submissions ?? 0}</div><div style={styles.statLabel}>Submissions</div></div>
      </div>

      <div style={styles.card}>
        <div style={styles.tableTitle}>Teacher Summary</div>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Teacher", "Email", "Tests", "Questions", "Submissions"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.teachers || []).map((t) => (
                <tr key={t.teacher_id || t.teacher_email} style={styles.tr}>
                  <td style={styles.td}>{t.teacher_name}</td>
                  <td style={styles.td}>{t.teacher_email || "--"}</td>
                  <td style={styles.td}>{t.tests_created}</td>
                  <td style={styles.td}>{t.total_questions}</td>
                  <td style={styles.td}>{t.total_submissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SubmissionsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get("/api/admin/submissions?limit=200");
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setError(extractError(e, "Failed to load submissions."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={styles.loading}>Loading submissions...</div>;
  if (error) return <div style={styles.alertError}>{error}</div>;

  return (
    <div>
      <h2 style={styles.sectionTitle}>All Submissions</h2>
      <p style={styles.sectionSubtitle}>{rows.length} records found.</p>
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {["Student", "Email", "Question", "Language", "Score", "Passed", "Submitted"].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={styles.tr}>
                <td style={styles.td}>{r.student_name}</td>
                <td style={styles.td}>{r.student_email}</td>
                <td style={styles.td}>{r.question_title}</td>
                <td style={styles.td}>{r.language}</td>
                <td style={styles.td}>{r.score ?? 0}%</td>
                <td style={styles.td}>{r.passed ?? 0}/{r.total ?? 0}</td>
                <td style={styles.td}>{formatDateTime(r.submitted_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get("/api/admin/analytics");
        setData(res.data);
      } catch (e) {
        setError(extractError(e, "Failed to load analytics."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={styles.loading}>Loading analytics...</div>;
  if (error) return <div style={styles.alertError}>{error}</div>;

  const languages = Object.entries(data?.submissions?.by_language || {});

  return (
    <div>
      <h2 style={styles.sectionTitle}>Platform Analytics</h2>
      <p style={styles.sectionSubtitle}>Global platform statistics.</p>
      <div style={styles.statsGrid}>
        <div style={styles.statCard}><div style={styles.statNum}>{data?.users?.students ?? 0}</div><div style={styles.statLabel}>Students</div></div>
        <div style={styles.statCard}><div style={styles.statNum}>{data?.users?.teachers ?? 0}</div><div style={styles.statLabel}>Teachers</div></div>
        <div style={styles.statCard}><div style={styles.statNum}>{data?.users?.superadmins ?? 0}</div><div style={styles.statLabel}>Superadmins</div></div>
        <div style={styles.statCard}><div style={styles.statNum}>{data?.users?.root_superadmins ?? 0}</div><div style={styles.statLabel}>Root Superadmins</div></div>
      </div>

      <div style={{ ...styles.card, marginTop: 14 }}>
        <div style={styles.tableTitle}>Language Usage</div>
        {languages.length === 0 ? (
          <div style={styles.loading}>No language data yet.</div>
        ) : (
          <div style={styles.actionWrap}>
            {languages.map(([language, count]) => (
              <span key={language} style={styles.langBadge}>
                {(language || "N/A").toUpperCase()}: {count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminWorkspace({ user, isRoot }) {
  const [activeTab, setActiveTab] = useState("users");

  const tabs = isRoot ? ROOT_ADMIN_TABS : [{ id: "users", label: "Users" }];

  return (
    <div>
      <div style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ ...styles.tabBtn, ...(activeTab === tab.id ? styles.tabBtnActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.contentCard}>
        {activeTab === "users" && <UsersAdminTab currentUser={user} isRoot={isRoot} />}
        {isRoot && activeTab === "tests" && <TestsOverviewTab />}
        {isRoot && activeTab === "submissions" && <SubmissionsTab />}
        {isRoot && activeTab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}

export default function SuperAdminDashboard({ user }) {
  const role = normalizeRole(user?.role);
  const isRoot = isRootRole(role);
  const [workspace, setWorkspace] = useState("admin");

  const availableWorkspaces = WORKSPACE_TABS.filter((t) => !t.permission || hasPermission(role, t.permission));

  useEffect(() => {
    if (!availableWorkspaces.find((t) => t.id === workspace)) {
      setWorkspace("admin");
    }
  }, [workspace, availableWorkspaces]);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>{isRoot ? "Root Superadmin Panel" : "Superadmin Panel"}</div>
          <div style={styles.subtitle}>{user?.email}</div>
        </div>
      </div>

      <div style={styles.workspaceBar}>
        {availableWorkspaces.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setWorkspace(tab.id)}
            style={{ ...styles.workspaceBtn, ...(workspace === tab.id ? styles.workspaceBtnActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {workspace === "admin" && <AdminWorkspace user={user} isRoot={isRoot} />}
        {workspace === "teacher" && <TeacherDashboard />}
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#1e293b",
    fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    padding: "16px 24px",
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
  },
  title: { fontSize: 18, fontWeight: 800, color: "#1e293b" },
  subtitle: { fontSize: 13, color: "#64748b" },
  workspaceBar: {
    display: "flex",
    gap: 8,
    padding: "12px 24px",
    borderBottom: "1px solid #e2e8f0",
    background: "#fff",
    flexWrap: "wrap",
  },
  workspaceBtn: {
    padding: "9px 14px",
    border: "1px solid #dbe4f0",
    borderRadius: 8,
    background: "#fff",
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  workspaceBtnActive: {
    borderColor: "#2563eb",
    color: "#1d4ed8",
    background: "#eff6ff",
  },
  tabBar: {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid #e2e8f0",
    background: "#fff",
    padding: "0 14px",
  },
  tabBtn: {
    padding: "12px 14px",
    border: "none",
    borderBottom: "2px solid transparent",
    background: "transparent",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  tabBtnActive: {
    color: "#1e293b",
    borderBottom: "2px solid #2563eb",
  },
  content: {
    maxWidth: 1160,
    margin: "0 auto",
    padding: "24px",
  },
  contentCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  },
  sectionTitle: { margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#1e293b" },
  sectionSubtitle: { margin: "0 0 14px", fontSize: 14, color: "#64748b" },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 14,
  },
  noteBox: {
    marginBottom: 14,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 10,
    padding: "12px 14px",
    color: "#475569",
    fontSize: 14,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 10,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #dbe3ef",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
  },
  btnPrimary: {
    border: "none",
    borderRadius: 8,
    padding: "10px 14px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnBlue: {
    border: "1px solid #2563eb",
    borderRadius: 6,
    padding: "6px 10px",
    background: "#eff6ff",
    color: "#2563eb",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnGreen: {
    border: "1px solid #059669",
    borderRadius: 6,
    padding: "6px 10px",
    background: "#ecfdf5",
    color: "#059669",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnPurple: {
    border: "1px solid #7c3aed",
    borderRadius: 6,
    padding: "6px 10px",
    background: "#f5f3ff",
    color: "#6d28d9",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnPurpleAlt: {
    border: "1px solid #8b5cf6",
    borderRadius: 6,
    padding: "6px 10px",
    background: "#faf5ff",
    color: "#7c3aed",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnGold: {
    border: "1px solid #d97706",
    borderRadius: 6,
    padding: "6px 10px",
    background: "#fff7ed",
    color: "#b45309",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnGoldAlt: {
    border: "1px solid #f59e0b",
    borderRadius: 6,
    padding: "6px 10px",
    background: "#fffbeb",
    color: "#b45309",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnRed: {
    border: "1px solid #dc2626",
    borderRadius: 6,
    padding: "6px 10px",
    background: "#fff1f2",
    color: "#dc2626",
    fontWeight: 700,
    cursor: "pointer",
  },
  actionWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  langBadge: {
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "4px 10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 800,
  },
  tableTitle: { fontWeight: 700, marginBottom: 10 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#64748b",
    borderBottom: "1px solid #e2e8f0",
  },
  tr: { borderBottom: "1px solid #eef2f7" },
  td: { padding: "10px 12px", fontSize: 14, color: "#334155", verticalAlign: "top" },
  alertError: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 12,
    fontSize: 14,
  },
  alertSuccess: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 12,
    fontSize: 14,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 10,
    padding: 12,
  },
  statNum: { fontSize: 24, fontWeight: 800, color: "#1e293b" },
  statLabel: { fontSize: 12, color: "#64748b" },
  loading: { padding: "24px 0", color: "#64748b" },
};
