import React, { useState, useMemo } from 'react';
import { ScheduleItem } from '../types';
import { Filter, BarChart3, PieChart, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';

interface DashboardTabProps {
  scheduleData: ScheduleItem[];
  completedItems?: Set<string>;
}

interface ServiceStatData {
  count: number;
  remocoes: number;
  dates: number[];
  late: number;
  onTime: number;
}

interface QuadraStatData {
  count: number;
  remocoes: number;
  dates: number[];
}

const DashboardTab: React.FC<DashboardTabProps> = ({ scheduleData, completedItems = new Set() }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: React.ReactNode } | null>(null);

  const filteredData = useMemo(() => {
    if (!selectedDate) return scheduleData;

    return scheduleData.filter(item => {
      if (!item._rawDate) return false;
      // Convert item date to YYYY-MM-DD string locally
      const itemDate = new Date(item._rawDate.getTime() - (item._rawDate.getTimezoneOffset() * 60000))
        .toISOString()
        .split('T')[0];
      return itemDate === selectedDate;
    });
  }, [scheduleData, selectedDate]);

  // Aggregation 1: Services with Dates and Late/OnTime logic
  const serviceStats = useMemo(() => {
    const now = new Date();
    const stats = filteredData.reduce((acc, curr) => {
      const svc = curr.servico || 'OUTROS';
      if (!acc[svc]) acc[svc] = { count: 0, remocoes: 0, dates: [] as number[], late: 0, onTime: 0 };
      
      acc[svc].count += 1;
      acc[svc].remocoes += (curr.remocoes || 0);
      
      if (curr._rawDate) {
        acc[svc].dates.push(curr._rawDate.getTime());
        // Logic: Late if date < now, otherwise On Time
        if (curr._rawDate < now) {
          acc[svc].late += 1;
        } else {
          acc[svc].onTime += 1;
        }
      } else {
        acc[svc].onTime += 1; 
      }

      return acc;
    }, {} as Record<string, ServiceStatData>);

    return Object.entries(stats)
      .map(([service, data]: [string, ServiceStatData]) => {
        let dateLabel = 'Sem datas';
        if (data.dates.length > 0) {
          const min = new Date(Math.min(...data.dates));
          const max = new Date(Math.max(...data.dates));
          const fmt = (d: Date) => d.toLocaleDateString('pt-BR');
          dateLabel = min.getTime() === max.getTime() ? fmt(min) : `${fmt(min)} até ${fmt(max)}`;
        }
        return { service, ...data, dateLabel };
      })
      .sort((a, b) => b.remocoes - a.remocoes);
  }, [filteredData]);

  // Aggregation 2: Quadras (First 2 chars) with Dates and Service Count
  const quadraStats = useMemo(() => {
    const stats = filteredData.reduce((acc, curr) => {
      // Get first 2 chars of quadraFull
      const quadra = curr.quadraFull && curr.quadraFull.length >= 2 
        ? curr.quadraFull.substring(0, 2).toUpperCase() 
        : (curr.quadraFull || '??');
      
      if (!acc[quadra]) acc[quadra] = { count: 0, remocoes: 0, dates: [] as number[] };
      
      acc[quadra].count += 1; // Count services/items
      acc[quadra].remocoes += (curr.remocoes || 0);
      
      if (curr._rawDate) acc[quadra].dates.push(curr._rawDate.getTime());
      return acc;
    }, {} as Record<string, QuadraStatData>);

    return Object.entries(stats)
      .map(([quadra, data]: [string, QuadraStatData]) => {
        let dateLabel = 'Sem datas';
        if (data.dates.length > 0) {
          const min = new Date(Math.min(...data.dates));
          const max = new Date(Math.max(...data.dates));
          const fmt = (d: Date) => d.toLocaleDateString('pt-BR');
          dateLabel = min.getTime() === max.getTime() ? fmt(min) : `${fmt(min)} até ${fmt(max)}`;
        }
        return { quadra, ...data, dateLabel }; // includes data.count
      })
      .sort((a, b) => b.remocoes - a.remocoes); // Sorting by remocoes (total removals)
  }, [filteredData]);

  // Aggregation 3: Execution Status (Completed vs Pending)
  const executionStats = useMemo(() => {
    let servicesDone = 0;
    let servicesPending = 0;
    let removalsDone = 0;
    let removalsPending = 0;

    filteredData.forEach(item => {
      const isDone = completedItems.has(item.id);
      if (isDone) {
        servicesDone++;
        removalsDone += (item.remocoes || 0);
      } else {
        servicesPending++;
        removalsPending += (item.remocoes || 0);
      }
    });

    return { servicesDone, servicesPending, removalsDone, removalsPending };
  }, [filteredData, completedItems]);

  // Calculate totals for summary cards
  const totalServices = filteredData.length;
  const totalRemocoes = filteredData.reduce((sum, item) => sum + (item.remocoes || 0), 0);

  const handleMouseMove = (e: React.MouseEvent, content: React.ReactNode) => {
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      content
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  // Helper for progress bars
  const getPercentage = (val: number, total: number) => total > 0 ? (val / total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Tooltip Portal */}
      {tooltip && tooltip.visible && (
        <div 
          className="fixed z-[100] bg-brand-dark/95 backdrop-blur-sm text-white text-[10px] py-3 px-4 rounded-xl shadow-2xl border border-white/10 pointer-events-none min-w-[150px]"
          style={{ top: tooltip.y + 16, left: tooltip.x + 16 }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Filters and Summary */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
            <Filter className="w-3 h-3 text-brand-blue" /> Filtrar por Data
          </label>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold p-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue transition-all"
          />
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
           <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 min-w-[140px]">
              <p className="text-[10px] font-black text-brand-blue uppercase mb-1">Total Serviços</p>
              <p className="text-2xl font-black text-brand-dark">{totalServices}</p>
           </div>
           <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 min-w-[140px]">
              <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Total Remoções</p>
              <p className="text-2xl font-black text-emerald-700">{totalRemocoes}</p>
           </div>
        </div>
      </div>

      {/* NEW SECTION: Execution Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Services Execution */}
        <div className="bg-brand-blue rounded-[2.5rem] p-6 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingUp className="w-24 h-24 text-white" />
          </div>
          <h3 className="text-sm font-black text-white/80 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
            <CheckCircle2 className="w-4 h-4" /> Status dos Serviços
          </h3>
          
          <div className="relative z-10 grid grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-black text-blue-200 uppercase mb-1">Realizados</p>
              <p className="text-3xl font-black text-white">{executionStats.servicesDone}</p>
              <div className="w-full h-1.5 bg-brand-dark rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: `${getPercentage(executionStats.servicesDone, totalServices)}%` }}></div>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-200 uppercase mb-1">Pendentes</p>
              <p className="text-3xl font-black text-blue-100 opacity-60">{executionStats.servicesPending}</p>
              <div className="w-full h-1.5 bg-brand-dark rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-blue-400" style={{ width: `${getPercentage(executionStats.servicesPending, totalServices)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Removals Execution */}
        <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-200 relative overflow-hidden">
           <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
            <TrendingUp className="w-4 h-4 text-brand-blue" /> Execução de Remoções
          </h3>
          
          <div className="flex flex-col gap-4">
             <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-3">
                   <div className="bg-emerald-500 text-white p-2 rounded-lg">
                      <CheckCircle2 className="w-5 h-5" />
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-emerald-800 uppercase">Remoções Feitas</p>
                      <p className="text-xl font-black text-emerald-900">{executionStats.removalsDone}</p>
                   </div>
                </div>
                <p className="text-2xl font-black text-emerald-300 opacity-30">{getPercentage(executionStats.removalsDone, totalRemocoes).toFixed(0)}%</p>
             </div>

             <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                   <div className="bg-slate-300 text-slate-500 p-2 rounded-lg">
                      <XCircle className="w-5 h-5" />
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase">A Realizar</p>
                      <p className="text-xl font-black text-slate-700">{executionStats.removalsPending}</p>
                   </div>
                </div>
                 <p className="text-2xl font-black text-slate-300 opacity-50">{getPercentage(executionStats.removalsPending, totalRemocoes).toFixed(0)}%</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: Services */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
             <div className="bg-blue-500/10 p-2 rounded-lg">
                <BarChart3 className="w-5 h-5 text-brand-blue" />
             </div>
             <div>
               <h3 className="text-lg font-black text-slate-800 uppercase">Por Serviço</h3>
               <p className="text-xs text-slate-400 font-bold">Quantidade de agendamentos e remoções</p>
             </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Serviço</th>
                  <th className="px-6 py-4 text-center">Qtd. Itens</th>
                  <th className="px-6 py-4 text-center text-brand-blue">Total Remoções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {serviceStats.map((stat) => (
                  <tr 
                    key={stat.service} 
                    className="hover:bg-slate-50 transition-colors cursor-help"
                    onMouseMove={(e) => handleMouseMove(e, (
                      <div>
                        <div className="mb-3 border-b border-white/10 pb-2">
                           <span className="block text-brand-blue uppercase tracking-wider text-[8px] font-black mb-1">Status do Prazo</span>
                           <div className="grid grid-cols-2 gap-4">
                             <div>
                               <span className="block text-[8px] uppercase text-red-400 font-bold">Atrasados</span>
                               <span className="text-white text-base font-black">{stat.late}</span>
                             </div>
                             <div>
                               <span className="block text-[8px] uppercase text-emerald-400 font-bold">No Prazo</span>
                               <span className="text-white text-base font-black">{stat.onTime}</span>
                             </div>
                           </div>
                        </div>
                        <div>
                          <span className="block text-slate-400 uppercase tracking-wider text-[8px] font-black mb-0.5">Período de Referência</span>
                          <span className="text-white font-medium text-[10px]">{stat.dateLabel}</span>
                        </div>
                      </div>
                    ))}
                    onMouseLeave={handleMouseLeave}
                  >
                    <td className="px-6 py-4 font-bold text-slate-700">{stat.service}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-900">{stat.count}</td>
                    <td className="px-6 py-4 text-center font-black text-brand-blue">{stat.remocoes}</td>
                  </tr>
                ))}
                {serviceStats.length === 0 && (
                   <tr><td colSpan={3} className="p-8 text-center text-slate-400 text-xs font-bold uppercase">Sem dados para exibir</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Quadras */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
             <div className="bg-blue-500/10 p-2 rounded-lg">
                <PieChart className="w-5 h-5 text-brand-blue" />
             </div>
             <div>
               <h3 className="text-lg font-black text-slate-800 uppercase">Por Quadra</h3>
               <p className="text-xs text-slate-400 font-bold">Total acumulado de remoções (2 primeiros caracteres)</p>
             </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Quadra</th>
                  <th className="px-6 py-4 text-right text-brand-blue">Total Remoções</th>
                  <th className="px-6 py-4 w-1/3">Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {quadraStats.map((stat) => {
                   const percentage = totalRemocoes > 0 ? (stat.remocoes / totalRemocoes) * 100 : 0;
                   return (
                    <tr 
                      key={stat.quadra} 
                      className="hover:bg-slate-50 transition-colors cursor-help"
                      onMouseMove={(e) => handleMouseMove(e, (
                        <div>
                           <div className="mb-3">
                              <span className="block text-brand-blue uppercase tracking-wider text-[8px] font-black mb-1">Agendamentos</span>
                              <span className="text-white text-lg font-black">{stat.count} <span className="text-xs font-bold text-slate-400">Serviços</span></span>
                           </div>
                           <div className="pt-2 border-t border-white/10">
                              <span className="block text-slate-400 uppercase tracking-wider text-[8px] font-black mb-0.5">Período de Referência</span>
                              <span className="text-white font-medium text-[10px]">{stat.dateLabel}</span>
                           </div>
                        </div>
                      ))}
                      onMouseLeave={handleMouseLeave}
                    >
                      <td className="px-6 py-4 font-black font-mono text-slate-800 text-base">{stat.quadra}</td>
                      <td className="px-6 py-4 text-right font-black text-brand-blue">{stat.remocoes}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-blue rounded-full" style={{ width: `${percentage}%` }}></div>
                           </div>
                           <span className="text-[9px] font-bold text-slate-400">{percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                   );
                })}
                 {quadraStats.length === 0 && (
                   <tr><td colSpan={3} className="p-8 text-center text-slate-400 text-xs font-bold uppercase">Sem dados para exibir</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;