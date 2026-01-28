
import React, { useState, useMemo, useRef } from 'react';
import { ArrowRight, BarChart3, Download, FileText, Zap, ClipboardCheck, Timer, PieChart, BarChart4, ListFilter } from 'lucide-react';
import { Claim, ClaimStatus } from '../../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// --- HELPERS ---
const parseDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes('T') && dateStr.includes('-')) return new Date(dateStr);
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return null;
};

const getDaysDiff = (start: Date | null, end: Date | null): number => {
    if (!start || !end) return 0;
    const diff = Math.abs(end.getTime() - start.getTime());
    return diff / (1000 * 60 * 60 * 24);
};

interface IndicatorsViewProps {
    claims: Claim[];
    onBack: () => void;
}

export const IndicatorsView: React.FC<IndicatorsViewProps> = ({ claims, onBack }) => {
    const [indicatorTimeFilter, setIndicatorTimeFilter] = useState<'30' | '60' | '90' | 'ALL' | 'PENDING'>('ALL');
    const [indicatorCaseFilter, setIndicatorCaseFilter] = useState<string>('GLOBAL');
    const indicatorsRef = useRef<HTMLDivElement>(null);

    const indicatorsData = useMemo(() => {
      let filtered = claims;
      
      // Time Filter
      if (indicatorTimeFilter !== 'ALL') {
          const now = new Date();
          filtered = filtered.filter(c => {
              if (indicatorTimeFilter === 'PENDING') return c.status !== ClaimStatus.CLOSED;
              
              const refDate = c.status === ClaimStatus.CLOSED && c.internalCloseDate ? parseDate(c.internalCloseDate) : parseDate(c.date);
              if (!refDate) return false;
              const daysDiff = getDaysDiff(refDate, now);
              return daysDiff <= parseInt(indicatorTimeFilter);
          });
      }

      // Case Filter
      if (indicatorCaseFilter !== 'GLOBAL') {
          filtered = filtered.filter(c => c.id === indicatorCaseFilter);
      }

      let totalMitigationDays = 0;
      let mitigationCount = 0;
      let totalPlanTaskDays = 0;
      let planTaskCount = 0;
      let totalImmediateClosureDays = 0;
      let immediateClosureCount = 0;
      let totalAdminClosureDays = 0;
      let adminClosureCount = 0;

      const productFrequency: Record<string, number> = {};
      const brandFrequency: Record<string, number> = {};

      filtered.forEach(c => {
          const startDate = parseDate(c.date);

          c.mitigationActions?.forEach(m => {
              if (m.completedAt && m.createdAt) {
                  const days = getDaysDiff(parseDate(m.createdAt), parseDate(m.completedAt));
                  totalMitigationDays += days;
                  mitigationCount++;
              }
          });

          if (c.mitigationActions && c.mitigationActions.length > 0) {
              const approvalDates = c.mitigationActions
                  .map(m => m.approvedAt ? parseDate(m.approvedAt) : null)
                  .filter(Boolean) as Date[];
              
              if (approvalDates.length === c.mitigationActions.length && startDate) {
                  const lastApproval = new Date(Math.max(...approvalDates.map(d => d.getTime())));
                  totalImmediateClosureDays += getDaysDiff(startDate, lastApproval);
                  immediateClosureCount++;
              }
          }

          c.tasks?.forEach(t => {
              if (t.completedAt && t.createdAt) {
                  const days = getDaysDiff(parseDate(t.createdAt), parseDate(t.completedAt));
                  totalPlanTaskDays += days;
                  planTaskCount++;
              }
          });

          if (c.status === ClaimStatus.CLOSED && c.internalCloseDate && startDate) {
              const closeDate = parseDate(c.internalCloseDate);
              if (closeDate) {
                  totalAdminClosureDays += getDaysDiff(startDate, closeDate);
                  adminClosureCount++;
              }
          }

          if (c.productRef) {
              const items = c.productRef.split('|');
              items.forEach(item => {
                  const cleanName = item.replace(/\s*\(Cant:.*?\)/i, '').trim();
                  if (cleanName) {
                      productFrequency[cleanName] = (productFrequency[cleanName] || 0) + 1;
                  }
              });
          }

          if ((c as any).brand) { 
              const brandStr = String((c as any).brand);
              const brands = brandStr.split('|');
              brands.forEach(b => {
                  const cleanBrand = b.trim();
                  if (cleanBrand) {
                      brandFrequency[cleanBrand] = (brandFrequency[cleanBrand] || 0) + 1;
                  }
              });
          }
      });

      const topProducts = Object.entries(productFrequency).sort(([, a], [, b]) => b - a).slice(0, 5);
      const topBrands = Object.entries(brandFrequency).sort(([, a], [, b]) => b - a);

      return {
          totalClaims: filtered.length,
          totalMitigations: mitigationCount,
          totalPlanTasks: planTaskCount,
          avgMitigationExec: mitigationCount ? (totalMitigationDays / mitigationCount).toFixed(1) : '0',
          avgImmediateClosure: immediateClosureCount ? (totalImmediateClosureDays / immediateClosureCount).toFixed(1) : '0',
          avgPlanTaskExec: planTaskCount ? (totalPlanTaskDays / planTaskCount).toFixed(1) : '0',
          avgAdminClosure: adminClosureCount ? (totalAdminClosureDays / adminClosureCount).toFixed(1) : '0',
          topProducts,
          topBrands,
          filteredClaims: filtered
      };
    }, [claims, indicatorTimeFilter, indicatorCaseFilter]);

    const downloadIndicatorsPDF = async () => {
      if(!indicatorsRef.current) return;
      try {
          const canvas = await html2canvas(indicatorsRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('l', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgProps = pdf.getImageProperties(imgData);
          let printWidth = pdfWidth;
          let printHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          if (printHeight > pdfHeight) {
              const scale = pdfHeight / printHeight;
              printHeight = pdfHeight;
              printWidth = printWidth * scale;
          }
          
          const x = (pdfWidth - printWidth) / 2;
          pdf.addImage(imgData, 'PNG', x, 0, printWidth, printHeight);
          pdf.save(`Indicadores_Calidad_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (e) {
          console.error(e);
          alert("Error generando PDF");
      }
    };

    const { avgMitigationExec, avgImmediateClosure, avgPlanTaskExec, avgAdminClosure, totalClaims, totalMitigations, totalPlanTasks, topProducts, topBrands, filteredClaims } = indicatorsData;

    return (
      <div className="h-screen bg-slate-50 flex flex-col overflow-auto font-sans">
          <div className="p-8 max-w-7xl mx-auto w-full">
              <div className="flex justify-between items-start mb-8">
                  <div>
                      <button onClick={onBack} className="mb-2 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold"><ArrowRight className="rotate-180" size={20}/> Volver al Tablero</button>
                      <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><BarChart3 size={32} className="text-indigo-600"/> Panel de Gestión de Calidad</h1>
                  </div>
                  <button onClick={downloadIndicatorsPDF} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-black transition flex items-center gap-2">
                      <Download size={20}/> Exportar PDF
                  </button>
              </div>

              <div ref={indicatorsRef} className="bg-slate-50 p-4 -m-4">
                  {/* FILTERS */}
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                      <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                          {['ALL', '30', '60', '90', 'PENDING'].map(f => (
                              <button key={f} onClick={() => setIndicatorTimeFilter(f as any)} className={`px-4 py-2 rounded-md text-xs font-bold transition ${indicatorTimeFilter === f ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                  {f === 'ALL' ? 'Historico Total' : f === 'PENDING' ? 'Pendientes' : `Últimos ${f} días`}
                              </button>
                          ))}
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase">Alcance:</span>
                          <select className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 font-medium" value={indicatorCaseFilter} onChange={(e) => setIndicatorCaseFilter(e.target.value)}>
                              <option value="GLOBAL">Global (Toda la Operación)</option>
                              {claims.map(c => <option key={c.id} value={c.id}>{c.id} - {c.client}</option>)}
                          </select>
                      </div>
                  </div>

                  {/* KPI CARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><FileText size={32}/></div>
                          <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Reclamaciones</p><p className="text-4xl font-black text-slate-800 leading-none">{totalClaims}</p></div>
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><Zap size={32}/></div>
                          <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acciones Mitigación</p><p className="text-4xl font-black text-slate-800 leading-none">{totalMitigations}</p></div>
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                          <div className="p-4 bg-green-50 text-green-600 rounded-2xl"><ClipboardCheck size={32}/></div>
                          <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tareas Plan Acción</p><p className="text-4xl font-black text-slate-800 leading-none">{totalPlanTasks}</p></div>
                      </div>
                  </div>

                  {/* MAIN METRICS GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                      <div className="lg:col-span-2 space-y-6">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Timer size={20} className="text-indigo-600"/> Tiempos de Ciclo Promedio</h3>
                          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <span className="text-xs font-bold text-slate-600">Ejecución Tarea Mitigación</span>
                                  <span className="text-sm font-black text-slate-900">{avgMitigationExec} días</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <span className="text-xs font-bold text-slate-600">Cierre Fase Mitigación</span>
                                  <span className="text-sm font-black text-slate-900">{avgImmediateClosure} días</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <span className="text-xs font-bold text-slate-600">Ejecución Tareas Plan Acción</span>
                                  <span className="text-sm font-black text-slate-900">{avgPlanTaskExec} días</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100 mt-2">
                                  <span className="text-xs font-bold text-indigo-800">Cierre Administrativo Total</span>
                                  <span className="text-sm font-black text-indigo-900">{avgAdminClosure} días</span>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-6">
                          <div>
                              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><PieChart size={20} className="text-purple-600"/> Distribución por Marca</h3>
                              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                  {topBrands.length > 0 ? (
                                      <div className="space-y-0 divide-y divide-slate-100">
                                          {topBrands.map(([name, count], idx) => (
                                              <div key={idx} className="flex justify-between items-center py-3">
                                                  <span className="text-xs font-bold text-slate-600">{name}</span>
                                                  <span className="text-sm font-black text-slate-800">{count}</span>
                                              </div>
                                          ))}
                                      </div>
                                  ) : <div className="text-center text-slate-400 text-xs italic">Sin datos</div>}
                              </div>
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><BarChart4 size={20} className="text-indigo-600"/> Top Productos</h3>
                              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-auto">
                                  {topProducts.length > 0 ? (
                                      <div className="space-y-0 divide-y divide-slate-100">
                                          {topProducts.map(([name, count], idx) => (
                                              <div key={idx} className="flex justify-between items-start py-3 gap-4">
                                                  <span className="text-[10px] font-bold text-slate-600 leading-tight w-3/4">{name}</span>
                                                  <span className="text-sm font-black text-indigo-600">{count}</span>
                                              </div>
                                          ))}
                                      </div>
                                  ) : <div className="text-center text-slate-400 py-4 italic text-xs">No hay datos suficientes</div>}
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* DETAILED TABLE */}
                  <div className="mb-8">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><ListFilter size={20} className="text-indigo-600"/> Detalle de Casos ({indicatorTimeFilter === 'PENDING' ? 'Pendientes' : 'Cerrados y Filtrados'})</h3>
                      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                          <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                  <tr>
                                      <th className="p-4 text-slate-600">Fecha Inicio</th>
                                      <th className="p-4 text-slate-600">ID Caso</th>
                                      <th className="p-4 text-slate-600">Cliente</th>
                                      <th className="p-4 text-slate-600">Producto</th>
                                      <th className="p-4 text-slate-600">Estado</th>
                                      <th className="p-4 text-slate-600">Fecha Cierre</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {filteredClaims.map(c => (
                                      <tr key={c.id} className="hover:bg-slate-50 transition">
                                          <td className="p-4 font-mono text-slate-500 text-xs">{c.date}</td>
                                          <td className="p-4 font-bold text-slate-700">{c.id}</td>
                                          <td className="p-4 font-medium text-slate-800">{c.client}</td>
                                          <td className="p-4 text-xs text-slate-500 max-w-xs truncate" title={c.productRef}>{c.productRef}</td>
                                          <td className="p-4">
                                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${c.status === ClaimStatus.CLOSED ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                                  {c.status}
                                              </span>
                                          </td>
                                          <td className="p-4 font-mono text-slate-500 text-xs">{c.internalCloseDate || '-'}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                          {filteredClaims.length === 0 && <div className="text-center py-8 text-slate-400 italic">No hay registros para los filtros seleccionados.</div>}
                      </div>
                  </div>
              </div>
          </div>
      </div>
    );
};
