
import React, { useState } from 'react';
import { 
  FlaskConical, Wrench, Factory, Truck, Receipt, Container, ClipboardCheck, ShieldCheck, 
  LogOut, Search, ArrowDownUp, Users, Zap, Clock, ClipboardList, Lock, History, BarChart3, X 
} from 'lucide-react';
import { InternalRole, Claim, ClaimStatus, AuditFilterType, SortOption } from '../../types';
import { SECURITY_PINS } from '../../constants';

// --- ROLE SELECTOR ---
const RoleCard = ({ role, label, desc, icon: Icon, colorClass, onClick }: any) => (
  <div onClick={onClick} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden">
     <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/0 to-slate-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
     <div className={`${colorClass} w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon size={24} />
     </div>
     <h3 className="font-bold text-slate-800 text-lg mb-1">{label}</h3>
     <p className="text-sm text-slate-500 leading-snug">{desc}</p>
  </div>
);

export const RoleSelector: React.FC<{ onSelect: (role: InternalRole) => void, onLogout: () => void }> = ({ onSelect, onLogout }) => {
  const [authRoleTarget, setAuthRoleTarget] = useState<InternalRole | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleRoleSelection = (role: InternalRole) => {
    if (role === InternalRole.LAB || role === InternalRole.AUDIT) {
        setAuthRoleTarget(role);
        setPin('');
        setError(false);
    } else {
        onSelect(role);
    }
  };

  const handlePinSubmit = () => {
      const requiredPin = authRoleTarget === InternalRole.LAB ? SECURITY_PINS.LAB_ROLE : SECURITY_PINS.AUDIT_ROLE;
      
      if (pin === requiredPin) {
          onSelect(authRoleTarget!);
          setAuthRoleTarget(null);
      } else {
          setError(true);
      }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
        <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-lg text-white"><ShieldCheck size={24} /></div>
                <div>
                <h1 className="text-xl font-bold text-slate-800">Gestión Interna</h1>
                <p className="text-xs text-slate-500">Seleccione su área</p>
                </div>
            </div>
            <button onClick={onLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 text-sm font-bold"><LogOut size={16} /> Salir</button>
        </header>
        <div className="flex-1 p-6 max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <RoleCard onClick={() => handleRoleSelection(InternalRole.LAB)} role={InternalRole.LAB} label="Laboratorio" desc="Análisis y Diagnóstico." icon={FlaskConical} colorClass="bg-indigo-600" />
            <RoleCard onClick={() => handleRoleSelection(InternalRole.MAINTENANCE)} role={InternalRole.MAINTENANCE} label="Mantenimiento" desc="Ejecución técnica." icon={Wrench} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelection(InternalRole.PRODUCTION)} role={InternalRole.PRODUCTION} label="Producción" desc="Planta y Procesos." icon={Factory} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelection(InternalRole.LOGISTICS)} role={InternalRole.LOGISTICS} label="Logística" desc="Bodega y Despachos." icon={Truck} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelection(InternalRole.BILLING)} role={InternalRole.BILLING} label="Facturación" desc="Notas Crédito." icon={Receipt} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelection(InternalRole.SUPPLY)} role={InternalRole.SUPPLY} label="Abastecimiento" desc="Insumos." icon={Container} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelection(InternalRole.QUALITY_AUX)} role={InternalRole.QUALITY_AUX} label="Aux. Calidad" desc="Apoyo." icon={ClipboardCheck} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelection(InternalRole.AUDIT)} role={InternalRole.AUDIT} label="Auditoría / Cierre" desc="Aprobación Final." icon={ShieldCheck} colorClass="bg-green-600" />
        </div>

        {/* PIN AUTH MODAL FOR LAB/AUDIT ROLES */}
        {authRoleTarget && (
             <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                 <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative animate-fadeIn border border-white/50">
                    <button onClick={() => setAuthRoleTarget(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition"><X size={20} /></button>
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-lg"><Lock size={32} /></div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Acceso Restringido</h3>
                    <p className="text-sm text-slate-500 mb-6">Rol: {authRoleTarget}</p>
                    <input 
                        type="password" 
                        autoFocus 
                        placeholder="PIN" 
                        className="w-full text-center text-3xl font-mono tracking-[0.5em] p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent mb-3 transition-all bg-white" 
                        value={pin} 
                        onChange={(e) => { setPin(e.target.value); setError(false); }} 
                        onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()} 
                    />
                    {error && <p className="text-xs text-red-500 font-bold mb-4 bg-red-50 py-1 px-3 rounded-full inline-block">Código incorrecto</p>}
                    <button onClick={handlePinSubmit} className="w-full mt-2 py-4 rounded-xl bg-gradient-to-r from-indigo-700 to-purple-800 text-white font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">VALIDAR</button>
                 </div>
             </div>
        )}
    </div>
  );
};

// --- LAB HEADER ---
interface LabHeaderProps {
    currentRole: InternalRole;
    onChangeRole: () => void;
    onLogout: () => void;
    searchTerm: string;
    onSearchChange: (val: string) => void;
    sortOption: SortOption;
    onSortChange: (val: SortOption) => void;
}

export const LabHeader: React.FC<LabHeaderProps> = ({ currentRole, onChangeRole, onLogout, searchTerm, onSearchChange, sortOption, onSortChange }) => {
    return (
       <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
             <div className={`p-2 rounded-xl text-white ${currentRole === InternalRole.AUDIT ? 'bg-green-600' : 'bg-indigo-600'}`}>
                 {currentRole === InternalRole.AUDIT ? <ShieldCheck size={20}/> : <FlaskConical size={20}/>}
             </div>
             <div>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Estación Activa</span>
                 <h1 className="text-lg font-black text-slate-800 leading-none">{currentRole}</h1>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
                onClick={onChangeRole} 
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold transition border border-slate-200"
                title="Cambiar Área"
             >
                <Users size={16} />
                <span className="hidden sm:inline">Cambiar Área</span>
             </button>

             <div className="h-6 w-px bg-slate-200 mx-1"></div>

             {currentRole !== InternalRole.AUDIT && (
                 <div className="flex items-center gap-3">
                     <div className="hidden lg:flex items-center gap-2 bg-slate-100 rounded-lg p-1 border border-slate-200 mr-2">
                        <ArrowDownUp size={14} className="text-slate-400 ml-2" />
                        <select
                          className="bg-transparent text-xs font-bold text-slate-600 outline-none p-1 cursor-pointer pr-2"
                          value={sortOption}
                          onChange={(e) => onSortChange(e.target.value as SortOption)}
                        >
                            <option value="DATE_DESC">Recientes</option>
                            <option value="DATE_ASC">Antiguos</option>
                            <option value="ALPHA">A-Z</option>
                            <option value="STATUS_PENDING">Pendientes</option>
                            <option value="STATUS_CLOSED">Cerrados</option>
                        </select>
                     </div>

                     <div className="relative hidden md:block">
                       <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                       <input type="text" placeholder="Buscar caso..." className="pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm w-64 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
                     </div>
                 </div>
             )}
             <button onClick={onLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition text-xs font-bold" title="Cerrar Sesión">
                <LogOut size={18} />
                <span className="hidden sm:inline">Salir</span>
             </button>
          </div>
       </header>
    );
};

// --- CLAIMS SIDEBAR ---
interface ClaimsSidebarProps {
    claims: Claim[];
    selectedClaimId?: string;
    onSelectClaim: (claim: Claim) => void;
    currentRole: InternalRole;
    auditFilter: AuditFilterType;
    setAuditFilter: (f: AuditFilterType) => void;
    onViewIndicators: () => void;
    isHiddenMobile: boolean;
}

export const ClaimsSidebar: React.FC<ClaimsSidebarProps> = ({ 
    claims, selectedClaimId, onSelectClaim, currentRole, auditFilter, setAuditFilter, onViewIndicators, isHiddenMobile 
}) => {
    return (
        <aside className={`w-full md:w-96 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 ${isHiddenMobile ? 'hidden md:block' : 'block'}`}>
             {currentRole === InternalRole.AUDIT && (
                 <div className="p-6 space-y-4">
                     <button onClick={() => setAuditFilter('APPROVAL_READY')} className={`w-full p-4 rounded-xl flex items-center gap-3 transition font-bold text-left ${auditFilter === 'APPROVAL_READY' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}>
                         <Zap size={20} /> Aprobar Soluciones Inmediatas
                     </button>
                     <button onClick={() => setAuditFilter('PENDING_EXECUTION')} className={`w-full p-4 rounded-xl flex items-center gap-3 transition font-bold text-left ${auditFilter === 'PENDING_EXECUTION' ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-200' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}>
                         <Clock size={20} /> Soluciones Pendientes (Ejecución)
                     </button>
                     <button onClick={() => setAuditFilter('ACTION_PLAN_PENDING')} className={`w-full p-4 rounded-xl flex items-center gap-3 transition font-bold text-left ${auditFilter === 'ACTION_PLAN_PENDING' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}>
                         <ClipboardList size={20} /> Plan de Acción Pendiente
                     </button>
                     <button onClick={() => setAuditFilter('CLOSURE_READY')} className={`w-full p-4 rounded-xl flex items-center gap-3 transition font-bold text-left ${auditFilter === 'CLOSURE_READY' ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}>
                         <Lock size={20} /> Tickets Pendientes Cierre Admin.
                     </button>
                     <button onClick={() => setAuditFilter('HISTORY')} className={`w-full p-4 rounded-xl flex items-center gap-3 transition font-bold text-left ${auditFilter === 'HISTORY' ? 'bg-slate-700 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}>
                         <History size={20} /> Histórico Solicitudes Cerradas
                     </button>

                     <div className="pt-4 border-t border-slate-100">
                         <button onClick={onViewIndicators} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg hover:bg-slate-900 transition flex items-center justify-center gap-2">
                             <BarChart3 size={18} /> Ver Indicadores
                         </button>
                     </div>
                 </div>
             )}
             <div className="px-4 pb-4 space-y-3">
                {claims.map(claim => (
                    <div key={claim.id} onClick={() => onSelectClaim(claim)} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-shadow group relative ${selectedClaimId === claim.id ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm text-slate-800 truncate flex-1">{claim.client}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${claim.status === ClaimStatus.CLOSED ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{claim.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2 line-clamp-2 italic">"{claim.description}"</p>
                        <div className="flex justify-between text-[10px] text-slate-400 items-center">
                            <span>{claim.id}</span>
                            {claim.mitigationActions?.some(m => m.executionNotes && m.status === 'Pending') && <span className="flex items-center gap-1 text-orange-500 font-bold"><Clock size={10} /> Por Aprobar</span>}
                        </div>
                    </div>
                ))}
             </div>
        </aside>
    );
};
