import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Alta Unificada de Técnico — Fase 4 Registro Unificado
 * 1. Genera num_empleado único (SMT-AAAA-NNNNN)
 * 2. Crea registro Operario con num_empleado
 * 3. Crea registro DatosSensiblesUsuario vinculado
 * 4. (Opcional) Envía invitación al email del técnico
 */

function generarNumEmpleado(registros, anio) {
  const prefijo = 'SMT';
  const anio4 = String(anio);
  let max = 0;
  for (const r of registros) {
    const val = r.num_empleado;
    if (!val) continue;
    const partes = val.split('-');
    if (partes.length === 3 && partes[0] === prefijo && partes[1] === anio4) {
      const n = parseInt(partes[2], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  const seq = String(max + 1).padStart(5, '0');
  return `${prefijo}-${anio4}-${seq}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'gerencia', 'director_comercial'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      // Datos Operario
      name, dni, email, phone, role: cargo, categoria, especialidad,
      // Datos sensibles
      coste_hora, salario_bruto_mensual, num_afiliacion_ss, cuenta_bancaria_iban,
      fecha_alta_empresa,
      // Opciones
      invitar_usuario = false,
    } = body;

    if (!name) return Response.json({ error: 'name es requerido' }, { status: 400 });

    const anio = new Date().getFullYear();

    // 1. Obtener todos los operarios para calcular num_empleado
    const todosOperarios = await base44.asServiceRole.entities.Operario.list('-created_date', 500);
    const num_empleado = generarNumEmpleado(todosOperarios, anio);

    // 2. Crear Operario
    const operario = await base44.asServiceRole.entities.Operario.create({
      num_empleado,
      name,
      dni,
      email: email ? email.toLowerCase().trim() : undefined,
      phone,
      role: cargo,
      categoria,
      especialidad,
      active: true,
      vinculacion_tipo: 'sin_vincular',
    });

    // 3. Crear DatosSensiblesUsuario si hay email o datos sensibles
    let datosSensibles = null;
    const tieneDatosSensibles = email || coste_hora || salario_bruto_mensual || num_afiliacion_ss || cuenta_bancaria_iban;
    if (tieneDatosSensibles && email) {
      datosSensibles = await base44.asServiceRole.entities.DatosSensiblesUsuario.create({
        user_email: email.toLowerCase().trim(),
        operario_id: operario.id,
        operario_name: name,
        coste_hora: coste_hora || undefined,
        salario_bruto_mensual: salario_bruto_mensual || undefined,
        num_afiliacion_ss: num_afiliacion_ss || undefined,
        cuenta_bancaria_iban: cuenta_bancaria_iban || undefined,
        fecha_alta_empresa: fecha_alta_empresa || undefined,
        categoria_laboral: categoria || undefined,
        migrado_desde_operario: false,
      });
    }

    // 4. Invitar al usuario si se solicita y hay email
    let invitacion = null;
    if (invitar_usuario && email) {
      try {
        invitacion = await base44.asServiceRole.integrations.Core.SendEmail({
          to: email.toLowerCase().trim(),
          subject: `Bienvenido a SMART GESTIÓN — Tu número de empleado: ${num_empleado}`,
          body: `Hola ${name},\n\nSe ha creado tu perfil en SMART GESTIÓN.\nTu número de empleado es: ${num_empleado}\n\nPronto recibirás un enlace de acceso.\n\nSimantec`,
        });
      } catch (e) {
        // No bloquear si el email falla
      }
    }

    return Response.json({
      success: true,
      num_empleado,
      operario_id: operario.id,
      datos_sensibles_id: datosSensibles?.id || null,
      invitacion_enviada: !!invitacion,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});