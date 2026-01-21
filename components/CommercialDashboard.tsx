
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Truck, 
  FlaskConical, 
  ChevronRight,
  Calendar,
  Package,
  X,
  UserCircle,
  LogOut,
  ArrowRight,
  Eye,
  FileText,
  Video,
  Home,
  FolderOpen,
  Timer
} from 'lucide-react';
import { Claim, ClaimStatus, IncidentType, Brand } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { REPORTERS_LIST } from '../constants';

interface CommercialDashboardProps {
  claims: Claim[];
  onCreateNew: (reporterName: string) => void;
  onLogout: () => void;
  activeUser: string;
  onUserChange: (name: string) => void;
}

export const CommercialDashboard: React.FC<CommercialDashboardProps> = ({ 
  claims, 
  onCreateNew,
  onLogout,
  activeUser,
  onUserChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CLOSED'>('ALL');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);

  // --- VIEW 1: AGENT SELECTION SCREEN ---
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
                options={REPORTERS_LIST.map(r => r.name)}
                value={activeUser}
                onChange={onUserChange}
                icon={UserCircle}
              />

              <div className="pt-2">
                 <button 
                   disabled={!activeUser}
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

  // --- FILTER LOGIC FOR DASHBOARD ---
  const myClaims = claims.filter(c => c.reporterName === activeUser);

  const stats = {
      pending: myClaims.filter(c => c.status === ClaimStatus.PENDING || c.status === ClaimStatus.ANALYSIS || c.status === ClaimStatus.ASSIGNED).length,
      closed: myClaims.filter(c => c.status === ClaimStatus.CLOSED).length,
  };

  const filteredClaims = myClaims.filter(claim => {
      const safeString = (val: any) => (val || '').toString().toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch = 
        safeString(claim.client).includes(term) ||
        safeString(claim.productRef).includes(term) ||
        safeString(claim.batch).includes(term);
      
      const matchesStatus = 
        statusFilter === 'ALL' ? true :
        statusFilter === 'PENDING' ? (claim.status !== ClaimStatus.CLOSED) :
        statusFilter === 'CLOSED' ? (claim.status === ClaimStatus.CLOSED) : true;

      return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ClaimStatus) => {
    switch (status) {
      case ClaimStatus.PENDING:
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Pendiente' };
      case ClaimStatus.ANALYSIS:
      case ClaimStatus.ASSIGNED:
        return { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock, label: 'En Gestión' };
      case ClaimStatus.CLOSED:
        return { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2, label: 'Cerrado' };
      default:
        return { color: 'bg-slate-100 text-slate-800', icon: Clock, label: status };
    }
  };

  return (
    <div className="min-h-screen pb-24 relative font-sans">
      
      {/* CLAIM DETAIL MODAL */}
      {selectedClaim && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">{selectedClaim.client}</h3>
                        <p className="text-xs text-slate-500">{selectedClaim.id} • {selectedClaim.date}</p>
                    </div>
                    <button 
                        onClick={() => setSelectedClaim(null)} 
                        className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-100 transition"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="flex gap-2">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(selectedClaim.status).color}`}>
                             <Clock size={12} /> {getStatusBadge(selectedClaim.status).label}
                        </div>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${selectedClaim.incidentType === IncidentType.QUALITY ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                             {selectedClaim.incidentType === IncidentType.QUALITY ? <FlaskConical size={12}/> : <Truck size={12}/>}
                             {selectedClaim.incidentType}
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Productos Afectados</span>
                        {selectedClaim.affectedItems && selectedClaim.affectedItems.length > 0 ? (
                           <div className="space-y-2">
                               {selectedClaim.affectedItems.map(item => (
                                   <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                       <p className="font-bold text-slate-800 text-sm mb-1">{item.productRef}</p>
                                       <div className="flex gap-4 text-xs text-slate-600">
                                           <span>Lote: <strong>{item.batch}</strong></span>
                                           <span>Cant: <strong>{item.quantity}</strong></span>
                                       </div>
                                   </div>
                               ))}
                           </div>
                        ) : (
                           <div className="space-y-3">
                                <div><p className="font-bold text-slate-800">{selectedClaim.productRef}</p></div>
                                <div className="flex gap-8">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Marca</span>
                                        <p className="text-sm font-medium text-slate-700">{selectedClaim.brand}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Lote (Batch)</span>
                                        <p className="text-sm font-mono font-bold text-slate-800">{selectedClaim.batch}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                         <span className="text-xs font-bold text-slate-800 uppercase block mb-2">Descripción del Problema</span>
                         <p className="text-sm text-slate-600 bg-white p-4 border border-slate-200 rounded-xl leading-relaxed italic">"{selectedClaim.description}"</p>
                    </div>

                    <div>
                         <span className="text-xs font-bold text-slate-800 uppercase block mb-2">Evidencias Adjuntas</span>
                         {selectedClaim.files && selectedClaim.files.length > 0 ? (
                             <div className="grid grid-cols-2 gap-3">
                                {selectedClaim.files.map((file, idx) => (
                                    <div key={idx} className="aspect-video bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group">
                                        {file.type.startsWith('image/') ? (
                                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-2 text-center h-full">
                                                {file.type.includes('pdf') ? <FileText size={24} className="text-red-500 mb-1"/> : <Video size={24} className="text-blue-500 mb-1"/>}
                                                <span className="text-[9px] text-slate-500 font-medium truncate w-full px-2">{file.name}</span>
                                            </div>
                                        )}
                                        <a href={file.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                            <div className="bg-white p-2 rounded-full shadow-lg cursor-pointer transform hover:scale-110 transition">
                                                <Eye size={16} className="text-slate-800"/>
                                            </div>
                                        </a>
                                    </div>
                                ))}
                             </div>
                         ) : (
                            <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">Sin previsualización disponible</div>
                         )}
                    </div>
                </div>
                
                <div className="p-4 border-t border-slate-100 bg-slate-50 sticky bottom-0 z-10 flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 py-2 px-4 bg-amber-50 rounded-xl border border-amber-100">
                        <Timer size={14} className="text-amber-600" />
                        <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Compromiso Calidad: Resolución en 30 días</span>
                    </div>
                    <button 
                        onClick={() => setSelectedClaim(null)}
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
                    >
                        Cerrar Detalles
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Header GLASS */}
      <header className="bg-indigo-900/90 backdrop-blur-xl text-white pt-8 pb-12 px-6 rounded-b-[2rem] shadow-xl relative overflow-hidden border-b border-indigo-500/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
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
          <div className="flex-1 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3 hover:bg-white/20 transition">
             <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-300"><Clock size={18} /></div>
             <div><span className="block text-2xl font-bold">{stats.pending}</span><span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Pendientes</span></div>
          </div>
          <div className="flex-1 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3 hover:bg-white/20 transition">
             <div className="bg-green-500/20 p-2 rounded-lg text-green-300"><CheckCircle2 size={18} /></div>
             <div><span className="block text-2xl font-bold">{stats.closed}</span><span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Cerradas</span></div>
          </div>
        </div>
      </header>

      <div className="px-5 -mt-6 relative z-20 space-y-3">
        <div className="relative shadow-lg rounded-xl">
          <div className="absolute left-4 top-3.5 text-slate-400"><Search size={20} /></div>
          <input type="text" placeholder="Buscar por cliente, lote..." className="w-full bg-white/95 backdrop-blur py-3.5 pl-12 pr-10 rounded-xl text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-4 top-3.5 text-slate-300 hover:text-slate-50"><X size={18} /></button>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['ALL', 'PENDING', 'CLOSED'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f as any)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition border backdrop-blur-sm ${statusFilter === f ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white/80 text-slate-500 border-white/50 hover:bg-white'}`}>
                {f === 'ALL' ? 'Todos' : f === 'PENDING' ? 'Pendientes' : 'Cerrados'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {filteredClaims.length === 0 ? (
          <div className="text-center py-12 opacity-50 bg-white/30 backdrop-blur rounded-2xl border border-white/20">
            <Package size={48} className="mx-auto mb-3 text-slate-400" />
            <p className="text-slate-600 font-medium">No se encontraron casos.</p>
          </div>
        ) : (
          filteredClaims.map((claim) => {
            const badge = getStatusBadge(claim.status);
            const BadgeIcon = badge.icon;
            return (
              <div key={claim.id} onClick={() => setSelectedClaim(claim)} className="bg-white/90 backdrop-blur rounded-xl shadow-sm border border-white/60 overflow-hidden hover:shadow-lg transition-all active:scale-[0.99] duration-200 relative group cursor-pointer ring-1 ring-black/5">
                <div className={`h-1 w-full ${claim.brand === Brand.GULF ? 'bg-orange-500' : claim.brand === Brand.VALVOLINE ? 'bg-red-600' : 'bg-slate-400'}`}></div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800 text-lg leading-tight truncate pr-10">{claim.client}</h3>
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1"><Calendar size={10} /> {claim.date}</span>
                  </div>
                  <div className="mb-4">
                     <p className="text-sm text-slate-600 font-medium mb-1">{claim.productRef}</p>
                     <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Lote: {claim.batch}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-1">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wide ${badge.color}`}><BadgeIcon size={12} />{badge.label}</div>
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${claim.incidentType === IncidentType.LOGISTICS ? 'text-orange-600' : 'text-blue-600'}`}>
                      {claim.incidentType === IncidentType.LOGISTICS ? <Truck size={14} /> : <FlaskConical size={14} />}{claim.incidentType}
                    </div>
                  </div>
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300"><ChevronRight size={24} /></div>
              </div>
            );
          })
        )}
      </div>

      <div className="fixed bottom-2 left-0 w-full flex justify-center pointer-events-none pb-2 z-[40]">
          <div className="bg-slate-900/90 backdrop-blur px-6 py-2 rounded-full border border-white/10 flex items-center gap-3 shadow-2xl">
              <Timer size={14} className="text-amber-500" />
              <p className="text-[9px] font-black text-white uppercase tracking-widest">SLA Prolub: Gestión técnica en 30 días</p>
          </div>
      </div>

      <button onClick={() => onCreateNew(activeUser)} className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white px-5 py-4 rounded-full shadow-lg shadow-red-600/40 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 z-50 pointer-events-auto">
        <Plus size={24} /><span className="font-bold hidden md:inline">Nueva Reclamación</span><span className="font-bold md:hidden">Nueva</span>
      </button>
    </div>
  );
};
