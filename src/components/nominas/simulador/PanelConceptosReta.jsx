import CampoSimulacion from './CampoSimulacion';
import FilaDiasPrecio from './FilaDiasPrecio';
import SeccionCampos from './SeccionCampos';
import { eur } from '@/lib/nominaFormato';

const opcion = (activa) =>
  `rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
    activa ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'
  }`;

/** Conceptos del régimen RETA (autónomo societario), en el orden de la nómina. */
export default function PanelConceptosReta({ entradas, seed, onChange, absorcion, onAbsorcion }) {
  const tieneComplemento = (Number(seed.complemento_absorbible) || 0) > 0;

  return (
    <div className="space-y-4">
      <SeccionCampos titulo="Devengos dinerarios" descripcion="Salario base = días × precio/día.">
        <FilaDiasPrecio entradas={entradas} seed={seed} onChange={onChange} />

        {tieneComplemento && (
          <>
            <CampoSimulacion
              label="Complemento absorbible"
              value={entradas.complemento_absorbible}
              original={seed.complemento_absorbible}
              onChange={(v) => onChange('complemento_absorbible', v)}
            />
            <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-3">
              <span className="text-[11px] text-muted-foreground">Si sube el salario base:</span>
              <button type="button" onClick={() => onAbsorcion(true)} className={opcion(absorcion)}>
                Absorber del complemento
              </button>
              <button type="button" onClick={() => onAbsorcion(false)} className={opcion(!absorcion)}>
                Sumar al salario
              </button>
            </div>
          </>
        )}

        <CampoSimulacion
          label="Incentivos"
          value={entradas.incentivos}
          original={seed.incentivos}
          onChange={(v) => onChange('incentivos', v)}
        />
        <CampoSimulacion
          label="Otros devengos"
          value={entradas.otros_devengos}
          original={seed.otros_devengos}
          onChange={(v) => onChange('otros_devengos', v)}
        />
      </SeccionCampos>

      <SeccionCampos titulo="Dietas">
        <CampoSimulacion
          label="Importe dietas"
          value={entradas.dietas_importe}
          original={seed.dietas_importe}
          onChange={(v) => onChange('dietas_importe', v)}
        />
        <CampoSimulacion
          label="Días con dieta"
          sufijo="días"
          step="1"
          value={entradas.dietas_dias}
          original={seed.dietas_dias}
          onChange={(v) => onChange('dietas_dias', v)}
        />
        <label className="flex min-h-[56px] items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={entradas.dietas_con_pernocta !== false}
            onChange={(e) => onChange('dietas_con_pernocta', e.target.checked)}
          />
          Con pernocta
        </label>
      </SeccionCampos>

      <SeccionCampos
        titulo="Retribución en especie (bloqueada)"
        descripcion="La cuota de autónomos la paga la empresa como retribución en especie; el ingreso a cuenta cubre su IRPF."
      >
        <CampoSimulacion
          label="Cuota RETA pagada por la empresa"
          value={entradas.cuota_reta}
          original={seed.cuota_reta}
          onChange={() => {}}
          deshabilitado
          ayuda={`Devengo y descuento de ${eur(entradas.cuota_reta)}.`}
        />
        <CampoSimulacion
          label="Ingreso a cuenta IRPF"
          value={entradas.ingreso_cuenta_especie}
          original={seed.ingreso_cuenta_especie}
          onChange={(v) => onChange('ingreso_cuenta_especie', v)}
          ayuda="Lo abona la empresa para que el IRPF de la especie no merme el líquido."
        />
      </SeccionCampos>

      <SeccionCampos titulo="Deducciones propias">
        <CampoSimulacion
          label="Anticipos y otras deducciones"
          value={entradas.anticipos}
          original={seed.anticipos}
          onChange={(v) => onChange('anticipos', v)}
        />
      </SeccionCampos>
    </div>
  );
}