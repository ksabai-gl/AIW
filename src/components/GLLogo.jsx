import "./GLLogo.css";

export default function GLLogo({ size = "md", variant = "full" }) {
  const sizes = {
    sm: { icon: 28, text: 14, sub: 8 },
    md: { icon: 36, text: 18, sub: 10 },
    lg: { icon: 48, text: 24, sub: 12 },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className="gl-logo-wrapper">
      {/* Icon mark */}
      <div className="gl-icon-mark" style={{ width: s.icon, height: s.icon }}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          {/* G+ mark */}
          <rect width="100" height="100" rx="16" fill="#FF5A1F" />
          <path
            d="M30 50 C30 37 40 28 52 28 C61 28 68 33 72 40 L60 40 C57 37 55 36 52 36 C45 36 39 42 39 50 C39 58 45 64 52 64 C58 64 63 60 64 55 L52 55 L52 47 L73 47 L73 55 C71 65 62 72 52 72 C40 72 30 63 30 50Z"
            fill="white"
          />
          <line
            x1="78"
            y1="36"
            x2="78"
            y2="52"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <line
            x1="70"
            y1="44"
            x2="86"
            y2="44"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {variant === "full" && (
        <div className="gl-text-block">
          <div className="gl-wordmark" style={{ fontSize: s.text }}>
            <span className="gl-word-global">Global</span>
            <span className="gl-word-logic">Logic</span>
          </div>
          <div className="gl-tagline" style={{ fontSize: s.sub }}>
            A Hitachi Group Company
          </div>
        </div>
      )}
    </div>
  );
}
