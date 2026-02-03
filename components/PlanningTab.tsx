import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StockItem, PlanningState, ConfigState, StackerId } from '../types';
import { Layers, ChevronDown, LayoutGrid, Clock, Trash2, Search, Download, MoveDown, Maximize2, X, Container, Map as MapIcon, ArrowRight, ArrowUpFromLine, Info, CheckCircle } from 'lucide-react';

interface PlanningTabProps {
  stockData: StockItem[];
  planningState: PlanningState;
  setPlanningState: React.Dispatch<React.SetStateAction<PlanningState>>;
  setStockData: React.Dispatch<React.SetStateAction<StockItem[]>>;
  targetQuadra?: string | null;
}

const STORAGE_KEY_CONFIG = 'yard_management_stacker_config';

const getServiceColor = (service: string) => {
  const s = service ? service.toUpperCase() : 'N/I';
  
  // Specific semantic overrides
  if (s.includes('VAZIO')) return 'bg-yellow-400 border-yellow-600 text-yellow-950 font-black';
  if (s.includes('IMPORT')) return 'bg-orange-500 border-orange-700 text-white font-black';
  if (s.includes('EXPORT') || s.includes('EMBARQUE')) return 'bg-blue-600 border-blue-800 text-white font-black';
  if (s.includes('TRANS')) return 'bg-purple-500 border-purple-700 text-white font-black';
  if (s.includes('DTA')) return 'bg-cyan-400 border-cyan-600 text-cyan-950 font-black';
  if (s.includes('REEFER') || s.includes('RFR')) return 'bg-emerald-600 border-emerald-800 text-white font-black';
  if (s.includes('DEVOLUCAO')) return 'bg-rose-500 border-rose-700 text-white font-black';
  
  if (s.includes('SEM AGENDAMENTO') || s === 'N/I' || s === 'OUTROS') return 'bg-slate-200 border-slate-300 text-slate-500 font-bold';
  
  // Dynamic color generation for other services to ensure distinction
  const colors = [
    'bg-teal-500 border-teal-700 text-white',
    'bg-indigo-500 border-indigo-700 text-white',
    'bg-pink-500 border-pink-700 text-white',
    'bg-lime-500 border-lime-700 text-white',
    'bg-fuchsia-500 border-fuchsia-700 text-white',
    'bg-sky-500 border-sky-700 text-white',
    'bg-amber-500 border-amber-700 text-white',
    'bg-violet-500 border-violet-700 text-white',
    'bg-red-500 border-red-700 text-white',
  ];
  
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index] + ' font-black';
};

// Helper to parse Row (Penultimate) and Tier (Last)
// Rules: 
// Height (Tier) = 1 to 6 (Last char)
// Row (Lastro) = A, B, C, D, E, F (Penultimate char)
const parsePosition = (local: string) => {
  if (!local || local.length < 2) return { row: 0, tier: 1 }; // 0-based row index (A=0), 1-based tier
  
  const tierChar = local.slice(-1);
  const rowChar = local.slice(-2, -1).toUpperCase();
  
  // Parse Tier (1-6)
  let tier = parseInt(tierChar);
  if (isNaN(tier)) tier = 1;

  // Parse Row (A-F)
  // If char is A-Z
  let row = 0;
  const code = rowChar.charCodeAt(0);
  
  if (code >= 65 && code <= 90) { // Is Letter A-Z
    row = code - 65; // A=0, B=1, C=2, etc.
  } else {
    // Fallback: if it represents a number (e.g. 1 -> A)
    const num = parseInt(rowChar);
    if (!isNaN(num) && num > 0) {
      row = num - 1;
    }
  }

  // Cap limits (Row F is index 5, Tier 6)
  return { 
    row: Math.max(0, Math.min(5, row)), 
    tier: Math.max(1, Math.min(6, tier)) 
  };
};

