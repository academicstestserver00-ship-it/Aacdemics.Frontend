import { useState } from 'react';
import axios from 'axios';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { API_BASE } from '../config';

const API_URL = API_BASE ? `${API_BASE}/api/auth` : '/api/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDeR0IoojnXn_JoFjSteB8o_1YBg7mCc3Y',
  authDomain: 'test-slashcoder-20a45.firebaseapp.com',
  projectId: 'test-slashcoder-20a45',
  databaseURL: 'https://test-slashcoder-20a45-default-rtdb.firebaseio.com',
};

if (!getApps().length) initializeApp(firebaseConfig);
const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

const theme = {
  pageBgA: '#f3e9ec',
  pageBgB: '#ffe8ef',
  shellBg: '#f8fafc',
  shellBorder: '#f3bac6',
  formSurface: '#ffffff',
  panelBlue: '#ffe4eb',
  panelBlueSoft: '#fff1f4',
  textStrong: '#1e293b',
  textMuted: '#64748b',
  border: '#dbe3ef',
  primary: '#ef4444',
  primaryHover: '#dc2626',
  dark: '#0f172a',
  ring: 'rgba(59,130,246,0.18)',
  inputBg: '#ffffff',
  font: "'Sora', 'DM Sans', system-ui, sans-serif",
};

