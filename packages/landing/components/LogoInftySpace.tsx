"use client";

export default function LogoInftySpace({
  className = "h-8",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* ∞ symbol + space */}
      <text
        x="0"
        y="17"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="16"
        fontWeight="500"
      >
        ∞space
      </text>
    </svg>
  );
}
