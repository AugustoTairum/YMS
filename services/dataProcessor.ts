import * as XLSX from 'xlsx';
import { ScheduleItem, StockItem } from '../types';

// Helper to normalize container strings for reliable matching
// Removes spaces, dashes, and converts to uppercase
const normalizeCntr = (val: any): string => {
  if (!val) return "";
  return String(val).toUpperCase().replace(/[^A-Z0-9]/g, '');
};

export const processScheduleFile = async (file: File): Promise<ScheduleItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames.find(n => n.includes('PLANILHA GERAL')) || wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 }) as any[];

        const data = rows.slice(2).map((row, idx) => {
          if (!row[3]) return null;
          const dObj = row[18] ? (typeof row[18] === 'number' ? new Date(Math.round((row[18] - 25569) * 86400 * 1000)) : new Date(row[18])) : null;
          
          const rawCntr = String(row[3]);
          
          return {
            id: rawCntr + "_" + idx,
            importador: row[0] || 'DIVERSOS',
            cntr: normalizeCntr(rawCntr), // Store normalized for logic, original could be kept if needed for display but usually normalized is better
            tipoDoc: row[7] || '-',
            quadraFull: row[8] || '?',
            servico: row[9] || 'OUTROS',
            remocoes: parseInt(row[12]) || 0,
            agendamentoFull: dObj ? dObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'S/D',
            _rawDate: dObj
          } as ScheduleItem;
        }).filter((i): i is ScheduleItem => i !== null);

        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsBinaryString(file);
  });
};

export const processStockFile = async (file: File, scheduleData: ScheduleItem[]): Promise<StockItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 }) as any[];

        // Create a map for faster lookup using normalized CNTR
        const scheduleMap = new Map<string, ScheduleItem>();
        scheduleData.forEach(s => scheduleMap.set(s.cntr, s));

        const data = rows.slice(1).map((r, idx) => {
          // Filtro Terminal (Coluna Q / Índice 16) deve ser "CLIA"
          const terminal = String(r[16] || "").trim();
          if (terminal !== 'CLIA') return null;

          const local = String(r[17] || "");
          const rawCntr = String(r[2] || "");
          const normalizedCntr = normalizeCntr(rawCntr);
          
          if (!local || !normalizedCntr) return null;

          const match = scheduleMap.get(normalizedCntr);

          return {
            id: idx + "_" + normalizedCntr,
            cntr: normalizedCntr,
            local: local,
            quadra: local.substring(0, 2),
            bay: local.substring(0, 4),
            pos: local.slice(-2),
            servico: match ? match.servico : "Sem Agendamento",
            quadraBase: match ? match.quadraFull : "N/I"
          } as StockItem;
        }).filter((i): i is StockItem => i !== null);

        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsBinaryString(file);
  });
};

export const parseLayoutCSV = (csv: string): string[][] => {
  return csv.split('\n').map(r => r.split(','));
};