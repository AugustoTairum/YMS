import React, { useState, useMemo } from 'react';
import { ScheduleItem, SortConfig, PlanningState, StockItem } from '../types';
import { ArrowUpDown, CheckSquare, Square, ListChecks, Calendar } from 'lucide-react';

interface ServicesTabProps {
  data: ScheduleItem[];
  completedItems: Set<string>;
  onToggleComplete: (id: string) => void;
  planningState?: PlanningState;
}

const ServicesTab: React.FC<ServicesTabProps> = ({ data, completedItems, onToggleComplete, planningState }) => {
  const [filters, setFilters] = useState({
    importador: 'all',
    servico: 'all',
    doc: 'all',
    quadra: '',
    search: '',
    date: '',
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'agendamentoFull', direction: 'asc' });

  // Extract unique values for dropdowns
  const options = useMemo(() => ({
    importadores: [...new Set(data.map(i => i.importador))].sort(),
    servicos: [...new Set(data.map(i => i.servico))].sort(),
    docs: [...new Set(data.map(i => i.tipoDoc))].sort(),
  }), [data]);

  // Derived set of planned CNTRs for fast lookup
  const plannedCntrs = useMemo(() => {
    const set = new Set<string>();
    if (planningState) {
      Object.values(planningState).forEach((list: StockItem[]) => list.forEach(i => set.add(i.cntr)));
    }
    return set;
  }, [planningState]);

  const filteredData = useMemo(() => {
    return data.filter(i => {
      // Date Filter Logic
      let dateMatch = true;
      if (filters.date) {
        if (!i._rawDate) {
          dateMatch = false;
        } else {
          // Compare YYYY-MM-DD strings to ignore time/timezone issues for simple filtering
          const itemDate = new Date(i._rawDate.getTime() - (i._rawDate.getTimezoneOffset() * 60000))
            .toISOString()
            .split('T')[0];
          dateMatch = itemDate === filters.date;
        }
      }

      return dateMatch &&
             (filters.importador === 'all' || i.importador === filters.importador) &&
             (filters.servico === 'all' || i.servico === filters.servico) &&
             (filters.doc === 'all' || i.tipoDoc === filters.doc) &&
             (i.cntr.toLowerCase().includes(filters.search.toLowerCase())) &&
             (i.quadraFull.toLowerCase().includes(filters.quadra.toLowerCase()));
    }).sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];
      
      if (sortConfig.key === 'agendamentoFull') {
        valA = a._rawDate?.getTime() || 0;
        valB = b._rawDate?.getTime() || 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, filters, sortConfig]);

  const handleSort = (key: keyof ScheduleItem) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFilters = () => setFilters({ importador: 'all', servico: 'all', doc: 'all', quadra: '', search: '', date: '' });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        
        {/* Date Filter */}
        <div className="flex flex-col">
          <label className="text-[10px] font-black text-brand-blue ml-2 mb-1.5 uppercase flex items-center gap-1">
             <Calendar className="w-3 h-3" /> Data
          </label>
          <input 
            type="date"
            className="text-xs font-bold p-3 outline-none bg-slate-50 rounded-xl border border-slate-100 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-slate-600 uppercase"
            value={filters.date}
            onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
          />
        </div>

        {[
          { label: 'Importador', key: 'importador', opts: options.importadores },
          { label: 'Serviço', key: 'servico', opts: options.servicos },
          { label: 'Doc', key: 'doc', opts: options.docs }
        ].map((f) => (
          <div key={f.key} className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 ml-2 mb-1.5 uppercase">{f.label}</label>
            <select 
              className="text-xs font-bold p-3 outline-none bg-slate-50 rounded-xl border border-slate-100 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
              value={(filters as any)[f.key]}
              onChange={(e) => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
            >
              <option value="all">TODOS</option>
              {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}

        <div className="flex flex-col">
          <label className="text-[10px] font-black text-slate-400 ml-2 mb-1.5 uppercase">Quadra</label>
          <input 
            type="text" 
            placeholder="Ex: A, B..." 
            className="text-xs font-bold p-3 outline-none bg-slate-50 rounded-xl border border-slate-100 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
            value={filters.quadra}
            onChange={e => setFilters(prev => ({ ...prev, quadra: e.target.value }))}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] font-black text-brand-blue ml-2 mb-1.5 uppercase tracking-wide">Busca</label>
          <input 
            type="text" 
            placeholder="Contêiner..." 
            className="text-xs font-bold p-3 outline-none bg-slate-50 rounded-xl border border-slate-100 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <div className="flex items-end col-span-full md:col-span-6 lg:col-span-1">
          <button 
            onClick={clearFilters}
            className="w-full text-[10px] font-black bg-slate-100 text-slate-500 p-3.5 rounded-xl uppercase hover:bg-slate-200 transition-all"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-200">
        <table className="w-full text-left">
          <thead className="bg-brand-blue text-white text-[10px] uppercase tracking-widest font-black">
            <tr>
              <th className="px-6 py-6 text-center w-16 text-white/70">
                 <CheckSquare className="w-4 h-4 mx-auto" />
              </th>
              {[
                { k: 'importador', l: 'Importador' },
                { k: 'cntr', l: 'Contêiner' },
                { k: 'quadraFull', l: 'Quadra', c: 'text-white' },
                { k: 'servico', l: 'Serviço' },
                { k: 'remocoes', l: 'Remoções', align: 'center' },
                { k: 'agendamentoFull', l: 'Agendamento', c: 'text-white' }
              ].map((h) => (
                <th 
                  key={h.k} 
                  onClick={() => handleSort(h.k as keyof ScheduleItem)}
                  className={`px-8 py-6 cursor-pointer hover:bg-brand-dark transition-colors ${h.c || ''} ${h.align === 'center' ? 'text-center' : ''}`}
                >
                  <div className={`flex items-center gap-2 ${h.align === 'center' ? 'justify-center' : ''}`}>
                    {h.l} <ArrowUpDown className="w-3 h-3 opacity-50" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredData.map(item => {
              const isCompleted = completedItems.has(item.id);
              const isPlanned = plannedCntrs.has(item.cntr);

              return (
                <tr 
                  key={item.id} 
                  className={`transition-colors ${isCompleted ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-6 py-5 text-center">
                    <button 
                      onClick={() => onToggleComplete(item.id)}
                      className="hover:scale-110 transition-transform focus:outline-none"
                    >
                      {isCompleted ? (
                        <CheckSquare className="w-5 h-5 text-emerald-500 fill-emerald-100" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                      )}
                    </button>
                  </td>
                  <td className={`px-8 py-5 font-bold text-[10px] uppercase ${isCompleted ? 'text-emerald-700' : 'text-slate-500'}`}>{item.importador}</td>
                  
                  {/* CNTR Column with Planning Status Visual */}
                  <td className={`px-8 py-5 font-mono ${isCompleted ? 'text-emerald-900' : 'text-slate-800'}`}>
                    <div className="flex items-center gap-2">
                      <span className={isPlanned ? 'text-indigo-600 font-black' : 'font-black'}>
                        {item.cntr}
                      </span>
                      {isPlanned && (
                        <span className="bg-indigo-100 text-indigo-600 p-0.5 rounded" title="Já adicionado ao Planejamento">
                           <ListChecks className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-8 py-5 font-black text-brand-blue font-mono">{item.quadraFull}</td>
                  <td className="px-8 py-5 font-bold text-slate-600 text-[11px]">{item.servico}</td>
                  <td className="px-8 py-5 text-center font-black text-slate-800">{item.remocoes}</td>
                  <td className="px-8 py-5 font-black text-brand-dark text-[11px]">{item.agendamentoFull}</td>
                </tr>
              );
            })}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-10 text-center text-slate-400 font-bold uppercase text-xs">Nenhum registro encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ServicesTab;