import CampoSimulacion from './CampoSimulacion';
import SeccionCampos from './SeccionCampos';
import PanelConceptosReta from './PanelConceptosReta';

const CAMPOS_VARIABLES = [
  ['plus_convenio', 'Plus convenio'],
  ['mejora_productividad', 'Mejora de productividad'],
  ['carencia_incentivos', 'Carencia de incentivos'],
  ['complemento_absorbible', 'Complemento absorbible'],
  ['incentivos', 'Incentivos'],
  ['horas_extra', 'Horas extra'],
  ['otros_devengos', 'Otros devengos'],
];

/** Conceptos editables de la simulación, cada uno con su valor histórico al lado. */
export default function PanelConceptos({ entradas, seed, regimen, onChange, absorcion, onAbsorcion }) {
  const reta = regimen === 'autonomo_societario';
  const prorrata = Math.round(((Number(entradas.salario_base) || 0) * (Number(entradas.pagas_extra) || 0)) / 12 * 100) / 100;

  if (reta) {
    return (
      <PanelConceptosReta
        entradas={entradas}
        seed={seed}
        onChange={onChange}
        absorcion={absorcion}
        onAbsorcion={onAbsorcion}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SeccionCampos
        titulo="Salario y jornada"
        descripcion="El salario base se calcula siempre como días × precio/día."
      >
        <CampoSimulacion
          label="Días trabajados"
          sufijo="días"
          step="1"
          value={entradas.dias}
          original={seed.dias}
          onChange={(v) => onChange('dias', v)}
        />
        <CampoSimulacion
          label="Precio / día"
          step="0.01"
          value={entradas.precio_dia}
          original={seed.precio_dia}
          onChange={(v) => onChange('precio_dia', v)}
        />
        <CampoSimulacion
          label="Salario base"
          value={entradas.salario_base}
          original={seed.salario_base}
          onChange={(v) => onChange('salario_base', v)}
        />
        <CampoSimulacion
          label="Nº pagas extra (prorrata)"
          sufijo="pagas"
          step="1"
          value={entradas.pagas_extra}
          original={seed.pagas_extra}
          onChange={(v) => onChange('pagas_extra', v)}
        />
        <CampoSimulacion
          label="Prorrata pagas extra (calculada)"
          value={prorrata}
          original={Math.round(((Number(seed.salario_base) || 0) * (Number(seed.pagas_extra) || 0)) / 12 * 100) / 100}
          onChange={() => {}}
          deshabilitado
          ayuda={
            entradas.prorrata_en_devengado === false
              ? 'Solo entra en la base de cotización, como en la nómina de referencia.'
              : undefined
          }
        />
      </SeccionCampos>

      <SeccionCampos titulo="Pluses, incentivos y mejoras">
        {CAMPOS_VARIABLES.map(([key, label]) => (
          <CampoSimulacion
            key={key}
            label={label}
            value={entradas[key]}
            original={seed[key]}
            onChange={(v) => onChange(key, v)}
          />
        ))}
      </SeccionCampos>

      <SeccionCampos
        titulo="Dietas"
        descripcion="Exentas hasta 53,34 €/día con pernocta y 26,67 €/día sin pernocta; el exceso cotiza y tributa."
      >
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

      <SeccionCampos titulo="Deducciones previstas">
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