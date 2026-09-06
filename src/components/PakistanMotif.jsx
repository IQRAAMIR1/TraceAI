// Low-opacity crescent moon + star + Minar-e-Pakistan silhouette,
// used on every dark-section hero per PROJECT_SPEC.md §9.
export default function PakistanMotif({ className = '' }) {
  return (
    <svg
      className={`pk-motif ${className}`}
      viewBox="0 0 500 500"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Crescent moon */}
      <path
        d="M320 90c-70 10-120 70-120 145s50 135 120 145c-100 15-190-55-190-145S220 75 320 90z"
        fill="var(--color-mint)"
      />
      {/* Star */}
      <path
        d="M355 120l8 24h25l-20 15 8 24-21-15-21 15 8-24-20-15h25z"
        fill="var(--color-mint)"
      />
      {/* Minar-e-Pakistan silhouette */}
      <g fill="var(--color-mint)">
        <rect x="235" y="230" width="30" height="140" />
        <ellipse cx="250" cy="230" rx="30" ry="14" />
        <rect x="220" y="365" width="60" height="14" />
        <path d="M225 365c0-45 12-75 25-90 13 15 25 45 25 90z" />
        <rect x="150" y="379" width="200" height="10" />
        <rect x="130" y="389" width="240" height="12" />
      </g>
    </svg>
  );
}
