import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      nav('/', { replace: true });
    } catch {
      setError('Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  const drops = Array.from({ length: 14 });

  return (
    <div className="go-login">
      <div className="go-bg-gradient" />
      <div className="go-bg-glow go-bg-glow-1" />
      <div className="go-bg-glow go-bg-glow-2" />
      <div className="go-bg-glow go-bg-glow-3" />

      <div className="go-drops" aria-hidden="true">
        {drops.map((_, i) => (
          <span
            key={i}
            className="go-drop"
            style={{
              left: `${(i * 7.3) % 100}%`,
              animationDelay: `${(i * 1.7) % 12}s`,
              animationDuration: `${10 + ((i * 1.3) % 9)}s`,
              transform: `scale(${0.6 + ((i * 0.13) % 1)})`,
              opacity: 0.35 + ((i * 0.07) % 0.5),
            }}
          />
        ))}
      </div>

      <form className="go-card" onSubmit={submit}>
        <div className="go-card-glow" />

        <div className="go-logo">
          <div className="go-logo-ring" />
          <div className="go-logo-pump">⛽</div>
        </div>

        <h1 className="go-title">Good Oil CRM</h1>
        <p className="go-subtitle">Вход для владельца</p>

        <label className="go-field">
          <span>Логин</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            placeholder="Введите логин"
          />
        </label>

        <label className="go-field">
          <span>Пароль</span>
          <div className="go-pwd-wrap">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="go-pwd-toggle"
              onClick={() => setShowPwd((s) => !s)}
              tabIndex={-1}
              aria-label="Показать пароль"
            >
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
        </label>

        {error && <div className="go-error">{error}</div>}

        <button type="submit" className="go-submit" disabled={loading}>
          <span className="go-submit-text">
            {loading ? 'Входим…' : 'Войти'}
          </span>
          <span className="go-submit-shimmer" />
        </button>

        <div className="go-foot">⚡ Powered by Zafar Zokirshoev</div>
      </form>

      <style>{loginCss}</style>
    </div>
  );
}

const loginCss = `
.go-login {
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 20px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  color: #fff;
}

.go-bg-gradient {
  position: absolute;
  inset: -10%;
  background:
    radial-gradient(ellipse at 20% 20%, #1a3d2e 0%, transparent 55%),
    radial-gradient(ellipse at 80% 30%, #2a1850 0%, transparent 55%),
    radial-gradient(ellipse at 50% 80%, #0a3a4a 0%, transparent 55%),
    linear-gradient(135deg, #0a0d18 0%, #0f1430 50%, #0a0d18 100%);
  background-size: 200% 200%;
  animation: go-bg-shift 18s ease-in-out infinite alternate;
  z-index: 0;
}

@keyframes go-bg-shift {
  0%   { background-position: 0% 0%, 100% 0%, 50% 100%, 0% 0%; }
  50%  { background-position: 30% 40%, 70% 60%, 40% 50%, 50% 50%; }
  100% { background-position: 100% 100%, 0% 100%, 60% 0%, 100% 100%; }
}

.go-bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.55;
  z-index: 1;
  pointer-events: none;
  animation: go-glow-float 14s ease-in-out infinite;
}
.go-bg-glow-1 {
  width: 420px; height: 420px;
  background: #4ade80;
  top: -120px; left: -100px;
  animation-delay: 0s;
}
.go-bg-glow-2 {
  width: 480px; height: 480px;
  background: #a855f7;
  bottom: -160px; right: -120px;
  animation-delay: -5s;
}
.go-bg-glow-3 {
  width: 360px; height: 360px;
  background: #38bdf8;
  top: 40%; left: 60%;
  animation-delay: -9s;
}

@keyframes go-glow-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(40px, -30px) scale(1.1); }
  66%      { transform: translate(-30px, 40px) scale(0.95); }
}

.go-drops {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
}
.go-drop {
  position: absolute;
  bottom: -40px;
  width: 18px;
  height: 26px;
  background: radial-gradient(circle at 35% 30%, #fef3c7 0%, #facc15 35%, #b45309 80%, #78350f 100%);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  transform-origin: 50% 100%;
  filter: drop-shadow(0 0 8px rgba(250, 204, 21, 0.6));
  animation: go-drop-rise linear infinite;
}
.go-drop::before {
  content: '';
  position: absolute;
  top: 5px; left: 5px;
  width: 5px; height: 7px;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 50%;
  filter: blur(1px);
}

@keyframes go-drop-rise {
  0%   { transform: translateY(0) rotate(0deg) scale(var(--s, 1)); opacity: 0; }
  10%  { opacity: 0.9; }
  50%  { transform: translateY(-55vh) translateX(20px) rotate(180deg); }
  90%  { opacity: 0.9; }
  100% { transform: translateY(-110vh) translateX(-20px) rotate(360deg); opacity: 0; }
}

.go-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 400px;
  padding: 36px 32px 28px;
  border-radius: 24px;
  background: rgba(20, 24, 40, 0.55);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 25px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 -20px 80px rgba(168, 85, 247, 0.15) inset;
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: go-card-in 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes go-card-in {
  0%   { opacity: 0; transform: translateY(30px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.go-card-glow {
  position: absolute;
  inset: -2px;
  border-radius: 24px;
  background: conic-gradient(
    from 0deg,
    rgba(74, 222, 128, 0.6),
    rgba(56, 189, 248, 0.6),
    rgba(168, 85, 247, 0.6),
    rgba(250, 204, 21, 0.6),
    rgba(74, 222, 128, 0.6)
  );
  filter: blur(14px);
  opacity: 0.35;
  z-index: -1;
  animation: go-card-rotate 8s linear infinite;
}

@keyframes go-card-rotate {
  to { transform: rotate(360deg); }
}

.go-logo {
  position: relative;
  width: 76px;
  height: 76px;
  margin: 0 auto 4px;
  display: grid;
  place-items: center;
}
.go-logo-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #4ade80, #38bdf8, #a855f7, #facc15, #4ade80);
  animation: go-card-rotate 4s linear infinite;
  filter: blur(2px);
}
.go-logo-ring::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: #0f1430;
}
.go-logo-pump {
  position: relative;
  z-index: 1;
  font-size: 36px;
  filter: drop-shadow(0 0 10px rgba(74, 222, 128, 0.7));
  animation: go-bounce 2.4s ease-in-out infinite;
}

@keyframes go-bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}

.go-title {
  margin: 4px 0 0;
  text-align: center;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(90deg, #4ade80, #38bdf8, #a855f7, #4ade80);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: go-title-shine 5s linear infinite;
}

@keyframes go-title-shine {
  to { background-position: 200% 0; }
}

.go-subtitle {
  margin: 0 0 8px;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.3px;
}

.go-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.go-field > span {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(255, 255, 255, 0.55);
  padding-left: 2px;
}
.go-field input {
  width: 100%;
  padding: 13px 14px;
  font-size: 15px;
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  font-family: inherit;
}
.go-field input::placeholder { color: rgba(255, 255, 255, 0.3); }
.go-field input:focus {
  border-color: rgba(74, 222, 128, 0.6);
  background: rgba(255, 255, 255, 0.09);
  box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.15), 0 0 20px rgba(74, 222, 128, 0.2);
}

.go-pwd-wrap { position: relative; }
.go-pwd-wrap input { padding-right: 44px; }
.go-pwd-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  min-height: 0;
  padding: 0;
  background: transparent;
  background-image: none;
  border: none;
  box-shadow: none;
  font-size: 16px;
  cursor: pointer;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #fff;
  opacity: 0.7;
  transition: opacity 0.2s, background 0.2s;
}
.go-pwd-toggle:hover:not(:disabled) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
  background-image: none;
  transform: translateY(-50%);
  box-shadow: none;
}

.go-error {
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fca5a5;
  font-size: 13px;
  text-align: center;
  animation: go-shake 0.4s ease;
}

@keyframes go-shake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-6px); }
  75%      { transform: translateX(6px); }
}

.go-submit {
  position: relative;
  margin-top: 6px;
  padding: 14px 16px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: #04210d;
  background: linear-gradient(135deg, #4ade80 0%, #22d3ee 50%, #a855f7 100%);
  background-size: 200% 200%;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(74, 222, 128, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  transition: transform 0.15s ease, box-shadow 0.2s ease, background-position 0.6s ease;
  font-family: inherit;
}
.go-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 36px rgba(74, 222, 128, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
  background-position: 100% 0%;
}
.go-submit:active:not(:disabled) { transform: translateY(0); }
.go-submit:disabled { opacity: 0.7; cursor: not-allowed; }

.go-submit-text { position: relative; z-index: 1; }
.go-submit-shimmer {
  position: absolute;
  top: 0; left: -60%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  transform: skewX(-20deg);
  animation: go-shimmer 2.8s ease-in-out infinite;
}

@keyframes go-shimmer {
  0%   { left: -60%; }
  60%  { left: 120%; }
  100% { left: 120%; }
}

.go-foot {
  margin-top: 4px;
  text-align: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.5px;
}

@media (max-width: 480px) {
  .go-card { padding: 28px 22px 22px; border-radius: 20px; }
  .go-title { font-size: 22px; }
  .go-logo { width: 64px; height: 64px; }
  .go-logo-pump { font-size: 30px; }
}
`;
