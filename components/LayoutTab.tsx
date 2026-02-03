import React, { useMemo } from 'react';
import { StockItem } from '../types';
import { Map, ArrowRightCircle, Layers } from 'lucide-react';

interface LayoutTabProps {
  layoutCsv: string; // Ignored
  onLayoutUpload: (csv: string) => void; // Ignored
  stockData: StockItem[];
  navigateToPlanning: (quadra: string) => void;
}

// Reusing the service color logic for consistency
const getServiceColor = (service: string) => {
  const s = service ? service.toUpperCase() : 'N/I';
  
  if (s.includes('VAZIO')) return 'bg-yellow-400 text-yellow-950 border-yellow-500';
  if (s.includes('IMPORT')) return 'bg-orange-500 text-white border-orange-600';
  if (s.includes('EXPORT') || s.includes('EMBARQUE')) return 'bg-blue-600 text-white border-blue-700';
  if (s.includes('TRANS')) return 'bg-purple-500 text-white border-purple-600';
  if (s.includes('DTA')) return 'bg-cyan-400 text-cyan-950 border-cyan-500';
  if (s.includes('REEFER') || s.includes('RFR')) return 'bg-emerald-600 text-white border-emerald-700';
  if (s.includes('DEVOLUCAO')) return 'bg-rose-500 text-white border-rose-600';
  if (s.includes('SEM AGENDAMENTO') || s === 'N/I' || s === 'OUTROS') return 'bg-slate-300 text-slate-600 border-slate-400';
  
  // Hash for consistent random colors
  const colors = [
    'bg-teal-500 text-white border-teal-600',
    'bg-indigo-500 text-white border-indigo-600',
    'bg-pink-500 text-white border-pink-600',
    'bg-lime-500 text-white border-lime-600',
    'bg-fuchsia-500 text-white border-fuchsia-600',
  ];
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Helper to parse Row (Letter A-F) from local string
// Returns 0-5 index (A=0, F=5)
const getRowIndex = (local: string) => {
  if (!local || local.length < 2) return 0;
  const rowChar = local.slice(-2, -1).toUpperCase();
  const code = rowChar.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65; // A=0, B=1...
  // Fallback for numeric rows if any
  const num = parseInt(rowChar);
  return !isNaN(num) && num > 0 ? num - 1 : 0;
};

// Helper to parse Tier (Number 1-6)
const getTier = (local: string) => {
  if (!local) return 1;
  const t = parseInt(local.slice(-1));
  return isNaN(t) ? 1 : t;
};

const LayoutTab: React.FC<LayoutTabProps> = ({ stockData, navigateToPlanning }) => {
  
  const yardStructure = useMemo(() => {
    // Structure: Quadra -> Bay -> RowIndex (0-5) -> Items[]
    const structure: Record<string, Record<string, Record<number, StockItem[]>>> = {};
    
    stockData.forEach(item => {
       const q = item.quadra;
       const b = item.bay;
       if (!q || !b) return;

       if (!structure[q]) structure[q] = {};
       if (!structure[q][b]) structure[q][b] = {};
       
       const rIdx = getRowIndex(item.local);
       if (!structure[q][b][rIdx]) structure[q][b][rIdx] = [];
       
       structure[q][b][rIdx].push(item);
    });

    return structure;
  }, [stockData]);

  const sortedQuadras = useMemo(() => Object.keys(yardStructure).sort(), [yardStructure]);

  // Standard Yard Rows: F (Top) to A (Bottom) visually
  // Indices: A=0, B=1, C=2, D=3, E=4, F=5
  // Display Order: 5, 4, 3, 2, 1, 0
  const ROW_INDICES = [5, 4, 3, 2, 1, 0];
  const ROW_LABELS = ['F', 'E', 'D', 'C', 'B', 'A']; // Corresponding labels for 5..0

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
           <div className="bg-brand-blue p-3 rounded-2xl shadow-lg shadow-blue-500/20">
              <Map className="w-8 h-8 text-white" />
           </div>
           <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Mapa do Pátio</h2>
              <p className="text-xs text-slate-500 font-bold mt-1">
                Visão Top-Down (Matriz). Linhas representam as Bays, Colunas os Rows (Lastros).
              </p>
           </div>
        </div>
      </div>

      {sortedQuadras.length === 0 ? (
         <div className="flex flex-col items-center justify-center py-32 bg-slate-100 rounded-[2.5rem] border-2 border-dashed border-slate-300">
            <Layers className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-400 font-bold uppercase text-sm">Carregue o arquivo de estoque para visualizar o mapa.</p>
         </div>
      ) : (
        <div className="space-y-12">
          {sortedQuadras.map(quadraName => {
             const baysData = yardStructure[quadraName];
             
             // Sort bays numerically
             const sortedBays = Object.keys(baysData).sort((a, b) => {
               const numA = parseInt(a.replace(/\D/g, ''));
               const numB = parseInt(b.replace(/\D/g, ''));
               if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
               return a.localeCompare(b);
             });

             const totalItemsInQuadra = Object.values(baysData)
                .flatMap(rows => Object.values(rows).flat()).length;

             return (
               <div key={quadraName} className="bg-white p-4 pt-6 rounded-[2rem] border border-slate-200 shadow-sm relative group overflow-hidden">
                  
                  {/* Quadra Label */}
                  <div className="flex items-center gap-4 mb-4 px-2">
                     <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-slate-800 tracking-tighter uppercase">QUADRA {quadraName}</span>
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border border-slate-200">{totalItemsInQuadra} CNTRs</span>
                     </div>
                     <div className="h-px bg-slate-100 flex-1"></div>
                     <button 
                       onClick={() => navigateToPlanning(quadraName)}
                       className="bg-brand-blue hover:bg-brand-dark text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-2 hover:scale-105 active:scale-95"
                     >
                       Planejar <ArrowRightCircle className="w-3 h-3" />
                     </button>
                  </div>

                  {/* SCROLLABLE MATRIX */}
                  <div className="overflow-x-auto custom-scrollbar pb-4 px-2">
                     <div className="inline-block min-w-full">
                        {/* HEADER ROW (Bay Numbers) */}
                        <div className="flex ml-8 mb-1 gap-1">
                           {sortedBays.map(bay => (
                              <div key={bay} className="w-8 text-center shrink-0">
                                 <span className="text-[9px] font-black text-slate-400 -rotate-45 block origin-bottom-left translate-x-2">
                                    {bay.replace(/[A-Z]/g, '')}
                                 </span>
                              </div>
                           ))}
                        </div>

                        {/* GRID ROWS (A-F) */}
                        <div className="flex flex-col gap-1">
                           {ROW_INDICES.map((rIdx, i) => (
                              <div key={rIdx} className="flex items-center gap-1 h-8">
                                 {/* Row Label (Left) */}
                                 <div className="w-8 shrink-0 flex items-center justify-center">
                                    <span className="text-[10px] font-black text-slate-400">{ROW_LABELS[i]}</span>
                                 </div>

                                 {/* Cells for this Row across all Bays */}
                                 {sortedBays.map(bay => {
                                    const itemsInSlot = baysData[bay][rIdx] || [];
                                    const count = itemsInSlot.length;
                                    
                                    // Determine display:
                                    // Empty? -> Gray dash or empty box
                                    // Occupied? -> Color of top item (highest tier) + Number (height)
                                    let cellContent = null;
                                    let cellClass = "bg-slate-50 border-slate-200";

                                    if (count > 0) {
                                       // Find max tier item for color
                                       const topItem = itemsInSlot.reduce((prev, curr) => 
                                          getTier(curr.local) > getTier(prev.local) ? curr : prev
                                       , itemsInSlot[0]);
                                       
                                       const colorClass = getServiceColor(topItem.servico);
                                       cellClass = `${colorClass} border-transparent shadow-sm hover:brightness-110`;
                                       cellContent = (
                                          <span className="text-[10px] font-black">{count}</span>
                                       );
                                    }

                                    return (
                                       <div 
                                          key={`${bay}-${rIdx}`} 
                                          className={`w-8 h-8 shrink-0 rounded border flex items-center justify-center transition-all cursor-default relative group/cell ${cellClass}`}
                                       >
                                          {cellContent}
                                          
                                          {/* Tooltip */}
                                          {count > 0 && (
                                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[9px] p-2 rounded z-20 hidden group-hover/cell:block min-w-[120px] pointer-events-none shadow-xl">
                                                <div className="font-black border-b border-white/20 mb-1 pb-1">BAY {bay} - ROW {ROW_LABELS[i]}</div>
                                                {itemsInSlot.sort((a,b) => getTier(b.local) - getTier(a.local)).map(item => (
                                                   <div key={item.id} className="flex justify-between gap-2 opacity-90">
                                                      <span>T{getTier(item.local)}: {item.cntr}</span>
                                                   </div>
                                                ))}
                                             </div>
                                          )}
                                       </div>
                                    );
                                 })}
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
             );
          })}
        </div>
      )}
    </div>
  );
};

export default LayoutTab;