const injectFontAndStyles = () => {
  if (document.getElementById('auth-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'auth-global-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }

    .auth-root {
      min-height: 100vh;
      background:
        radial-gradient(circle at 80% 92%, ${theme.pageBgB}, transparent 42%),
        radial-gradient(circle at 16% 18%, ${theme.pageBgA}, transparent 36%),
        #f5f7fb;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 22px;
      font-family: ${theme.font};
    }

    .auth-shell {
      width: 100%;
      max-width: 1240px;
      min-height: 760px;
      border-radius: 18px;
      background: ${theme.shellBg};
      border: 4px solid ${theme.shellBorder};
      box-shadow: 0 24px 66px rgba(59, 130, 246, 0.14);
      padding: 18px;
    }

    .auth-topline {
      text-align: center;
      margin: 4px 0 14px;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      letter-spacing: 0.02em;
    }

    .auth-content {
      display: grid;
      grid-template-columns: 1fr 0.95fr;
      gap: 18px;
      min-height: 680px;
    }

    .auth-left {
      background: ${theme.formSurface};
      border: 1px solid #edf2f9;
      border-radius: 16px;
      padding: 34px;
      display: flex;
      justify-content: center;
    }

    .auth-form-wrap {
      width: 100%;
      max-width: 430px;
      align-self: center;
    }

    .auth-small-grid {
      width: 240px;
      height: 70px;
      margin: 0 auto 18px;
      border-radius: 12px;
      opacity: 0.45;
      background-image:
        linear-gradient(to right, rgba(148,163,184,0.2) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px);
      background-size: 22px 22px;
      position: relative;
    }

    .auth-small-grid::before,
    .auth-small-grid::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 5px;
      background: rgba(59, 130, 246, 0.16);
    }

    .auth-small-grid::before { left: 20px; top: 14px; }
    .auth-small-grid::after { right: 28px; bottom: 10px; }

    .auth-icon-badge {
      width: 54px;
      height: 54px;
      border-radius: 14px;
      margin: 0 auto 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #111827, #000000);
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.34);
    }

    .auth-title {
      text-align: center;
      margin: 0;
      font-size: 34px;
      line-height: 1.08;
      color: ${theme.textStrong};
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .auth-subtitle {
      text-align: center;
      margin: 8px 0 24px;
      color: ${theme.textMuted};
      font-size: 13px;
      line-height: 1.5;
    }

    .auth-input {
      width: 100%;
      padding: 11px 13px;
      border-radius: 10px;
      border: 1.5px solid ${theme.border};
      background: ${theme.inputBg};
      color: ${theme.textStrong};
      font-size: 14px;
      outline: none;
      transition: border-color 0.18s, box-shadow 0.18s;
    }

    .auth-input::placeholder { color: #94a3b8; }

    .auth-input:focus {
      border-color: #60a5fa;
      box-shadow: 0 0 0 4px ${theme.ring};
    }

    .auth-label {
      display: block;
      margin-bottom: 7px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      letter-spacing: 0.02em;
    }

    .auth-field { margin-bottom: 14px; }

    .auth-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      gap: 10px;
      flex-wrap: wrap;
    }

    .auth-btn-primary {
      width: 100%;
      border: none;
      border-radius: 11px;
      padding: 12px;
      background: linear-gradient(120deg, #ef4444, #dc2626);
      color: #fff;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: transform 0.12s, box-shadow 0.2s, opacity 0.15s;
      box-shadow: 0 14px 24px rgba(239, 68, 68, 0.22);
    }

    .auth-btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 18px 30px rgba(239, 68, 68, 0.3);
      background: linear-gradient(120deg, #f43f5e, ${theme.primaryHover});
    }

    .auth-btn-primary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none;
    }

    .auth-btn-google {
      width: 100%;
      border-radius: 10px;
      border: 1.5px solid ${theme.border};
      background: #fff;
      padding: 11px 13px;
      color: ${theme.textStrong};
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: border-color 0.15s, background 0.15s;
    }

    .auth-btn-google:hover:not(:disabled) {
      border-color: #cbd5e1;
      background: #f8fafc;
    }

    .auth-btn-google:disabled {
      opacity: 0.58;
      cursor: not-allowed;
    }

    .auth-tabs {
      display: flex;
      border: 1px solid ${theme.border};
      border-radius: 10px;
      padding: 4px;
      gap: 4px;
      margin-bottom: 16px;
      background: #f8fbff;
    }

    .tab-btn {
      flex: 1;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      padding: 9px;
      font-size: 13px;
      font-weight: 600;
      transition: 0.15s;
    }

    .tab-btn.active {
      background: #fff;
      color: ${theme.dark};
      box-shadow: 0 5px 12px rgba(148,163,184,0.2);
    }

    .auth-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 14px 0;
    }

    .auth-divider-line {
      flex: 1;
      height: 1px;
      background: #e5edf7;
    }

    .auth-divider-text {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 700;
      text-transform: uppercase;
    }

    .auth-right {
      border-radius: 16px;
      background: linear-gradient(160deg, ${theme.panelBlueSoft}, ${theme.panelBlue});
      border: 1px solid #c7def6;
      padding: 28px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      position: relative;
    }

    .panel-title {
      text-align: center;
      color: ${theme.textStrong};
      font-size: 30px;
      font-weight: 800;
      margin: 0 0 10px;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }

    .panel-title span { color: #ef4444; }

    .orbit-wrap {
      width: 100%;
      max-width: 420px;
      height: 420px;
      margin: 0 auto;
      position: relative;
    }

    .orbit {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border: 1.5px solid rgba(148, 163, 184, 0.34);
      border-radius: 50%;
    }

    .orbit.o1 { width: 120px; height: 120px; }
    .orbit.o2 { width: 200px; height: 200px; }
    .orbit.o3 { width: 288px; height: 288px; }

    .core {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 90px;
      height: 90px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #111827, #000000);
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.34);
      border: 4px solid #e7f2ff;
    }

    .slash-logo {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10%;
      transform: scale(0.9);
    }

    .slash-logo .mid {
      width: 20%;
      height: 62%;
      border-radius: 5px;
      background: linear-gradient(180deg, #fb7185, #dc2626);
      transform: skewX(-18deg);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.62);
    }

    .slash-logo .side {
      width: 19%;
      height: 24%;
      border-radius: 5px;
      background: linear-gradient(180deg, #ef4444, #b91c1c);
    }

    .slash-logo.small {
      width: 36px;
      height: 36px;
      transform: scale(0.85);
    }

    .slash-logo.large {
      width: 54px;
      height: 54px;
      transform: scale(1);
    }

    .orbit-badge {
      position: absolute;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      border: 2px solid #fff;
      box-shadow: 0 12px 22px rgba(15, 23, 42, 0.16);
    }

    .b-py { left: 50%; top: 20px; transform: translateX(-50%); background: #3776ab; }
    .b-c { left: 62px; top: 148px; background: #5c6bc0; }
    .b-cpp { right: 56px; top: 150px; background: #3b82f6; }
    .b-java { left: 78px; bottom: 72px; background: #f97316; }
    .b-js { right: 90px; bottom: 56px; background: #eab308; color: #1f2937; }

    .panel-note {
      margin: 10px auto 0;
      max-width: 420px;
      text-align: center;
      color: #475569;
      font-size: 15px;
      line-height: 1.6;
    }

    .error-box {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      color: #be123c;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      margin-bottom: 14px;
    }

    .info-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      margin-bottom: 14px;
    }

    @media (max-width: 960px) {
      .auth-content {
        grid-template-columns: 1fr;
      }
      .auth-right { min-height: 520px; }
    }

    @media (max-width: 700px) {
      .auth-shell {
        padding: 12px;
        border-width: 2px;
      }
      .auth-left,
      .auth-right {
        padding: 18px;
      }
      .panel-title { font-size: 30px; }
      .panel-title { white-space: normal; }
      .auth-title { font-size: 28px; }
      .orbit-wrap {
        max-width: 330px;
        height: 330px;
      }
      .orbit.o1 { width: 96px; height: 96px; }
      .orbit.o2 { width: 156px; height: 156px; }
      .orbit.o3 { width: 230px; height: 230px; }
      .core {
        width: 74px;
        height: 74px;
      }
      .orbit-badge {
        width: 44px;
        height: 44px;
        font-size: 10px;
      }
      .b-c { left: 34px; top: 108px; }
      .b-cpp { right: 34px; top: 108px; }
      .b-java { left: 50px; bottom: 58px; }
      .b-js { right: 62px; bottom: 48px; }
    }
  `;
  document.head.appendChild(style);
};

function ErrorBox({ message }) {
  return <div className="error-box">{message}</div>;
}

function InfoBox({ message }) {
  return <div className="info-box">{message}</div>;
}

function FormField({ label, children }) {
  return (
    <div className="auth-field">
      <label className="auth-label">{label}</label>
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" />
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" />
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z" />
    </svg>
  );
}

function SlashCoderLogo({ size = 'small' }) {
  return (
    <div className={`slash-logo ${size}`}>
      <span className="side" />
      <span className="mid" />
      <span className="side" />
    </div>
  );
}

function OrbitLanguagePanel() {
  return (
    <>
      <h2 className="panel-title">CODE | <span>COMPETE</span> | CONQUER</h2>
      <div className="orbit-wrap">
        <div className="orbit o3" />
        <div className="orbit o2" />
        <div className="orbit o1" />
        <div className="core">
          <SlashCoderLogo size="large" />
        </div>

        <div className="orbit-badge b-py">PY</div>
        <div className="orbit-badge b-c">C</div>
        <div className="orbit-badge b-cpp">C++</div>
        <div className="orbit-badge b-java">JAVA</div>
        <div className="orbit-badge b-js">JS</div>
      </div>
      <p className="panel-note">
        Practice. Compete. Get Hired.
      </p>
    </>
  );
}

function AuthPage({ onLogin }) {
  injectFontAndStyles();

  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [registerStep, setRegisterStep] = useState('form');
  const [otp, setOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const update = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const response = await axios.post(`${API_URL}/login`, {
          email: formData.email,
          password: formData.password,
        });
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        onLogin(token, user);
        return;
      }

      if (registerStep === 'form') {
        await axios.post(`${API_URL}/register/start`, {
          name: formData.name,
          email: formData.email,
          password: formData.password,
        });
        setPendingEmail(formData.email);
        setRegisterStep('verify');
        setInfo(`We sent a 6-digit code to ${formData.email}. Enter it below to finish signup.`);
        return;
      }

      const response = await axios.post(`${API_URL}/register/verify`, {
        email: pendingEmail || formData.email,
        code: otp,
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(token, user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setInfo('');
    setResendLoading(true);
    try {
      await axios.post(`${API_URL}/register/start`, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
      setInfo(`A new code was sent to ${formData.email}.`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const id_token = await result.user.getIdToken();
      const res = await axios.post(`${API_URL}/google`, { id_token });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(token, user);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.response?.data?.detail || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const isVerifyStep = mode === 'register' && registerStep === 'verify';

  return (
    <div className="auth-root">
      <div className="auth-shell">
        <div className="auth-topline">SlashCoder - Skill First. Always.</div>
        <div className="auth-content">
          <div className="auth-left">
            <div className="auth-form-wrap">
              <div className="auth-small-grid" />

              <div className="auth-icon-badge">
                <SlashCoderLogo size="small" />
              </div>

              <h1 className="auth-title">{mode === 'login' ? 'Welcome Back, Coder' : 'Welcome Back, Coder'}</h1>
              <p className="auth-subtitle">
                {mode === 'login'
                  ? 'Enter your registered email address and password to login.'
                  : 'Create your SlashCoder account to start coding and competing.'}
              </p>

              <div className="auth-tabs">
                {['login', 'register'].map((m) => (
                  <button
                    key={m}
                    className={`tab-btn${mode === m ? ' active' : ''}`}
                    onClick={() => {
                      setMode(m);
                      setError('');
                      setInfo('');
                      setRegisterStep('form');
                      setOtp('');
                      setPendingEmail('');
                    }}
                  >
                    {m === 'login' ? 'Login' : 'Create Account'}
                  </button>
                ))}
              </div>

              {error && <ErrorBox message={error} />}
              {info && <InfoBox message={info} />}

              <form onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <FormField label="Full Name">
                    <input
                      className="auth-input"
                      type="text"
                      value={formData.name}
                      onChange={update('name')}
                      placeholder="John Doe"
                      required
                      disabled={registerStep === 'verify'}
                    />
                  </FormField>
                )}

                <FormField label="Email">
                  <input
                    className="auth-input"
                    type="email"
                    value={formData.email}
                    onChange={update('email')}
                    placeholder="Enter your email"
                    required
                    disabled={mode === 'register' && registerStep === 'verify'}
                  />
                </FormField>

                <FormField label="Password">
                  <input
                    className="auth-input"
                    type="password"
                    value={formData.password}
                    onChange={update('password')}
                    placeholder="Enter your password"
                    required
                    minLength={6}
                    disabled={mode === 'register' && registerStep === 'verify'}
                  />
                </FormField>

                {mode === 'register' && registerStep === 'verify' && (
                  <FormField label="Verification Code">
                    <input
                      className="auth-input"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                    />
                  </FormField>
                )}

                {mode === 'login' && (
                  <div className="auth-row">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ accentColor: '#ef4444', width: '14px', height: '14px' }}
                      />
                      Keep me signed in
                    </label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '12px', cursor: 'pointer', padding: 0 }}
                    >
                      Forgot your password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="auth-btn-primary"
                  disabled={loading || (isVerifyStep && otp.trim().length < 6)}
                >
                  {loading
                    ? mode === 'login'
                      ? 'Signing in...'
                      : isVerifyStep
                        ? 'Verifying...'
                        : 'Creating account...'
                    : mode === 'login'
                      ? 'Start Coding'
                      : isVerifyStep
                        ? 'Verify & Create Account'
                        : 'Create Account'}
                </button>

                {isVerifyStep && (
                  <div className="auth-row" style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendLoading || loading}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '12px', cursor: 'pointer', padding: 0 }}
                    >
                      {resendLoading ? 'Resending code...' : 'Resend code'}
                    </button>
                  </div>
                )}
              </form>

              <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">or continue with</span>
                <div className="auth-divider-line" />
              </div>

              <button className="auth-btn-google" onClick={handleGoogleLogin} disabled={googleLoading}>
                <GoogleIcon />
                {googleLoading ? 'Signing in...' : 'Continue with Google'}
              </button>
            </div>
          </div>

          <div className="auth-right">
            <OrbitLanguagePanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;


