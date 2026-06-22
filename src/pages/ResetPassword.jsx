import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resetToken = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken, newPassword });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      const msg = (err.message || "").toLowerCase();
      const isExpired =
        msg.includes("expired") ||
        msg.includes("invalid") ||
        msg.includes("token") ||
        msg.includes("caducado") ||
        msg.includes("already") ||
        msg.includes("used");
      if (isExpired) {
        setTokenExpired(true);
      } else {
        setError(err.message || "No se pudo restablecer la contraseña");
      }
    } finally {
      setLoading(false);
    }
  };

  // Token ausente
  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Enlace inválido"
        subtitle="Este enlace de restablecimiento no es válido o está incompleto"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Solicitar un nuevo enlace
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          El enlace que usaste parece estar incompleto. Solicita un nuevo correo de restablecimiento.
        </p>
      </AuthLayout>
    );
  }

  // Token caducado o ya usado
  if (tokenExpired) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Enlace caducado"
        subtitle="Este enlace ya ha sido usado o ha expirado"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Solicitar un nuevo enlace
          </Link>
        }
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Los enlaces de restablecimiento son de un solo uso y caducan tras un tiempo por seguridad.
          </p>
          <Link to="/forgot-password">
            <Button className="w-full h-12 font-medium">
              Solicitar nuevo enlace
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // Éxito
  if (success) {
    return (
      <AuthLayout
        icon={CheckCircle}
        title="¡Contraseña actualizada!"
        subtitle="Tu contraseña se ha restablecido correctamente"
        footer={
          <Link to="/login" className="text-primary font-medium hover:underline">
            Ir al inicio de sesión
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground text-center">
          Serás redirigido automáticamente en unos segundos…
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="Nueva contraseña"
      subtitle="Introduce tu nueva contraseña"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nueva contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Restableciendo…
            </>
          ) : (
            "Restablecer contraseña"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}