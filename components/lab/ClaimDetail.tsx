
import React, { useState } from 'react';
import { 
  FolderOpen, Trash2, EyeOff, Printer, Lock, FileText, Zap, Timer, Image as ImageIcon, ExternalLink, Target, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { Claim, ClaimStatus, InternalRole, EvidenceFile, ChangeRequest } from '../../types';

// DATE HELPERS
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

const getDaysPassed = (dateStr: string) => {
    const start = parseDate(dateStr);
    if (!start) return 0;
    return Math.floor(getDaysDiff(start, new Date()));
};

export const FileThumbnail: React.FC<{ file: EvidenceFile, onClick: () => void }> = ({ file, onClick }) => {
    const [imgError, setImgError] = useState(false);
    if (!file) return null;
    const fileName = file.name || 'Archivo sin nombre';
    const isImage = (file.type && file.type.includes('image')) || (fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) !== null);

    return (
        <div onClick={onClick} className="cursor-pointer group relative bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all h-28 w-full flex flex-col items-center justify-between p-2 text-center">
            <div className="flex-1 w-full flex items-center justify-center overflow-hidden mb-2 bg-slate-50 rounded-lg relative">
                {isImage && !imgError ? (
                    <img 
                        src={file.url} 
                        alt={fileName} 
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                        crossOrigin="anonymous"
                    />
                ) : (
                    <div className={`p-3 rounded-full ${file.type?.includes('pdf') ? 'bg-red-100 text-red-500' : 'bg-indigo-100 text-indigo-500'}`}>
                        {file.type?.includes('pdf') ? <FileText size={24} /> : <ImageIcon size={24} />}
                    </div>
                )}
            </div>
            <p className="text-[10px] font-bold text-slate-600 truncate w-full px-1 leading-tight" title={fileName}>
                {fileName}
            </p>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="bg-white/90 backdrop-blur rounded-full p-1 shadow-sm text-slate-700">
                    <ExternalLink size={12} />
                 </div>
            </div>
        </div>
    );
};

interface ClaimHeaderProps {
    claim: Claim;
    isAdmin: boolean;
    currentRole: InternalRole;
    onDelete: () => void;
    onArchive: () => void;
    onCloseCase: () => void;
    onPreviewReport: (mode: 'CLIENT' | 'FINAL') => void;
}

export const ClaimHeader: React.FC<ClaimHeaderProps> = ({ claim, isAdmin, currentRole, onDelete, onArchive, onCloseCase, onPreviewReport }) => {
    const handleOpenDrive = () => {
        if (claim.driveFolderUrl) {
            window.open(claim.driveFolderUrl, '_blank');
        } else {
            alert("Carpeta de Drive no encontrada.");
        }
    };

    return (
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
           <div>
               <div className="flex items-center gap-2">
                   <h2 className="text-xl font-bold text-slate-800">{claim.client}</h2>
                   <button onClick={handleOpenDrive} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition" title="Ir a Carpeta de Drive">
                       <FolderOpen size={16}/>
                   </button>
               </div>
               <p className="text-sm text-slate-500">{claim.id} • Factura: {claim.invoiceNumber} • {claim.date}</p>
           </div>
           <div className="flex gap-2">
               {isAdmin && (
                 <>
                    <button onClick={onDelete} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Eliminar Caso"><Trash2 size={20}/></button>
                    <button onClick={onArchive} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Ocultar Caso (Archivar)"><EyeOff size={20}/></button>
                    
                    <button onClick={() => onPreviewReport('FINAL')} disabled={claim.immediateSolutionStatus !== 'Approved'} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold shadow-sm flex gap-2 hover:bg-indigo-700 disabled:opacity-50"><Printer size={16}/> Ver Informe Cierre</button>
                    
                    {currentRole === InternalRole.AUDIT && claim.status !== ClaimStatus.CLOSED && claim.actionPlanStatus === 'Approved' && (
                        <button onClick={onCloseCase} className="px-4 py-2 bg-slate-800 text-white rounded text-sm font-bold shadow-sm flex gap-2 hover:bg-black hover:shadow-md hover:-translate-y-0.5 transition-all">
                            <Lock size={16}/> Cierre Definitivo
                        </button>
                    )}
                    
                    <button onClick={() => onPreviewReport('CLIENT')} disabled={claim.immediateSolutionStatus !== 'Approved'} className="px-4 py-2 bg-white border rounded text-sm font-bold shadow-sm flex gap-2 hover:bg-slate-50 disabled:opacity-50"><FileText size={16}/> Reporte Cliente</button>
                 </>
               )}
           </div>
       </div>
    );
};

