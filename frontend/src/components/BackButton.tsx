import { useNavigate } from 'react-router-dom';

interface Props {
  to?: string;
  label?: string;
}

export default function BackButton({ to = '/management', label = 'Назад к управлению' }: Props) {
  const navigate = useNavigate();
  return (
    <>
      <button
        type="button"
        className="back-btn"
        onClick={() => navigate(to)}
        aria-label={label}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
        <span>{label}</span>
      </button>
      <style>{backBtnCss}</style>
    </>
  );
}

const backBtnCss = `
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px 9px 12px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  background-image: none;
  color: var(--muted);
  cursor: pointer;
  min-height: 0;
  box-shadow: none;
  transition: background 0.18s, color 0.18s, border-color 0.18s, transform 0.15s;
}
.back-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}
.back-btn:hover:not(:disabled) {
  background: var(--panel);
  background-image: none;
  color: var(--text);
  border-color: var(--border-strong);
  transform: none;
  box-shadow: none;
}
.back-btn:hover:not(:disabled) svg {
  transform: translateX(-2px);
}
.back-btn:focus-visible {
  outline: none;
  border-color: rgba(74, 222, 128, 0.55);
  box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.15);
}
:root[data-theme="light"] .back-btn {
  background: rgba(15, 23, 42, 0.04);
  color: var(--muted);
}
:root[data-theme="light"] .back-btn:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.07);
  color: var(--text);
}
`;
