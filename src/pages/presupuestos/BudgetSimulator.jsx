import { useState, useMemo } from 'react';
import { Calculator, DollarSign, TrendingUp, Percent, AlertCircle, Download, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * SIMULADOR DE COSTES PROFESIONAL
 * 
 * Características:
 * - Extracción de precios de BD propia
 * - Consulta precios externos
 * - Cálculo mano de obra (administración, ingeniería)
 * - Costes legalización
 * - Generación de presupuesto PDF
 */

export default function BudgetSimulator({ materialsDb = [], externalPrices = {}, onChange }) {
  const [items, setItems] = useState([]);
  const [laborConfig, setLaborConfig] = useState({
    admin_hourly_rate: 45,
    engineer_hourly_rate: 65,
    admin_hours_percentage: 15, // 15% del tiempo total estimado
    engineering_hours_percentage: 10, // 10% del tiempo total estimado
  });

  const [legalizationConfig, setLegalizationConfig] = useState({
    enabled: false,
    base_cost: 500,
    percentage: 0, // 0% = solo costo base
  });

  const [profitMargin, setProfitMargin] = useState({
    percentage: 20, // 20% ganancia
  });

  const [contingency, setContingency] = useState({
    enabled: true,
    percentage: 5, // 5% imprevistos
  });

  // ==================== CÁLCULOS ====================

  // 1. Suma de materiales
  const materialsTotal = useMemo(() => {
    return items
      .filter(item => item.type === 'material')
      .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [items]);

  // 2. Cálculo mano de obra
  const laborCosts = useMemo(() => {
    const totalManualHours = items
      .filter(item => item.type === 'material')
      .reduce((sum, item) => sum + (item.labor_hours || 0), 0);

    const adminHours = (totalManualHours * laborConfig.admin_hours_percentage) / 100;
    const engineerHours = (totalManualHours * laborConfig.engineering_hours_percentage) / 100;

    const adminCost = adminHours * laborConfig.admin_hourly_rate;
    const engineerCost = engineerHours * laborConfig.engineer_hourly_rate;

    return {
      total_manual_hours: totalManualHours,
      admin_hours: adminHours,
      engineer_hours: engineerHours,
      admin_cost: adminCost,
      engineer_cost: engineerCost,
      total: adminCost + engineerCost,
    };
  }, [items, laborConfig]);

  // 3. Costes de legalización
  const legalizationCost = useMemo(() => {
    if (!legalizationConfig.enabled) return 0;

    const baseCost = legalizationConfig.base_cost;
    const percentageAdd = (materialsTotal * legalizationConfig.percentage) / 100;
    return baseCost + percentageAdd;
  }, [legalizationConfig, materialsTotal]);

  // 4. Subtotal (materiales + mano de obra + legalización)
  const subtotal = useMemo(() => {
    return materialsTotal + laborCosts.total + legalizationCost;
  }, [materialsTotal, laborCosts, legalizationCost]);

  // 5. Imprevistos
  const contingencyCost = useMemo(() => {
    if (!contingency.enabled) return 0;
    return (subtotal * contingency.percentage) / 100;
  }, [subtotal, contingency]);

  // 6. Subtotal + imprevistos
  const subtotalWithContingency = subtotal + contingencyCost;

  // 7. Margen de ganancia
  const profitCost = (subtotalWithContingency * profitMargin.percentage) / 100;

  // 8. TOTAL FINAL
  const finalTotal = subtotalWithContingency + profitCost;

  // ==================== FUNCIONES ====================

  const addMaterial = () => {
    setItems([
      ...items,
      {
        id: `material_${Date.now()}`,
        type: 'material',
        name: '',
        quantity: 1,
        unit: 'ud',
        unit_price: 0,
        labor_hours: 0,
        source: 'internal', // 'internal' | 'external'
      },
    ]);
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Seleccionar material de BD interna
  const selectMaterial = (itemId, material) => {
    updateItem(itemId, 'name', material.name);
    updateItem(itemId, 'unit_price', material.price);
    updateItem(itemId, 'unit', material.unit || 'ud');
    updateItem(itemId, 'source', 'internal');
  };

  // ==================== RENDER ====================

  const downloadPDF = () => {
    // Aquí iría la lógica para generar PDF con la librería jsPDF o similar
    console.log('Descargar presupuesto como PDF');
    const budgetData = {
      date: new Date().toLocaleDateString('es-ES'),
      items,
      summary: {
        materials_total: materialsTotal,
        labor_costs: laborCosts,
        legalization_cost: legalizationCost,
        subtotal,
        contingency_cost: contingencyCost,
        profit: profitCost,
        final_total: finalTotal,
      },
    };
    console.log(budgetData);
    onChange?.(budgetData);
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Calculator className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Simulador de Costes</h2>
          <p className="text-xs text-muted-foreground">Presupuesto detallado con mano de obra y legalización</p>
        </div>
      </div>

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="materials">Materiales</TabsTrigger>
          <TabsTrigger value="labor">Mano Obra</TabsTrigger>
          <TabsTrigger value="legalization">Legalización</TabsTrigger>
          <TabsTrigger value="summary">Resumen</TabsTrigger>
        </TabsList>

        {/* TAB 1: MATERIALES */}
        <TabsContent value="materials" className="space-y-4 mt-4">
          <div className="space-y-3">
            {items.map(item => (
              <Card key={item.id} className="p-4 border">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label className="text-xs font-semibold">Nombre/Descripción</Label>
                      <Input
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                        placeholder="Ej: Panel solar 400W"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeItem(item.id)}
                      className="mt-6"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        min="0"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Unidad</Label>
                      <Input
                        value={item.unit}
                        onChange={e => updateItem(item.id, 'unit', e.target.value)}
                        className="mt-1"
                        placeholder="ud, m², m, kg"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Precio Unit. (€)</Label>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Horas Mano Obra Estimadas</Label>
                    <Input
                      type="number"
                      value={item.labor_hours}
                      onChange={e => updateItem(item.id, 'labor_hours', parseFloat(e.target.value) || 0)}
                      className="mt-1"
                      min="0"
                      step="0.5"
                      placeholder="Ej: 4.5"
                    />
                  </div>

                  <div className="bg-blue-50 p-2 rounded text-xs">
                    <span className="font-semibold">Subtotal:</span> {(item.quantity * item.unit_price).toFixed(2)} €
                  </div>

                  {/* Sugerencias de BD interna */}
                  {materialsDb.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-semibold mb-2 text-muted-foreground">Materiales disponibles:</p>
                      <div className="flex flex-wrap gap-2">
                        {materialsDb.filter(m => m.name.toLowerCase().includes(item.name.toLowerCase())).map(mat => (
                          <button
                            key={mat.id}
                            onClick={() => selectMaterial(item.id, mat)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition"
                          >
                            {mat.name} ({mat.price}€)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Button onClick={addMaterial} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Agregar Material/Línea
          </Button>
        </TabsContent>

        {/* TAB 2: MANO DE OBRA */}
        <TabsContent value="labor" className="space-y-4 mt-4">
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold">Tarifa Horaria Administración (€/h)</Label>
                <Input
                  type="number"
                  value={laborConfig.admin_hourly_rate}
                  onChange={e => setLaborConfig({ ...laborConfig, admin_hourly_rate: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                  min="0"
                  step="5"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Tarifa Horaria Ingeniería (€/h)</Label>
                <Input
                  type="number"
                  value={laborConfig.engineer_hourly_rate}
                  onChange={e => setLaborConfig({ ...laborConfig, engineer_hourly_rate: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                  min="0"
                  step="5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">% Administración del tiempo</Label>
                  <Input
                    type="number"
                    value={laborConfig.admin_hours_percentage}
                    onChange={e => setLaborConfig({ ...laborConfig, admin_hours_percentage: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">% Ingeniería del tiempo</Label>
                  <Input
                    type="number"
                    value={laborConfig.engineering_hours_percentage}
                    onChange={e => setLaborConfig({ ...laborConfig, engineering_hours_percentage: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* PREVIEW MANO DE OBRA */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3">Desglose Mano de Obra</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total horas estimadas:</span>
                <span className="font-semibold">{laborCosts.total_manual_hours.toFixed(1)} h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Admin ({laborConfig.admin_hourly_rate}€/h):</span>
                <span>{laborCosts.admin_hours.toFixed(1)} h → <strong>{laborCosts.admin_cost.toFixed(2)}€</strong></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingeniería ({laborConfig.engineer_hourly_rate}€/h):</span>
                <span>{laborCosts.engineer_hours.toFixed(1)} h → <strong>{laborCosts.engineer_cost.toFixed(2)}€</strong></span>
              </div>
              <div className="pt-2 border-t flex justify-between font-semibold">
                <span>TOTAL MANO DE OBRA:</span>
                <span className="text-green-600">{laborCosts.total.toFixed(2)}€</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: LEGALIZACIÓN */}
        <TabsContent value="legalization" className="space-y-4 mt-4">
          <Card className="p-4 border">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={legalizationConfig.enabled}
                  onChange={e => setLegalizationConfig({ ...legalizationConfig, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label className="font-semibold cursor-pointer">Incluir costes de legalización</Label>
              </div>

              {legalizationConfig.enabled && (
                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <Label className="text-xs font-semibold">Coste Base Legalización (€)</Label>
                    <Input
                      type="number"
                      value={legalizationConfig.base_cost}
                      onChange={e => setLegalizationConfig({ ...legalizationConfig, base_cost: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                      min="0"
                      step="10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Ej: 500€ para trámites básicos</p>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">% Adicional sobre Materiales</Label>
                    <Input
                      type="number"
                      value={legalizationConfig.percentage}
                      onChange={e => setLegalizationConfig({ ...legalizationConfig, percentage: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                      min="0"
                      max="100"
                      step="1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Ej: 5% de los materiales</p>
                  </div>

                  <div className="bg-blue-50 p-3 rounded text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coste base:</span>
                      <span className="font-semibold">{legalizationConfig.base_cost.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{legalizationConfig.percentage}% de {materialsTotal.toFixed(2)}€:</span>
                      <span className="font-semibold">{((materialsTotal * legalizationConfig.percentage) / 100).toFixed(2)}€</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between font-semibold text-blue-800">
                      <span>TOTAL LEGALIZACIÓN:</span>
                      <span>{legalizationCost.toFixed(2)}€</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* TAB 4: RESUMEN */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Desglose de Costes
            </h3>

            <div className="space-y-3">
              {/* Materiales */}
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm">Materiales</span>
                <span className="font-semibold text-sm">{materialsTotal.toFixed(2)}€</span>
              </div>

              {/* Mano de obra */}
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm">Mano de Obra (Admin + Ingeniería)</span>
                <span className="font-semibold text-sm">{laborCosts.total.toFixed(2)}€</span>
              </div>

              {/* Legalización */}
              {legalizationConfig.enabled && (
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm">Legalización</span>
                  <span className="font-semibold text-sm">{legalizationCost.toFixed(2)}€</span>
                </div>
              )}

              {/* Subtotal */}
              <div className="flex justify-between items-center py-2 bg-white rounded p-2 font-semibold">
                <span>Subtotal</span>
                <span>{subtotal.toFixed(2)}€</span>
              </div>

              {/* Imprevistos */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contingency.enabled}
                    onChange={e => setContingency({ ...contingency, enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label className="text-sm cursor-pointer">Incluir imprevistos</Label>
                </div>
                {contingency.enabled && (
                  <div className="ml-6 flex items-center gap-2">
                    <Input
                      type="number"
                      value={contingency.percentage}
                      onChange={e => setContingency({ ...contingency, percentage: parseFloat(e.target.value) || 0 })}
                      className="w-20 text-sm"
                      min="0"
                      max="100"
                      step="1"
                    />
                    <span className="text-sm">% = {contingencyCost.toFixed(2)}€</span>
                  </div>
                )}
              </div>

              {/* Margen de ganancia */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Margen de Ganancia
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={profitMargin.percentage}
                    onChange={e => setProfitMargin({ percentage: parseFloat(e.target.value) || 0 })}
                    className="w-20"
                    min="0"
                    max="100"
                    step="1"
                  />
                  <span className="text-sm">% = {profitCost.toFixed(2)}€</span>
                </div>
              </div>

              {/* TOTAL FINAL */}
              <div className="mt-4 p-4 bg-gradient-to-r from-green-100 to-green-50 border-2 border-green-300 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-green-800">TOTAL PRESUPUESTO</span>
                  <span className="text-2xl font-bold text-green-700">{finalTotal.toFixed(2)}€</span>
                </div>
              </div>

              {/* Resumen rápido */}
              <Card className="p-3 bg-blue-50 border-blue-200">
                <p className="text-xs text-blue-900 mb-2 font-semibold">📊 Resumen Rápido</p>
                <div className="text-xs space-y-1 text-blue-800">
                  <div className="flex justify-between">
                    <span>Materiales:</span>
                    <span className="font-semibold">{((materialsTotal / finalTotal) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mano de obra:</span>
                    <span className="font-semibold">{((laborCosts.total / finalTotal) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Margen:</span>
                    <span className="font-semibold">{((profitCost / finalTotal) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </Card>
            </div>
          </Card>

          <Button onClick={downloadPDF} className="w-full gap-2 bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4" />
            Descargar Presupuesto (PDF)
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
