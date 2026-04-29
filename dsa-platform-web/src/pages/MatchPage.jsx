import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import TestAttempt from "../components/TestAttempt";
import api from "../services/api";

const INSTRUCTION_SECONDS = 60;

function formatCountdown(sec) {
  const total = Math.max(0, Number(sec) || 0);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported by this browser."));
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
      () => reject(new Error("Location permission is required for this geofenced test.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function TestInstructionsGate({ test, onBegin, onBack }) {
  const [secondsLeft, setSecondsLeft] = useState(INSTRUCTION_SECONDS);
  const [startedAtMs, setStartedAtMs] = useState(null);
  const [agree, setAgree] = useState(false);
  const [rollNumber, setRollNumber] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const storageKey = test?.id ? `pretest_instruction_${test.id}` : null;

  useEffect(() => {
    if (!test?.id || !storageKey) return;
    const storedRaw = sessionStorage.getItem(storageKey);
    const stored = storedRaw ? Number(storedRaw) : NaN;
    const now = Date.now();
    const startMs = Number.isFinite(stored) ? stored : now;
    setStartedAtMs(startMs);
    if (!Number.isFinite(stored)) sessionStorage.setItem(storageKey, String(startMs));
  }, [test?.id, storageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.roll_number) setRollNumber(String(saved.roll_number));
    } catch {
      // ignore local parsing errors
    }
  }, []);

  useEffect(() => {
    if (!startedAtMs) return;
    const update = () => {
      const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
      const remaining = Math.max(0, INSTRUCTION_SECONDS - elapsedSec);
      setSecondsLeft(remaining);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAtMs]);

  const handleBegin = async () => {
    setLocationError("");
    let location = null;
    if (test?.geo_fencing_enabled) {
      try {
        setLocationLoading(true);
        location = await getBrowserLocation();
      } catch (err) {
        setLocationError(err?.message || "Could not verify your location.");
        return;
      } finally {
        setLocationLoading(false);
      }
    }
    if (storageKey) sessionStorage.removeItem(storageKey);
    onBegin(rollNumber, location);
  };

  return (
    <div className="mx-root">
      <style>{`
        .mx-root { min-height: calc(100vh - 64px); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .mx-card { width: 100%; max-width: 780px; border-radius: 18px; background: #fff; border: 1px solid var(--sc-border); box-shadow: var(--sc-shadow); padding: 22px; }
        .mx-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .mx-sub { color: var(--sc-text-muted); font-size: 13px; margin-top: 4px; }
        .mx-timer { min-width: 96px; border-radius: 12px; border: 1px solid #fecaca; background: #fff1f2; text-align: center; padding: 8px; }
        .mx-grid { margin-top: 12px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .mx-box { border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; padding: 10px; }
        .mx-rules { margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #fff; }
        .mx-rules ul { padding-left: 18px; margin-top: 8px; color: #475569; font-size: 13px; line-height: 1.6; }
        .mx-actions { display: flex; gap: 8px; margin-top: 14px; }
        .mx-btn { border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 700; }
        .mx-btn.ghost { border: 1px solid #dbe3ef; background: #fff; color: #334155; }
        .mx-btn.primary { border: none; background: linear-gradient(120deg, var(--sc-primary), var(--sc-primary-strong)); color: #fff; }
        @media (max-width: 760px) { .mx-grid { grid-template-columns: 1fr; } .mx-head { flex-direction: column; } .mx-timer { width: 100%; } }
      `}</style>

      <div className="mx-card">
        <div className="mx-head">
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 700 }}>Pre-Test Instructions</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--sc-text-strong)" }}>{test.title}</div>
            <div className="mx-sub">Read instructions carefully. The test starts automatically after countdown.</div>
          </div>
          <div className="mx-timer">
            <div style={{ fontSize: 10, color: "#9f1239", textTransform: "uppercase", fontWeight: 700 }}>Starts In</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#be123c" }}>{formatCountdown(secondsLeft)}</div>
          </div>
        </div>

        <div className="mx-grid">
          <div className="mx-box"><div style={{ fontSize: 11, color: "#64748b" }}>Duration</div><div style={{ fontWeight: 700 }}>{test.duration_minutes || 60} min</div></div>
          <div className="mx-box"><div style={{ fontSize: 11, color: "#64748b" }}>Languages</div><div style={{ fontWeight: 700 }}>{(test.allowed_languages || []).map((l) => (l === "cpp" ? "C++" : l.toUpperCase())).join(", ") || "Python"}</div></div>
          <div className="mx-box"><div style={{ fontSize: 11, color: "#64748b" }}>Mode</div><div style={{ fontWeight: 700 }}>{test.test_type === "public" ? "Public" : "Invite Only"}</div></div>
        </div>

        <div className="mx-rules">
          <div style={{ fontWeight: 700, color: "var(--sc-text-strong)" }}>Important Rules</div>
          <ul>
            <li>Do not switch tabs/windows during the test.</li>
            <li>Copy/paste can be restricted based on teacher settings.</li>
            <li>Each question can be submitted only once.</li>
            <li>Timer starts when the test opens and cannot be paused.</li>
            <li>Your university roll number is mandatory before the test starts.</li>
            {test?.geo_fencing_enabled && <li>This test can only be started from the teacher-approved campus location.</li>}
            <li>Stable internet connection is strongly recommended.</li>
          </ul>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "#475569" }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          I have read and understood the instructions.
        </label>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 6 }}>University Roll Number</div>
          <input
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            placeholder="Enter your university roll number"
            style={{
              width: "100%",
              border: "1px solid #dbe3ef",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        {test?.geo_fencing_enabled && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 700 }}>
            Location verification is enabled. Your browser will ask for location permission before the test starts.
          </div>
        )}
        {locationError && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c", fontSize: 12, fontWeight: 700 }}>
            {locationError}
          </div>
        )}

        <div className="mx-actions">
          <button className="mx-btn ghost" onClick={onBack}>Back</button>
          <button
            className="mx-btn primary"
            onClick={handleBegin}
            disabled={!agree || !rollNumber.trim() || secondsLeft > 0 || locationLoading}
            style={{ opacity: !agree || !rollNumber.trim() || secondsLeft > 0 || locationLoading ? 0.6 : 1 }}
          >
            {locationLoading ? "Verifying Location..." : "Start Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MatchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const testFromState = location.state?.test;
  const codeFromQuery = searchParams.get("code") || searchParams.get("test") || searchParams.get("uid");
  const lookupCode = params.code || codeFromQuery;

  const [linkedTest, setLinkedTest] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [canBegin, setCanBegin] = useState(false);
  const [entryRollNumber, setEntryRollNumber] = useState("");
  const [entryLocation, setEntryLocation] = useState(null);

  useEffect(() => {
    let ignore = false;
    const runLookup = async () => {
      if (!lookupCode || testFromState) return;
      setLinkLoading(true);
      setLinkError("");
      try {
        const found = await api.getTestByCode(lookupCode);
        if (!ignore) setLinkedTest(found);
      } catch (err) {
        if (!ignore) {
          setLinkError(err?.response?.status === 404 ? "No test found for that link or code." : "Could not load the test. Please try again.");
        }
      } finally {
        if (!ignore) setLinkLoading(false);
      }
    };
    runLookup();
    return () => {
      ignore = true;
    };
  }, [lookupCode, testFromState]);

  const handleManualLookup = async () => {
    const code = manualCode.trim();
    if (!code) return;
    setLinkLoading(true);
    setLinkError("");
    try {
      const found = await api.getTestByCode(code);
      setLinkedTest(found);
    } catch (err) {
      setLinkError(err?.response?.status === 404 ? "No test found for that link or code." : "Could not load the test. Please try again.");
    } finally {
      setLinkLoading(false);
    }
  };

  const resolvedTest = testFromState || linkedTest;
  useEffect(() => {
    if (!resolvedTest?.id) {
      setCanBegin(false);
      return;
    }
    const startedKey = `pretest_started_${resolvedTest.id}`;
    setCanBegin(sessionStorage.getItem(startedKey) === "1");
  }, [resolvedTest?.id]);

  if (resolvedTest && canBegin) {
    return <TestAttempt test={resolvedTest} entryRollNumber={entryRollNumber} entryLocation={entryLocation} onBack={() => navigate("/")} />;
  }

  if (resolvedTest && !canBegin) {
    return (
      <TestInstructionsGate
        test={resolvedTest}
        onBegin={(roll, location) => {
          setEntryRollNumber((roll || "").trim());
          setEntryLocation(location || null);
          if (roll && String(roll).trim()) {
            api.updateMyRollNumber(String(roll).trim()).catch(() => {});
            try {
              const raw = localStorage.getItem("user");
              if (raw) {
                const parsed = JSON.parse(raw);
                parsed.roll_number = String(roll).trim();
                localStorage.setItem("user", JSON.stringify(parsed));
              }
            } catch {
              // ignore
            }
          }
          sessionStorage.setItem(`pretest_started_${resolvedTest.id}`, "1");
          setCanBegin(true);
        }}
        onBack={() => {
          sessionStorage.removeItem(`pretest_instruction_${resolvedTest.id}`);
          sessionStorage.removeItem(`pretest_started_${resolvedTest.id}`);
          navigate("/");
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 540, border: "1px solid var(--sc-border)", borderRadius: 18, background: "#fff", boxShadow: "var(--sc-shadow)", padding: 24 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--sc-text-strong)", marginBottom: 6 }}>Assignment Match</div>
        <div style={{ color: "var(--sc-text-muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          Enter the test code or pasted link code to open the official teacher-created test.
        </div>

        <input
          style={{ width: "100%", border: "1px solid #dbe3ef", borderRadius: 12, padding: "11px 13px", fontSize: 14, outline: "none", marginBottom: 10 }}
          placeholder="Enter test code or UID"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px 12px", color: "#fff", fontWeight: 700, background: "linear-gradient(120deg, var(--sc-primary), var(--sc-primary-strong))" }}
            onClick={handleManualLookup}
            disabled={linkLoading}
          >
            {linkLoading ? "Loading..." : "Start Test"}
          </button>
          <button
            style={{ border: "1px solid #dbe3ef", borderRadius: 10, padding: "10px 12px", background: "#fff", color: "#334155", fontWeight: 700 }}
            onClick={() => navigate("/")}
          >
            Back
          </button>
        </div>

        {linkError && <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c", fontSize: 13 }}>{linkError}</div>}
      </div>
    </div>
  );
}