const PlanningTab: React.FC<PlanningTabProps> = ({ stockData, planningState, setPlanningState, setStockData, targetQuadra }) => {
  const [activeStacker, setActiveStacker] = useState<StackerId>('1');
  
  // Initialize config from localStorage or use default
  const [config, setConfig] = useState<ConfigState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load stacker config from storage:', error);
    }
    return {
      '1': { start: '08:00', mph: 15 },
      '2': { start: '08:00', mph: 15 },
      '3': { start: '08:00', mph: 15 },
    };
  });

  const [expandedBays, setExpandedBays] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  
  // State to track if a drag operation is active for visual feedback
  const [isDragging, setIsDragging] = useState(false);
  
  // Modal State for Quadra View (Whole Block)
  const [viewQuadra, setViewQuadra] = useState<string | null>(null);
  const [initialScrollBay, setInitialScrollBay] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Derived set of all currently planned items (across all stackers) for highlighting
  const allPlannedIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(planningState).forEach((list: StockItem[]) => {
      list.forEach(i => set.add(i.id));
    });
    return set;
  }, [planningState]);

  // Persist config changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  }, [config]);

  // Handle auto-scroll in modal
  useEffect(() => {
    if (viewQuadra && initialScrollBay && scrollContainerRef.current) {
      const bayElement = document.getElementById(`modal-bay-${initialScrollBay}`);
      if (bayElement) {
        // Small timeout to ensure rendering
        setTimeout(() => {
          bayElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 100);
      }
      // Reset after scrolling attempt
      setInitialScrollBay(null);
    }
  }, [viewQuadra, initialScrollBay]);

  // Group Data for Tree View with Filtering
  const stockTree = useMemo(() => {
    const groups: Record<string, Record<string, StockItem[]>> = {};
    const term = stockSearchTerm.toUpperCase().trim();

    // Filter items first
    const filteredItems = term 
      ? stockData.filter(item => 
          item.cntr.includes(term) || 
          (item.servico && item.servico.toUpperCase().includes(term))
        )
      : stockData;

    filteredItems.forEach(item => {
      if (!groups[item.quadra]) groups[item.quadra] = {};
      if (!groups[item.quadra][item.bay]) groups[item.quadra][item.bay] = [];
      groups[item.quadra][item.bay].push(item);
    });
    return groups;
  }, [stockData, stockSearchTerm]);

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, items: StockItem[]) => {
    e.dataTransfer.setData('application/json', JSON.stringify(items));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  // Handle Drag End (cleanup if dropped outside or cancelled)
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    try {
      const items = JSON.parse(e.dataTransfer.getData('application/json')) as StockItem[];
      setPlanningState(prev => ({
        ...prev,
        [activeStacker]: [...prev[activeStacker], ...items]
      }));
      setStockData(prev => prev.filter(s => !items.find(i => i.id === s.id)));
    } catch (err) {
      console.error("Drop failed", err);
    }
  };

  const handleRemoveFromPlan = (itemId: string) => {
    const item = planningState[activeStacker].find(i => i.id === itemId);
    if (!item) return;

    setStockData(prev => [...prev, item]);
    setPlanningState(prev => ({
      ...prev,
      [activeStacker]: prev[activeStacker].filter(i => i.id !== itemId)
    }));
  };

  const handleClearPlan = () => {
    const items = planningState[activeStacker];
    setStockData(prev => [...prev, ...items]);
    setPlanningState(prev => ({ ...prev, [activeStacker]: [] }));
  };

  // Calculations
  const currentPlan = planningState[activeStacker];
  const activeConfig = config[activeStacker];
  const totalMoves = currentPlan.length;
  const mph = activeConfig.mph || 1;
  const totalMinutes = (totalMoves / mph) * 60;
  
  const getEstimatedTime = (index: number) => {
    const startTime = new Date(`2026-01-01T${activeConfig.start}:00`);
    const minutesToAdd = (index * (60 / mph));
    startTime.setMinutes(startTime.getMinutes() + minutesToAdd);
    return startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleExportPlan = () => {
    if (currentPlan.length === 0) {
      alert("Não há contêineres no planejamento para exportar.");
      return;
    }

    const headers = ['SEQ', 'HORA_ESTIMADA', 'CNTR', 'SERVICO', 'LOCAL_ATUAL', 'QUADRA'];
    const rows = currentPlan.map((item, index) => {
      const time = getEstimatedTime(index);
      return [
        index + 1,
        time,
        item.cntr,
        item.servico,
        item.local,
        item.quadra
      ].join(';'); // Using semicolon for CSV mostly used in BR/Excel
    });

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(';'), ...rows].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Planejamento_Stacker_${activeStacker}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Search Logic
  const searchResultIndex = useMemo(() => {
    if (!searchTerm) return -1;
    return currentPlan.findIndex(i => i.cntr.includes(searchTerm.toUpperCase()));
  }, [searchTerm, currentPlan]);

  // Summary Logic
  const baySummary = useMemo(() => {
    return currentPlan.reduce((acc: Record<string, number>, curr) => {
      const b = curr.bay;
      const currentCount = acc[b] ?? 0;
      acc[b] = currentCount + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [currentPlan]);

  // Construct Data for Quadra View
  const quadraViewData = useMemo(() => {
    if (!viewQuadra) return [];

    // Filter items belonging to this Quadra
    // Includes both items currently in stock AND items in the plan (so we can show the highlighted position)
    // However, the prompt implies "ao abrir a visualização da bay, os cntr que estao na lista do quadro da direita"
    // Usually, if an item is moved to the plan (right side), it is removed from 'stockData' in the parent state.
    // To show them in the grid "highlighted", we need to virtually put them back into the grid calculation if they belong to this quadra.
    
    const plannedItemsInQuadra = (Object.values(planningState).flat() as StockItem[]).filter(i => i.quadra === viewQuadra);
    const allItems = [...stockData.filter(i => i.quadra === viewQuadra), ...plannedItemsInQuadra];
    
    // Group by Bay
    const bays: Record<string, StockItem[]> = {};
    allItems.forEach(i => {
      if (!bays[i.bay]) bays[i.bay] = [];
      bays[i.bay].push(i);
    });

    // Create Grid for each Bay
    return Object.keys(bays).sort().map(bayName => {
      const bayItems = bays[bayName];
      // 6 Rows (A-F) x 6 Tiers (1-6)
      const grid: (StockItem | null)[][] = Array(6).fill(null).map(() => Array(6).fill(null));

      bayItems.forEach(item => {
        const { row, tier } = parsePosition(item.local);
        
        // Visual Mapping:
        // row is 0-5 (A-F)
        // tier is 1-6
        // visualRow (col index) = row
        // visualTier (row index) = 6 - tier (Tier 6 is index 0)
        
        const visualRow = row;
        const visualTier = 6 - tier;
        
        // Safety check indices
        if (visualTier >= 0 && visualTier < 6 && visualRow >= 0 && visualRow < 6) {
           if (grid[visualTier][visualRow] === null) {
              grid[visualTier][visualRow] = item;
           } else {
             // Basic collision resolution
             let placed = false;
             for(let t = 5; t >= 0; t--) {
               if(placed) break;
               for(let r = 0; r < 6; r++) {
                 if(grid[t][r] === null) {
                   grid[t][r] = item;
                   placed = true;
                   break;
                 }
               }
             }
           }
        }
      });

      return {
        bayName,
        grid,
        total: bayItems.length
      };
    });

  }, [viewQuadra, stockData, planningState]);

  // Dynamic Legend Data based on viewQuadra
  const quadraServices = useMemo(() => {
    if (!viewQuadra) return [];
    
    // Gather all services in the current quadra
    const services = new Set<string>();
    quadraViewData.forEach(bay => {
       bay.grid.forEach(row => {
          row.forEach(item => {
             if (item && item.servico) {
                services.add(item.servico);
             }
          });
       });
    });
    
    return Array.from(services).sort();
  }, [quadraViewData, viewQuadra]);

  const handleOpenBayView = (quadra: string, bayName: string) => {
     setViewQuadra(quadra);
     setInitialScrollBay(bayName);
  };

  const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
        {/* LEFT COLUMN: STOCK TREE */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-blue" /> Estoque Atual
            </h3>
            <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded-lg text-slate-500 uppercase">
              {Object.values(stockTree).flatMap(b => Object.values(b).flat()).length} Unidades
            </span>
          </div>

          {/* STOCK FILTER INPUT */}
          <div className="mb-4 shrink-0 relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
            <input
              type="text"
              placeholder="Buscar CNTR ou Serviço..."
              value={stockSearchTerm}
              onChange={(e) => setStockSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all uppercase placeholder:normal-case"
            />
            {stockSearchTerm && (
              <button 
                onClick={() => setStockSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {Object.keys(stockTree).length === 0 ? (
               <div className="flex flex-col items-center justify-center h-40 text-center opacity-50">
                  <Container className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Nenhum item encontrado</p>
               </div>
            ) : (
              Object.entries(stockTree).sort().map(([qName, bays]) => (
                <div 
                  key={qName} 
                  id={`quadra-${qName}`}
                  className={`mb-2 border border-slate-100 rounded-2xl overflow-hidden shadow-sm transition-colors duration-500 ${targetQuadra === qName ? 'bg-blue-50 ring-2 ring-brand-blue' : ''}`}
                >
                  <div className="bg-slate-100 p-3 flex justify-between items-center group">
                    <span className="text-[10px] font-black text-slate-600 uppercase">QUADRA {qName}</span>
                    <button 
                      onClick={() => setViewQuadra(qName)}
                      className="bg-white p-1.5 rounded-lg shadow-sm text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-blue hover:text-white"
                      title="Visualizar Mapa da Quadra"
                    >
                      <MapIcon className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div className="p-1 space-y-1 bg-white">
                    {Object.entries(bays).sort().map(([bName, units]) => {
                      const bayId = `bay-${bName.replace(/\s/g, '')}`;
                      // Auto-expand if searching
                      const isOpen = expandedBays[bayId] || (stockSearchTerm.length > 0);
                      // Sort by position (vertical stack)
                      const sortedUnits = [...units].sort((a, b) => b.pos.localeCompare(a.pos));
                      
                      return (
                        <div key={bayId} className="border border-slate-50 rounded-xl overflow-hidden">
                          <div className="w-full flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-all">
                            <button 
                              onClick={() => setExpandedBays(prev => ({ ...prev, [bayId]: !prev[bayId] }))}
                              className="flex items-center gap-2 flex-1 text-left"
                            >
                              <LayoutGrid className="w-3 h-3 text-brand-blue" />
                              <span className="text-[11px] font-black text-slate-800 uppercase">BAY {bName}</span>
                              <span className="text-[9px] bg-blue-100 text-brand-blue px-1.5 rounded-md">{units.length} UN</span>
                            </button>
                            
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleOpenBayView(qName, bName)}
                                className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors mr-1"
                                title="Visualizar Grade"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setExpandedBays(prev => ({ ...prev, [bayId]: !prev[bayId] }))}
                              >
                                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                          </div>
                          
                          <div className={`transition-all duration-300 ease-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="p-2 space-y-2 bg-slate-50/50">
                              {sortedUnits.map((u, idx) => (
                                <div 
                                  key={u.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, sortedUnits.slice(0, idx + 1))}
                                  onDragEnd={handleDragEnd}
                                  className="p-3 bg-white border border-slate-200 rounded-xl cursor-grab hover:border-brand-blue shadow-sm transition-all active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5"
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <p className="font-mono text-xs font-black text-slate-900">{u.cntr}</p>
                                    <span className="text-[9px] font-black text-white bg-slate-950 px-2 rounded-md uppercase">{u.local}</span>
                                  </div>
                                  <p className="text-[8px] font-black text-brand-blue uppercase truncate">{u.servico}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: STACKER PLAN */}
        <div className="col-span-12 lg:col-span-8 flex flex-col h-full gap-4 overflow-hidden">
          {/* CONTROLS */}
          <div className="bg-brand-blue p-6 rounded-[2.5rem] flex flex-wrap items-center justify-between gap-4 shadow-xl border-b-4 border-white/20 shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-white/70 uppercase mb-1">Stacker</label>
                <select 
                  value={activeStacker}
                  onChange={(e) => setActiveStacker(e.target.value as StackerId)}
                  className="bg-brand-dark border border-white/10 text-white text-xs font-black p-2.5 rounded-xl outline-none min-w-[140px]"
                >
                  <option value="1">STACKER 01</option>
                  <option value="2">STACKER 02</option>
                  <option value="3">STACKER 03</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-white/70 uppercase mb-1">Início</label>
                <input 
                  type="time" 
                  value={activeConfig.start}
                  onChange={(e) => setConfig(prev => ({ ...prev, [activeStacker]: { ...prev[activeStacker], start: e.target.value } }))}
                  className="bg-brand-dark border border-white/10 text-white text-xs p-2.5 rounded-xl outline-none" 
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-white/70 uppercase mb-1">MPH</label>
                <input 
                  type="number" 
                  value={activeConfig.mph}
                  onChange={(e) => setConfig(prev => ({ ...prev, [activeStacker]: { ...prev[activeStacker], mph: parseInt(e.target.value) || 1 } }))}
                  className="bg-brand-dark border border-white/10 text-white text-xs p-2.5 w-16 rounded-xl outline-none font-black text-center" 
                />
              </div>
              
              <div className="flex flex-col justify-center px-4 border-l border-white/10 h-10">
                <div className="leading-none text-right">
                  <span className="text-white font-black text-xs block">{totalMoves} REMOÇÕES</span>
                  <span className="text-white/60 font-bold text-[9px] uppercase tracking-wide block mt-1">
                    {Math.floor(totalMinutes / 60)}h {Math.round(totalMinutes % 60)}m DURAÇÃO
                  </span>
                </div>
              </div>

              <div className="flex flex-col ml-2 border-l border-white/10 pl-4 hidden md:flex">
                <label className="text-[9px] font-black text-white/60 uppercase mb-1">Localizar CNTR</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Digite..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-brand-dark border border-white/10 text-white text-xs p-2.5 w-24 rounded-xl outline-none uppercase placeholder:text-white/30" 
                  />
                  {searchTerm && (
                    <div className="flex flex-col leading-none">
                       {searchResultIndex !== -1 ? (
                          <>
                            <span className="text-emerald-400 font-black text-[10px] uppercase">SEQ: #{searchResultIndex + 1}</span>
                            <span className="text-white font-bold text-xs">PREV: {getEstimatedTime(searchResultIndex)}</span>
                          </>
                       ) : (
                          <span className="text-red-500 font-black text-[9px]">N/A</span>
                       )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
               <button 
                  onClick={handleExportPlan} 
                  className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest border border-emerald-600 shadow-lg flex items-center gap-2 active:scale-95"
                  title="Exportar plano para CSV"
               >
                  <Download className="w-3 h-3" /> Exportar
               </button>
               <button onClick={handleClearPlan} className="bg-red-500/10 hover:bg-red-500 text-white/80 hover:text-white px-6 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest border border-red-500/20 active:scale-95">
                  Limpar
               </button>
            </div>
          </div>

          {/* DROP ZONE */}
          <div 
            className={`
              flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3 shadow-inner rounded-[2rem] border-2 transition-all duration-300 relative
              ${isDragging 
                ? 'border-brand-blue border-dashed bg-blue-50/50 ring-4 ring-brand-blue/10' 
                : 'border-slate-300 border-dashed bg-slate-100'}
            `}
            onDragOver={(e) => { 
              e.preventDefault(); 
              e.dataTransfer.dropEffect = 'move';
              e.currentTarget.classList.add('bg-blue-100', 'border-brand-blue'); 
            }}
            onDragLeave={(e) => { 
              e.currentTarget.classList.remove('bg-blue-100', 'border-brand-blue'); 
            }}
            onDrop={(e) => { 
              e.currentTarget.classList.remove('bg-blue-100', 'border-brand-blue'); 
              handleDrop(e); 
            }}
          >
            {/* Overlay Message when Dragging */}
            {isDragging && currentPlan.length > 0 && (
               <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
                  <div className="bg-brand-blue text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
                     <MoveDown className="w-5 h-5" />
                     <span className="font-black text-xs uppercase tracking-widest">Solte aqui para planejar</span>
                  </div>
               </div>
            )}

            {currentPlan.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full transition-opacity duration-300 ${isDragging ? 'opacity-100' : 'opacity-60'}`}>
                <div className={`p-4 rounded-full mb-4 ${isDragging ? 'bg-brand-blue text-white animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
                  <MoveDown className="w-8 h-8" />
                </div>
                <p className={`font-black uppercase text-xs ${isDragging ? 'text-brand-blue' : 'text-slate-400'}`}>
                  {isDragging ? 'Solte para adicionar ao plano' : 'Arraste contêineres do estoque para cá'}
                </p>
              </div>
            ) : (
              currentPlan.map((u, idx) => {
                const isSearched = searchResultIndex === idx;
                return (
                  <div 
                    key={u.id} 
                    id={`slot-card-${u.id}`}
                    className={`p-4 bg-white border rounded-[2rem] flex justify-between items-center shadow-lg transition-all duration-300 ${isSearched ? 'ring-4 ring-brand-blue scale-105 z-10' : 'border-slate-100'}`}
                    ref={el => { if(isSearched && el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-brand-blue text-white px-4 py-2 rounded-2xl font-black text-sm w-20 text-center shadow-md">
                        {getEstimatedTime(idx)}
                      </div>
                      <div>
                        <p className="font-mono font-black text-slate-900 text-lg leading-none">{u.cntr}</p>
                        <p className="text-[9px] font-black text-brand-blue uppercase">{u.servico}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-900 uppercase">{u.local}</p>
                      <button onClick={() => handleRemoveFromPlan(u.id)} className="text-red-500 text-[9px] font-black uppercase mt-1 flex items-center justify-end gap-1 hover:text-red-700">
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* SUMMARY FOOTER */}
          <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm shrink-0">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="w-3 h-3 text-brand-blue" /> Resumo de Produtividade por Bay
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
               {/* Simple summary calculation */}
               {Object.entries(baySummary).map(([bay, count]) => (
                  <div key={bay} className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col items-center">
                     <span className="text-[9px] font-black text-slate-400 uppercase">BAY</span>
                     <span className="text-xs font-black text-slate-900">{bay}</span>
                     <div className="w-full h-px bg-slate-200 my-1.5"></div>
                     <span className="text-[10px] font-black text-brand-blue">{count} REMS</span>
                     <span className="text-[8px] font-bold text-slate-500">~{Math.round((Number(count) / mph) * 60)} MIN</span>
                  </div>
               ))}
               {currentPlan.length === 0 && <p className="text-[10px] text-slate-400 font-bold uppercase col-span-full text-center">Nenhum dado</p>}
            </div>
          </div>
        </div>
      </div>

      {/* QUADRA VIEW MODAL */}
      {viewQuadra && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-brand-dark/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-[95vw] h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
             {/* HEADER */}
             <div className="bg-brand-blue p-6 flex flex-col md:flex-row items-center justify-between shrink-0 shadow-md z-10 gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <MapIcon className="w-6 h-6 text-blue-200" />
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">QUADRA {viewQuadra}</h3>
                  </div>
                  <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest ml-9">
                    {quadraViewData.reduce((acc, b) => acc + b.total, 0)} UNIDADES &bull; {quadraViewData.length} BAYS
                  </p>
                </div>
                
                {/* DYNAMIC LEGEND */}
                <div className="flex flex-wrap items-center justify-center gap-2 bg-black/10 p-2 rounded-xl max-w-[50%] overflow-y-auto max-h-[60px] custom-scrollbar">
                   {quadraServices.map(serviceName => (
                      <div key={serviceName} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] uppercase shadow-sm ${getServiceColor(serviceName)}`}>
                         <span className="max-w-[100px] truncate">{serviceName}</span>
                      </div>
                   ))}
                   {quadraServices.length === 0 && <span className="text-[9px] text-white/50">Sem serviços identificados</span>}
                </div>

                <button 
                  onClick={() => setViewQuadra(null)}
                  className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-2xl transition-colors hover:rotate-90 duration-300"
                >
                  <X className="w-6 h-6" />
                </button>
             </div>

             {/* SCROLLABLE CONTENT */}
             <div 
                ref={scrollContainerRef}
                className="flex-1 bg-slate-200 overflow-x-auto overflow-y-hidden custom-scrollbar flex items-center px-8 py-4 gap-6"
             >
                {quadraViewData.map((bayData) => (
                   <div 
                      key={bayData.bayName} 
                      id={`modal-bay-${bayData.bayName}`}
                      className="bg-white p-4 rounded-3xl shadow-lg border border-slate-300 flex-shrink-0 flex flex-col items-center min-w-[360px]"
                   >
                      <div className="mb-3 flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full w-full justify-between">
                         <span className="text-xs font-black text-slate-700 uppercase">BAY {bayData.bayName}</span>
                         <span className="text-[9px] font-bold text-slate-400">{bayData.total} UN</span>
                      </div>
                      
                      {/* GRID */}
                      <div className="flex flex-col gap-1 w-full">
                         {/* Header Rows (A-F) */}
                         <div className="grid grid-cols-7 gap-1 mb-1">
                            <div className="w-12"></div> {/* Tier Label Spacer */}
                            {ROW_LABELS.map(c => (
                              <div key={c} className="h-6 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase bg-slate-50 rounded">{c}</div>
                            ))}
                         </div>

                         {bayData.grid.map((rowItems, tierIdx) => (
                            <div key={tierIdx} className="grid grid-cols-7 gap-1 h-14">
                               <div className="flex items-center justify-center text-[10px] font-black text-slate-400 bg-slate-50 rounded">
                                  {6 - tierIdx}
                               </div>
                               {rowItems.map((item, colIdx) => {
                                  const isPlanned = item && allPlannedIds.has(item.id);
                                  
                                  return (
                                    <div key={colIdx} className="w-full h-full relative">
                                       {item ? (
                                          <div 
                                             draggable
                                             onDragStart={(e) => handleDragStart(e, [item])}
                                             onDragEnd={handleDragEnd}
                                             className={`w-full h-full rounded shadow-sm border p-1 flex flex-col justify-between cursor-grab active:cursor-grabbing hover:scale-110 hover:z-20 hover:shadow-xl transition-all relative ${getServiceColor(item.servico)} ${isPlanned ? 'ring-4 ring-indigo-500 z-50 border-white' : ''}`}
                                             title={`${item.cntr} - ${item.servico}`}
                                          >
                                             <div className="flex justify-between items-start leading-none">
                                                <span className="text-[8px] font-black tracking-tighter truncate w-full opacity-90">{item.servico.substring(0, 3)}</span>
                                             </div>
                                             <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[9px] font-black tracking-tighter drop-shadow-sm">{item.cntr.substring(0, 4)}</span>
                                             </div>
                                             <div className="text-right leading-none">
                                                <span className="block text-[8px] font-bold opacity-80">{item.cntr.slice(-4)}</span>
                                             </div>
                                             
                                             {/* HIGHLIGHT INDICATOR */}
                                             {isPlanned && (
                                                <div className="absolute -top-1 -right-1 bg-white text-indigo-600 rounded-full p-0.5 shadow-sm">
                                                   <CheckCircle className="w-2.5 h-2.5" />
                                                </div>
                                             )}
                                          </div>
                                       ) : (
                                         <div className="w-full h-full border border-dashed border-slate-200 rounded bg-slate-50/50"></div>
                                       )}
                                    </div>
                                  );
                               })}
                            </div>
                         ))}
                      </div>

                      <div className="mt-3 w-full border-t border-slate-100 pt-2 flex justify-between items-center px-1">
                         <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <ArrowUpFromLine className="w-3 h-3" /> FRENTE
                         </span>
                         <span className="text-[8px] font-bold text-slate-400 uppercase">FUNDO</span>
                      </div>
                   </div>
                ))}
                
                {/* Spacer for comfortable scrolling */}
                <div className="w-8 shrink-0"></div>
             </div>
             
             {/* SCROLL INSTRUCTION */}
             <div className="bg-white border-t border-slate-200 p-2 text-center text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-2">
                <MoveDown className="w-3 h-3 rotate-[-90deg]" />
                Use a barra de rolagem horizontal para navegar pela quadra
                <MoveDown className="w-3 h-3 rotate-[-90deg]" />
             </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PlanningTab;