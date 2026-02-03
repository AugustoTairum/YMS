import React, { useState } from 'react';
import { LayoutDashboard, Calendar, Database, Map, PieChart } from 'lucide-react';
import DashboardTab from './components/DashboardTab';
import LayoutTab from './components/LayoutTab';
import ServicesTab from './components/ServicesTab';
import PlanningTab from './components/PlanningTab';
import { ScheduleItem, StockItem, PlanningState } from './types';
import { processScheduleFile, processStockFile } from './services/dataProcessor';
import { FILE_PATHS } from './constants';

type ActiveTab = 'dashboard' | 'layout' | 'servicos' | 'planejamento';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [layoutCsv, setLayoutCsv] = useState<string>('');
  const [planningState, setPlanningState] = useState<PlanningState>({ '1': [], '2': [], '3': [] });
  const [targetQuadra, setTargetQuadra] = useState<string | null>(null);
  
  // State to track completed (checked) services by ID
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  const handleScheduleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const data = await processScheduleFile(e.target.files[0]);
      setScheduleData(data);
      setCompletedItems(new Set()); // Reset completion state on new upload
      alert(`${data.length} agendamentos carregados.`);
    }
  };

  const handleStockUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const data = await processStockFile(e.target.files[0], scheduleData);
      setStockData(data);
      alert(`${data.length} unidades de estoque carregadas.`);
    }
  };

  const handleNavigateToPlanning = (quadra: string) => {
    setTargetQuadra(quadra);
    setActiveTab('planejamento');
    // Clear highlight after animation
    setTimeout(() => setTargetQuadra(null), 2000);
  };

  const toggleItemCompletion = (id: string) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">
      {/* HEADER */}
      <header className="sticky top-0 z-50 px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl bg-brand-blue border-b-4 border-white/20">
        <div className="flex items-center gap-4">
          <div className="flex flex-col justify-center">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase leading-none drop-shadow-sm">
              Yard Management
            </h1>
            <p className="text-[10px] text-blue-100 uppercase tracking-widest font-bold mt-0.5 opacity-90">
              Augusto Tairum
            </p>
          </div>
        </div>

        <nav className="flex bg-brand-dark/30 p-1 rounded-xl border border-white/10 backdrop-blur-sm mt-4 md:mt-0">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: PieChart },
            { id: 'layout', label: 'Mapa Layout', icon: Map },
            { id: 'servicos', label: 'Serviços', icon: LayoutDashboard },
            { id: 'planejamento', label: 'Planejamento', icon: null }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`px-6 py-2.5 text-xs font-black uppercase flex items-center gap-2 rounded-lg transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-brand-blue shadow-lg' 
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon && <tab.icon className="w-3 h-3" />}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <label 
            title={`Local do arquivo:\n${FILE_PATHS.SCHEDULE}`}
            className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2.5 rounded-xl text-[10px] font-black cursor-pointer flex items-center gap-2 shadow-lg transition-all active:scale-95 border border-white/10"
          >
            <Calendar className="w-4 h-4" /> AGENDAMENTO
            <input type="file" className="hidden" onChange={handleScheduleUpload} accept=".xlsx, .xls" />
          </label>
          <label 
            title={`Local do arquivo:\n${FILE_PATHS.STOCK}`}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl text-[10px] font-black cursor-pointer flex items-center gap-2 shadow-lg transition-all active:scale-95 border border-white/10"
          >
            <Database className="w-4 h-4" /> ESTOQUE
            <input type="file" className="hidden" onChange={handleStockUpload} accept=".xlsx, .xls" />
          </label>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="p-8 max-w-[1900px] mx-auto">
        {activeTab === 'dashboard' && (
          <DashboardTab 
            scheduleData={scheduleData} 
            completedItems={completedItems}
          />
        )}

        {activeTab === 'layout' && (
          <LayoutTab 
            layoutCsv={layoutCsv} 
            onLayoutUpload={setLayoutCsv} 
            stockData={stockData} 
            navigateToPlanning={handleNavigateToPlanning}
          />
        )}
        
        {activeTab === 'servicos' && (
          <ServicesTab 
            data={scheduleData} 
            completedItems={completedItems}
            onToggleComplete={toggleItemCompletion}
            planningState={planningState}
          />
        )}
        
        {activeTab === 'planejamento' && (
          <PlanningTab 
            stockData={stockData} 
            planningState={planningState}
            setPlanningState={setPlanningState}
            setStockData={setStockData}
            targetQuadra={targetQuadra}
          />
        )}
      </main>
    </div>
  );
}

export default App;