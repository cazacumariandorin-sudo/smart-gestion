import { cn } from "@/lib/utils";

/**
 * Logotipo OFICIAL de SIMANTEC (imagen corporativa guardada en /public).
 * variant: "icon" → solo la imagen.
 *          "full" → imagen + nombre SIMANTEC + subtítulo.
 */
export default function SimantecLogo({ variant = "full", size = 40, className, showTagline = true }) {
  const icon = (
    <img
      src="/simantec-icon-192.png"
      width={size}
      height={size}
      alt="SIMANTEC"
      className={cn("shrink-0 object-contain", variant === "icon" && className)}
    />
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
