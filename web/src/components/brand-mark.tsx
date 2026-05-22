type BrandMarkProps = {
  className?: string;
  title?: string;
  decorative?: boolean;
  backgroundColor?: string;
};

export function BrandMark({
  className = "",
  title = "ArkivGate",
  decorative = false,
  backgroundColor = "var(--paper, #f6f1e8)",
}: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
      fill="none"
    >
      {decorative ? null : <title>{title}</title>}
      <rect x="8" y="6" width="26" height="52" rx="6" fill="currentColor" />
      <rect x="16" y="14" width="12" height="36" rx="2.5" fill={backgroundColor} />
      <path d="M28 12L50 16V48L28 52V12Z" fill="currentColor" />
      <circle cx="35.5" cy="32" r="2.25" fill={backgroundColor} />
    </svg>
  );
}