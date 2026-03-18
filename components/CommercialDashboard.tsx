
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  Calendar,
  Package,
  X,
  UserCircle,
  LogOut,
  ArrowRight,
  Timer,
  Zap,
  ListFilter,
  FlaskConical,
  ArrowUpAZ,
  ArrowDown01,
  ArrowUp01,
  Filter,
  Home,
  FolderOpen,
  Target
} from 'lucide-react';
import { Claim, ClaimStatus, Brand } from '../types';
import { SearchableSelect } from './SearchableSelect';

interface CommercialDashboardProps {
  claims: Claim[];
  integrantes: {name: string, email: string}[];
  onCreateNew: (reporterName: string) => void;
  onLogout: () => void;
  activeUser: string;
  onUserChange: (name: string) => void;
}

const getDaysPassed = (dateStr: string) => {
    if (!dateStr) return 0;
    const parts = dateStr.includes('/') ? dateStr.split('/') : null;
    const start = parts ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) : new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

type SortOption = 'DATE_DESC' | 'DATE_ASC' | 'ALPHA' | 'STATUS';

export const CommercialDashboard: React.FC<CommercialDashboardProps> = ({ 
  claims,
  integrantes,
  onCreateNew,
  onLogout,
  activeUser,
  onUserChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CLOSED'>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('DATE_DESC');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  
  // Local state to handle selection before login confirmation
  const [tempSelectedUser, setTempSelectedUser] = useState('');

  // MOVE HOOKS BEFORE CONDITIONAL RETURN
  const myClaims = claims.filter(c => c.reporterName === activeUser);
  const stats = {
      pending: myClaims.filter(c => c.status !== ClaimStatus.CLOSED).length,
      closed: myClaims.filter(c => c.status === ClaimStatus.CLOSED).length,
  };

  // Filter and Sort Logic (Always execute this hook)
  const processedClaims = useMemo(() => {
      let result = myClaims.filter(claim => {
          const term = searchTerm.toLowerCase();
          const matchesSearch = (claim.client || '').toLowerCase().includes(term) || (claim.productRef || '').toLowerCase().includes(term);
          const matchesStatus = statusFilter === 'ALL' ? true : statusFilter === 'PENDING' ? (claim.status !== ClaimStatus.CLOSED) : (claim.status === ClaimStatus.CLOSED);
          return matchesSearch && matchesStatus;
      });

      return result.sort((a, b) => {
          if (sortOption === 'ALPHA') return a.client.localeCompare(b.client);
          if (sortOption === 'STATUS') return a.status.localeCompare(b.status);
          
          const getDate = (dateStr: string) => {
              if(!dateStr) return new Date(0).getTime();
              const parts = dateStr.includes('/') ? dateStr.split('/') : null;
              return parts ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime() : new Date(dateStr).getTime();
          };
          
          const timeA = getDate(a.date);
          const timeB = getDate(b.date);

          return sortOption === 'DATE_ASC' ? timeA - timeB : timeB - timeA;
      });

  }, [myClaims, searchTerm, statusFilter, sortOption]);

  if (!activeUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 w-full max-w-md relative z-10 border border-white/50">
           <div className="flex flex-col items-center mb-8">
              <div className="w-20 h-20 bg-indigo-50/50 rounded-full flex items-center justify-center text-indigo-600 mb-4 shadow-inner border border-indigo-100">
                 <UserCircle size={48} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 text-center">Portal Comercial</h2>
              <p className="text-slate-500 text-sm text-center mt-1">Seleccione su perfil para gestionar sus casos</p>
           </div>
           <div className="space-y-6">
              <SearchableSelect 
                label="Nombre del Comercial"
                placeholder="Busque su nombre..."
                options={integrantes.map(r => r.name)}
                value={tempSelectedUser}
                onChange={setTempSelectedUser}
                icon={UserCircle}
              />
              <div className="pt-2">
                 <button 
                    onClick={() => onUserChange(tempSelectedUser)}
                    disabled={!tempSelectedUser} 
                    className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                 >
                   Ingresar <ArrowRight size={20} />
                 </button>
              </div>
           </div>
           <div className="mt-8 pt-6 border-t border-slate-200/50 text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 <Timer size={14} className="text-amber-500" /> SLA: 30 Días para cierre
              </div>
              <button onClick={onLogout} className="text-slate-400 text-xs font-medium hover:text-red-500 transition flex items-center justify-center gap-1 mx-auto">
                 <LogOut size={12} /> Volver al Inicio
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 relative font-sans">
      {selectedClaim && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">{selectedClaim.client}</h3>
                            <p className="text-xs text-slate-500">{selectedClaim.id} • {selectedClaim.invoiceNumber} • {selectedClaim.date}</p>
                        </div>
                        {selectedClaim.driveFolderUrl && (
                            <button onClick={() => window.open(selectedClaim.driveFolderUrl, '_blank')} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="Ver Carpeta Drive">
                                <FolderOpen size={18}/>
                            </button>
                        )}
                    </div>
                    <button onClick={() => setSelectedClaim(null)} className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-100 transition"><X size={20} className="text-slate-500" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Expected Solution in Detail Modal */}
                    <div>
                         <span className="text-xs font-bold text-slate-500 uppercase block mb-2">Solución Esperada</span>
                         <div className={`p-3 rounded-lg border flex items-center gap-2 ${selectedClaim.correctionType?.includes('$') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                            <Target size={18} />
                            <span className="font-bold text-sm">{selectedClaim.correctionType || 'No especificada'}</span>
                         </div>
                    </div>

                    <div>
                         <span className="text-xs font-bold text-slate-800 uppercase block mb-2">Descripción del Problema</span>
                         <p className="text-sm text-slate-600 bg-white p-4 border border-slate-200 rounded-xl leading-relaxed italic">"{selectedClaim.description}"</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                           <span className="text-[10px] font-bold text-slate-500 uppercase block">Producto</span>
                           <p className="text-xs font-medium text-slate-800 break-words">{selectedClaim.productRef}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                           <span className="text-[10px] font-bold text-slate-500 uppercase block">Lote</span>
                           <p className="text-xs font-medium text-slate-800 break-words">{selectedClaim.batch}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      <header className="bg-indigo-900/90 backdrop-blur-xl text-white pt-8 pb-12 px-6 rounded-b-[2rem] shadow-xl relative overflow-hidden border-b border-indigo-500/30">
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Gestión Comercial</p>
            <h1 className="text-2xl font-bold tracking-tight">Hola, {activeUser.split(' ')[0]}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onUserChange('')} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm transition flex items-center gap-2 text-xs font-medium border border-white/10"><UserCircle size={16} /><span className="hidden xs:inline">Cambiar</span></button>
            <button onClick={onLogout} className="bg-white/10 hover:bg-red-500/80 px-3 py-1.5 rounded-lg backdrop-blur-sm transition flex items-center gap-2 text-xs font-medium border border-white/10 hover:border-red-400"><Home size={16} /><span className="hidden xs:inline">Inicio</span></button>
          </div>
        </div>
        <div className="flex gap-3 relative z-10 mt-2">
          <div className="flex-1 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3">
             <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-300"><Clock size={18} /></div>
             <div><span className="block text-2xl font-bold">{stats.pending}</span><span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Pendientes</span></div>
          </div>
          <div className="flex-1 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3">
             <div className="bg-green-500/20 p-2 rounded-lg text-green-300"><CheckCircle2 size={18} /></div>
             <div><span className="block text-2xl font-bold">{stats.closed}</span><span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Cerradas</span></div>
          </div>
        </div>
      </header>

      <div className="px-5 -mt-6 relative z-20 space-y-3">
        {/* Search Bar */}
        <div className="relative shadow-lg rounded-xl">
          <div className="absolute left-4 top-3.5 text-slate-400"><Search size={20} /></div>
          <input type="text" placeholder="Buscar por cliente, lote..." className="w-full bg-white/95 backdrop-blur py-3.5 pl-12 pr-10 rounded-xl text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-4 top-3.5 text-slate-300 hover:text-slate-50"><X size={18} /></button>}
        </div>

        {/* Sorting and Filter Controls */}
        <div className="flex justify-between items-center bg-white/80 backdrop-blur rounded-xl p-2 border border-white/40 shadow-sm">
           <div className="flex gap-2">
              {['ALL', 'PENDING', 'CLOSED'].map(f => (
                <button key={f} onClick={() => setStatusFilter(f as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition border ${statusFilter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100'}`}>
                    {f === 'ALL' ? 'Todos' : f === 'PENDING' ? 'Pendientes' : 'Cerrados'}
                </button>
              ))}
           </div>
           
           <div className="flex items-center border-l border-slate-200 pl-2 ml-2 gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold hidden xs:inline">Ordenar:</span>
              <div className="relative">
                  <select 
                    className="appearance-none bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer pr-4"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                  >
                      <option value="DATE_DESC">Más Recientes</option>
                      <option value="DATE_ASC">Más Antiguos</option>
                      <option value="ALPHA">Alfabético (A-Z)</option>
                      <option value="STATUS">Por Estado</option>
                  </select>
                  <ListFilter size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              </div>
           </div>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {processedClaims.length === 0 ? (
          <div className="text-center py-12 opacity-50 bg-white/30 backdrop-blur rounded-2xl border border-white/20">
            <Package size={48} className="mx-auto mb-3 text-slate-400" />
            <p className="text-slate-600 font-medium">No se encontraron casos.</p>
          </div>
        ) : (
          processedClaims.map((claim) => {
            const daysOpen = getDaysPassed(claim.date);
            const clientSlaMet = claim.immediateSolutionStatus === 'Approved';
            
            return (
              <div key={claim.id} onClick={() => setSelectedClaim(claim)} className="bg-white/90 backdrop-blur rounded-xl shadow-sm border border-white/60 overflow-hidden hover:shadow-lg transition-all active:scale-[0.99] duration-200 relative group cursor-pointer ring-1 ring-black/5">
                <div className={`h-1 w-full ${claim.brand === Brand.GULF ? 'bg-orange-500' : claim.brand === Brand.VALVOLINE ? 'bg-red-600' : 'bg-slate-400'}`}></div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg leading-tight truncate pr-2">{claim.client}</h3>
                        <p className="text-[10px] text-slate-400 font-bold">{claim.id} • {claim.invoiceNumber}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 shrink-0"><Calendar size={10} /> {claim.date}</span>
                  </div>
                  
                  {/* Detailed Product info with Truncate + Hover */}
                  <div className="mb-3 text-xs text-slate-600 border-l-2 border-slate-200 pl-2">
                     <p className="truncate font-medium" title={claim.productRef}>{claim.productRef}</p>
                     <p className="truncate text-[10px] text-slate-400" title={claim.batch}>Lote: {claim.batch}</p>
                  </div>

                  {/* Expected Solution Badge - VISIBLE IN CARD */}
                  <div className="mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${claim.correctionType?.includes('$') ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                          <Target size={10} /> {claim.correctionType || 'Solución Pendiente'}
                      </span>
                  </div>

                  <div className="mb-4">
                     <p className="text-sm text-slate-600 font-medium italic line-clamp-2">"{claim.description}"</p>
                  </div>
                  
                  {/* SLA INDICATORS */}
                  <div className="flex gap-2 mt-3 mb-2">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase border ${clientSlaMet ? 'bg-green-50 border-green-200 text-green-700' : daysOpen > 5 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                         <Zap size={10} /> Respuesta Cliente: {clientSlaMet ? 'LISTO' : daysOpen + '/5 Días'}
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase border ${claim.status === ClaimStatus.CLOSED ? 'bg-slate-100 text-slate-500' : daysOpen > 30 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                         <Timer size={10} /> Cierre Interno: {daysOpen + '/30 Días'}
                      </div>
                  </div>

                  {/* Status Icons */}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                     {claim.tasks && claim.tasks.length > 0 && (
                        <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1"><FlaskConical size={10}/> Plan Acción Activo</span>
                     )}
                     {/* FIX: Property 'immediateSolution' does not exist on type 'Claim'. Changed to check mitigationActions array. */}
                     {claim.mitigationActions && claim.mitigationActions.length > 0 && (
                        <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1"><CheckCircle2 size={10}/> Mitigación Enviada</span>
                     )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      <button onClick={() => onCreateNew(activeUser)} className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white px-5 py-4 rounded-full shadow-lg shadow-red-600/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 z-50 pointer-events-auto">
        <Plus size={24} /><span className="font-bold hidden md:inline">Nueva Reclamación</span><span className="font-bold md:hidden">Nueva</span>
      </button>
    </div>
  );
};
