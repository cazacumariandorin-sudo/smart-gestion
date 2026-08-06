import { cn } from "@/lib/utils";

/**
 * Logotipo corporativo de SIMANTEC.
 * Marcador estilizado: una "S" (Service Bus) en cianúrea sobre fondo azul oscuro,
 * con 4 cuadros verdes (módulos de integración) en disposición 2x2.
 *
 * variant: "icon"  → solo el marcador cuadrado.
 *            "full" → marcador + wordmark SIMANTEC + tagline.
 */
export default function SimantecLogo({ variant = "full", size = 40, className, showTagline = true }) {
  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SIMANTEC"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="simantec-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0A1F44" />
          <stop offset="100%" stopColor="#1565D8" />
        </linearGradient>
        <linearGradient id="simantec-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#simantec-bg)" />
      {/* S — Service Bus en cianúrea */}
      <path
        d="M45 14 C45 7 19 7 19 21 C19 32 45 31 45 43 C45 57 19 57 19 50"
        stroke="#3D86FF"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 4 módulos verdes 2x2 */}
      <g fill="url(#simantec-green)">
        <rect x="22" y="22" width="8" height="8" rx="2" />
        <rect x="34" y="22" width="8" height="8" rx="2" />
        <rect x="22" y="34" width="8" height="8" rx="2" />
        <rect x="34" y="34" width="8" height="8" rx="2" />
      </g>
    </svg>
  );

  if (variant === "icon") return icon;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {icon}
      <div className="leading-none">
        <div
          className="font-extrabold tracking-tight text-foreground"
          style={{ fontSize: size * 0.42, lineHeight: 1 }}
        >
          SIMANTEC
        </div>
        {showTagline && (
          <div
            className="font-medium tracking-wide mt-1"
            style={{ fontSize: size * 0.155, lineHeight: 1 }}
          >
            <span className="text-[#3D86FF]">INTEGRACIÓN</span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-foreground">MANTENIMIENTO</span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-[#16A34A]">TECNOLOGÍA</span>
          </div>
        )}
      </div>
    </div>
  );
}