export const ChangeRequestHistory: React.FC<{ claim: Claim, currentRole: InternalRole, onResolve: (id: string) => void }> = ({ claim, currentRole, onResolve }) => {
    // 1. FILTER REQUESTS BASED ON ROLE AND RELEVANCE
    const visibleRequests = (claim.changeRequests || []).filter(req => {
        // Audit sees all
        if (currentRole === InternalRole.AUDIT) return true;
        
        // Only show Pending to operational areas
        if (req.status !== 'Pending') return false;

        // Find the linked item to check assignment
        const mitigation = claim.mitigationActions?.find(m => m.id === req.itemId);
        const task = claim.tasks?.find(t => t.id === req.itemId);
        
        // Lab Logic: Sees Ishikawa + Lab/Quality assigned items
        if (currentRole === InternalRole.LAB) {
            if (req.itemType.includes('Causa') || req.itemType === 'ISHIKAWA') return true;
            if (mitigation && (mitigation.assignedTo === 'Laboratorio' || mitigation.assignedTo === 'Calidad')) return true;
            if (task && (task.assignedTo === 'Laboratorio' || task.assignedTo === 'Calidad')) return true;
            return false;
        }

        // Other Roles: Only see if assigned to them
        if (mitigation && mitigation.assignedTo === currentRole) return true;
        if (task && task.assignedTo === currentRole) return true;

        return false;
    });

    if (visibleRequests.length === 0) return null;

    // Helper to get description text
    const getItemDescription = (req: ChangeRequest) => {
        const mitigation = claim.mitigationActions?.find(m => m.id === req.itemId);
        if (mitigation) return mitigation.description;
        
        const task = claim.tasks?.find(t => t.id === req.itemId);
        if (task) return task.description;

        const ishikawa = claim.ishikawaList?.find(i => i.id === req.itemId);
        if (ishikawa) return `${ishikawa.category}: ${ishikawa.observation}`;

        return "Ítem no encontrado";
    };

    return (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={20} className="text-orange-600" />
                <h3 className="font-bold text-orange-800">Solicitudes de Cambio Pendientes</h3>
            </div>
            <div className="space-y-3">
                {visibleRequests.map(req => (
                    <div key={req.id} className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide bg-orange-50 px-2 py-0.5 rounded">{req.itemType}</span>
                                
                                {/* Show Original Item Description */}
                                <div className="mt-2 mb-2 p-2 bg-slate-50 border border-slate-100 rounded text-xs text-slate-500 italic">
                                    <span className="font-bold not-italic text-slate-400 text-[10px] uppercase block mb-1">Tarea Vinculada:</span>
                                    "{getItemDescription(req)}"
                                </div>

                                <p className="text-sm font-bold text-slate-800 mt-1">Solicitud: {req.requestText}</p>
                                <p className="text-[10px] text-slate-400 mt-2">{new Date(req.createdAt).toLocaleString()}</p>
                            </div>
                            {currentRole === InternalRole.AUDIT && req.status === 'Pending' && (
                                <button 
                                    onClick={() => onResolve(req.id)}
                                    className="ml-4 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition shadow-sm flex-shrink-0"
                                    title="Marcar como Resuelto"
                                >
                                    <CheckCircle2 size={16} />
                                </button>
                            )}
                            {req.status === 'Resolved' && (
                                <span className="ml-4 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100">Resuelto</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const ClaimInfo: React.FC<{ claim: Claim, onViewEvidence: (file: EvidenceFile) => void }> = ({ claim, onViewEvidence }) => {
    const daysOpen = getDaysPassed(claim.date);
    const clientSlaMet = claim.immediateSolutionStatus === 'Approved';

    return (
        <div className="p-6">
           <div className="flex gap-2 mb-6">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase border ${clientSlaMet ? 'bg-green-50 border-green-200 text-green-700' : daysOpen > 5 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                    <Zap size={14} /> Respuesta Cliente: {clientSlaMet ? 'LISTO' : daysOpen + '/5 Días'}
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase border ${claim.status === ClaimStatus.CLOSED ? 'bg-slate-100 text-slate-500' : daysOpen > 30 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <Timer size={14} /> Cierre Interno: {claim.status === ClaimStatus.CLOSED ? 'CERRADO' : daysOpen + '/30 Días'}
                </div>
           </div>

           {/* EXPECTED SOLUTION SECTION - NEW */}
           <div className={`mb-4 p-3 rounded-xl border flex items-center gap-3 ${claim.correctionType?.includes('$') ? 'bg-green-50 border-green-200 text-green-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
                <div className={`p-2 rounded-lg ${claim.correctionType?.includes('$') ? 'bg-green-100' : 'bg-blue-100'}`}>
                    <Target size={20} />
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase opacity-70 block mb-0.5">Solución Esperada por Cliente</span>
                    <p className="font-bold text-sm">{claim.correctionType || 'No especificada'}</p>
                </div>
           </div>

           <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 italic text-slate-700">
               <p className="text-xs font-bold text-slate-400 uppercase mb-2">Descripción del Problema</p>
               "{claim.description}"
           </div>

           {/* Products Table */}
           <div className="mb-6">
               <p className="text-xs font-bold text-slate-400 uppercase mb-2">Productos Afectados</p>
               {claim.affectedItems && claim.affectedItems.length > 0 ? (
                   <div className="border border-slate-200 rounded-lg overflow-hidden">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase">
                               <tr><th className="p-3">Referencia</th><th className="p-3">Lote</th><th className="p-3">Cantidad</th></tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {claim.affectedItems.map((item, idx) => (
                                   <tr key={idx} className="bg-white">
                                       <td className="p-3 font-medium text-slate-800">{item.productRef}</td>
                                       <td className="p-3 text-slate-500">{item.batch}</td>
                                       <td className="p-3 text-slate-500">{item.quantity}</td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               ) : (
                   <div className="flex gap-4">
                       <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Producto</span>
                          <p className="text-xs font-medium text-slate-800">{claim.productRef}</p>
                       </div>
                       <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Lote</span>
                          <p className="text-xs font-medium text-slate-800">{claim.batch}</p>
                       </div>
                   </div>
               )}
           </div>

           {/* Initial Evidence Grid */}
           {claim.files && claim.files.length > 0 && (
               <div>
                   <p className="text-xs font-bold text-slate-400 uppercase mb-2">Evidencia Inicial</p>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                       {claim.files.map((file, idx) => (
                           <FileThumbnail key={idx} file={file} onClick={() => onViewEvidence(file)} />
                       ))}
                   </div>
               </div>
           )}
       </div>
    );
};
