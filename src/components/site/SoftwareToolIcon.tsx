import type { SoftwareIcon } from "@/lib/cms/software-icons";

const iconStyles: Record<Exclude<SoftwareIcon, "custom">, { fill: string; letters: string }> = {
  illustrator: { fill: "#332014", letters: "Ai" },
  photoshop: { fill: "#102e4a", letters: "Ps" },
  "after-effects": { fill: "#1d1747", letters: "Ae" },
  "premiere-pro": { fill: "#281541", letters: "Pr" },
  figma: { fill: "transparent", letters: "" },
  other: { fill: "#3d4650", letters: "✳" },
};

export function SoftwareToolIcon({
  icon = "other",
  label,
  mediaUrl,
  className = "h-9 w-9",
}: {
  icon?: SoftwareIcon | undefined;
  label: string;
  mediaUrl?: string | undefined;
  className?: string | undefined;
}) {
  if (mediaUrl) {
    return (
      <span
        role="img"
        aria-label={label}
        className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border/70 bg-background/70 ${className}`}
      >
        <img
          aria-hidden="true"
          src={mediaUrl}
          alt=""
          className="h-full w-full object-contain p-1"
        />
      </span>
    );
  }

  const selected = icon === "custom" ? "other" : icon;
  const style = iconStyles[selected];
  if (selected === "figma") {
    return (
      <span
        role="img"
        aria-label={label}
        className={`inline-grid shrink-0 place-items-center ${className}`}
      >
        <svg aria-hidden="true" viewBox="0 0 32 48" className="h-full w-auto">
          <path fill="#f24e1e" d="M8 0h8v16H8a8 8 0 0 1 0-16Z" />
          <path fill="#ff7262" d="M16 0h8a8 8 0 0 1 0 16h-8Z" />
          <path fill="#a259ff" d="M8 16h8v16H8a8 8 0 0 1 0-16Z" />
          <circle cx="24" cy="24" r="8" fill="#1abcfe" />
          <path fill="#0acf83" d="M8 32h8v8a8 8 0 1 1-8-8Z" />
        </svg>
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-grid shrink-0 place-items-center rounded-lg border border-white/10 ${className}`}
      style={{ backgroundColor: style.fill }}
    >
      <svg aria-hidden="true" viewBox="0 0 40 40" className="h-full w-full p-1">
        <rect x="1" y="1" width="38" height="38" rx="8" fill={style.fill} />
        <text
          x="20"
          y="25"
          textAnchor="middle"
          fill={selected === "illustrator" || selected === "other" ? "#ff9a42" : "#7bcaff"}
          fontFamily="Arial, sans-serif"
          fontSize="16"
          fontWeight="600"
        >
          {style.letters}
        </text>
      </svg>
    </span>
  );
}
