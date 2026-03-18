
import React, { useState } from 'react';
import { 
  Zap, CheckCircle2, Sparkles, Trash2, Eye, Stethoscope, Plus, ClipboardCheck, Activity, Upload, ThumbsUp, Send, MessageSquare, Edit3 
} from 'lucide-react';
import { Claim, ClaimStatus, InternalRole, Task, EvidenceFile } from '../../types';
import { enhanceIshikawaObservation, enhanceTaskInstruction, enhanceImmediateSolution } from '../../services/geminiService';

interface SectionProps {
    claim: Claim;
    isAdmin: boolean;
    currentRole: InternalRole;
}

// --- MITIGATION SECTION ---
interface MitigationSectionProps extends SectionProps {
    onAddMitigation: (desc: string, resp: string) => void;
    onExecuteMitigation: (id: string, note: string, file: File | null) => void;
    onApproveMitigation: (id: string) => void;
    onDeleteMitigation: (id: string) => void;
    onRequestChange: (id: string, currentText?: string) => void;
    onViewEvidence: (file: EvidenceFile) => void;
    onFinalizeResponse?: () => void;
}

export const MitigationSection: React.FC<MitigationSectionProps> = ({ 
    claim, isAdmin, currentRole, onAddMitigation, onExecuteMitigation, onApproveMitigation, onDeleteMitigation, onRequestChange, onViewEvidence, onFinalizeResponse 
}) => {
    const [input, setInput] = useState('');
    const [responsible, setResponsible] = useState('Logística');
    const [isEnhancing, setIsEnhancing] = useState(false);
    
    // Execution State
    const [executingId, setExecutingId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleEnhance = async () => {
        if(!input) return;
        setIsEnhancing(true);
        const res = await enhanceImmediateSolution(input);
        setInput(res);
        setIsEnhancing(false);
    };

    const handleAdd = () => {
        onAddMitigation(input, responsible);
        setInput('');
    };

    const submitExecution = () => {
        if(executingId && note) {
            onExecuteMitigation(executingId, note, file);
            setExecutingId(null); setNote(''); setFile(null);
        }
    };

    const canExecute = (assignedTo: string) => {
        if (!assignedTo) return false;
        // RESTRICTION: Only the assigned role can execute. Admin/Audit CANNOT execute for others.
        if (assignedTo === currentRole) return true;
        // Exception: Quality Aux can execute Quality tasks
        if (assignedTo === 'Calidad' && currentRole === InternalRole.QUALITY_AUX) return true;
        return false;
    };

    const isFullyApproved = claim.mitigationActions && claim.mitigationActions.length > 0 && claim.mitigationActions.every(m => m.status === 'Approved');

    return (
        <div className={`p-6 rounded-xl shadow-sm border ${claim.immediateSolutionStatus === 'Approved' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-bold flex items-center gap-2 ${claim.immediateSolutionStatus === 'Approved' ? 'text-green-900' : 'text-amber-900'}`}><Zap size={20}/> Acción de Mitigación Inmediata</h3>
                
                <div className="flex items-center gap-2">
                    {/* Case 1: Phase Closed (Highest Priority Status) - Only shows this */}
                    {claim.mitigationPhaseClosed ? (
                         <span className="text-xs font-bold bg-green-200 text-green-800 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-green-300">
                             <CheckCircle2 size={12}/> Mitigación Aprobada / Fase Cerrada
                         </span>
                    ) : (
                        <>
                            {/* Case 2: Approved but Phase NOT Closed - Show Button & Status */}
                            {isFullyApproved && isAdmin && onFinalizeResponse && (
                                <button 
                                    onClick={onFinalizeResponse}
                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg shadow-md font-bold flex items-center gap-2 transition-all hover:-translate-y-0.5"
                                    title="Enviar reporte al cliente y notificar áreas"
                                >
                                    <Send size={12} /> Cerrar Fase de Respuesta al Cliente
                                </button>
                            )}

                            {claim.immediateSolutionStatus === 'Approved' && (
                                <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-1.5 rounded-lg flex items-center gap-1">
                                    <CheckCircle2 size={12}/> Mitigado / Aprobado
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>
            
            {isAdmin && claim.status !== ClaimStatus.CLOSED && (
                <div className="space-y-3 border-b border-amber-200 pb-4 mb-4">
                    <p className="text-xs text-amber-700 font-bold mb-1">Agregar nueva instrucción:</p>
                    <div className="flex gap-2">
                    <select className="p-3 rounded-lg border border-amber-200 bg-white text-slate-900 w-40" value={responsible} onChange={e => setResponsible(e.target.value)}>
                        <option>Logística</option><option>Facturación</option><option>Calidad</option><option>Mantenimiento</option><option>Abastecimiento</option>
                    </select>
                    <input className="flex-1 p-3 rounded-lg border border-amber-200 bg-white text-slate-900 placeholder-slate-400" placeholder="Definir acción..." value={input} onChange={e => setInput(e.target.value)} />
                    <button onClick={handleEnhance} disabled={isEnhancing} className="p-2 text-amber-600 hover:bg-amber-100 rounded-full transition"><Sparkles size={18}/></button>
                    <button onClick={handleAdd} disabled={!input} className="bg-amber-500 text-white px-6 rounded-lg font-bold shadow-sm hover:bg-amber-600 transition disabled:opacity-50">Asignar</button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {claim.mitigationActions && claim.mitigationActions.length > 0 ? (
                    claim.mitigationActions.map((action) => (
                        <div key={action.id} className={`group relative bg-white p-4 rounded-xl border shadow-sm ${action.status === 'Approved' ? 'border-green-200 bg-green-50/20' : 'border-amber-100'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 pr-6">
                                    <div className="font-medium text-amber-900 text-sm mb-1 whitespace-pre-wrap">{action.description}</div>
                                    <div className="flex gap-2 items-center">
                                        <span className="text-amber-700 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded">Resp: {action.assignedTo}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${action.status === 'Approved' ? 'bg-green-200 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {action.status === 'Approved' ? 'APROBADO' : 'PENDIENTE'}
                                        </span>
                                        
                                        {/* EDIT / REQUEST CHANGE / DELETE BUTTONS */}
                                        {isAdmin && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); onRequestChange(action.id, action.description); }} className="ml-2 p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title={currentRole === InternalRole.AUDIT ? "Solicitar Cambio" : "Editar Texto"}>
                                                    {currentRole === InternalRole.AUDIT ? <MessageSquare size={14}/> : <Edit3 size={14}/>}
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); onDeleteMitigation(action.id); }} className="ml-1 p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full transition" title="Eliminar"><Trash2 size={14} /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Execution Panel (Always visible if responsible needs to edit) */}
                            {canExecute(action.assignedTo) && executingId !== action.id && (
                                <div className="mt-2">
                                    <button onClick={() => { setExecutingId(action.id); setNote(action.executionNotes || ''); }} className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-amber-700 transition flex items-center gap-2 shadow-lg shadow-amber-200">
                                        <CheckCircle2 size={14}/> {action.executionNotes ? "EDITAR REPORTE" : "EJECUTAR ACCIÓN"}
                                    </button>
                                </div>
                            )}

                            {executingId === action.id && (
                                <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 animate-fadeIn">
                                    <h4 className="font-bold text-slate-700 mb-2 text-sm">Reportar Ejecución</h4>
                                    <textarea className="w-full p-2 border rounded mb-2 text-sm bg-white text-slate-900" placeholder="Describa qué se hizo..." rows={2} value={note} onChange={e => setNote(e.target.value)}/>
                                    <div className="flex gap-2 items-center">
                                        <input type="file" className="text-xs" onChange={e => setFile(e.target.files?.[0] || null)} />
                                        <button onClick={submitExecution} className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold">Confirmar</button>
                                        <button onClick={() => setExecutingId(null)} className="text-slate-500 px-3 text-xs underline">Cancelar</button>
                                    </div>
                                </div>
                            )}

                            {action.executionNotes && (
                                <div className="mt-3 pt-3 border-t border-amber-100 text-sm text-slate-600">
                                    <p className="font-bold text-green-700 mb-1 text-xs uppercase tracking-wide">Ejecución:</p>
                                    <div className="whitespace-pre-wrap text-xs bg-slate-50 p-2 rounded border border-slate-100 font-mono text-slate-700">{action.executionNotes}</div>
                                    <div className="flex justify-between items-end mt-2">
                                        {action.executionEvidence && action.executionEvidence.length > 0 ? (
                                            <button onClick={() => onViewEvidence(action.executionEvidence![action.executionEvidence!.length - 1])} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1">
                                                <Eye size={12}/> Ver Evidencia
                                            </button>
                                        ) : <span></span>}
                                        {currentRole === InternalRole.AUDIT && action.status === 'Pending' && (
                                            <button onClick={() => onApproveMitigation(action.id)} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-700 transition flex items-center gap-1 shadow-sm">
                                                <CheckCircle2 size={12}/> Aprobar Item
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : !isAdmin && <p className="text-slate-400 italic text-center text-sm py-2">Sin mitigación definida.</p>}
            </div>
        </div>
    );
};

// --- ISHIKAWA SECTION ---
interface IshikawaSectionProps extends SectionProps {
    onSaveIshikawa: (category: string, observation: string) => void;
    onRequestChange: (id: string, currentText?: string) => void;
    onDeleteIshikawa: (id: string) => void;
}

export const IshikawaSection: React.FC<IshikawaSectionProps> = ({ claim, isAdmin, currentRole, onSaveIshikawa, onRequestChange, onDeleteIshikawa }) => {
    const [category, setCategory] = useState('Mano de Obra');
    const [observation, setObservation] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);

    const handleEnhance = async () => {
        if (!observation) return;
        setIsEnhancing(true);
        const enhanced = await enhanceIshikawaObservation(observation);
        setObservation(enhanced);
        setIsEnhancing(false);
    };

    const handleSave = () => {
        if (observation) {
            onSaveIshikawa(category, observation);
            setObservation('');
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
                 <div className="bg-slate-100 p-2 rounded-lg text-slate-600"><Stethoscope size={20}/></div>
                 <h3 className="text-lg font-bold text-slate-800">Análisis de Causa Raíz (Ishikawa)</h3>
             </div>
             
             {claim.ishikawaList && claim.ishikawaList.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                     {claim.ishikawaList.map((item) => (
                         <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm relative group">
                             <span className="font-bold text-indigo-600 block text-xs uppercase mb-1">{item.category}</span>
                             <p className="text-slate-700">{item.observation}</p>
                             
                             {/* ACTIONS FOR ISHIKAWA */}
                             {isAdmin && (
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-1 rounded backdrop-blur-sm">
                                    <button onClick={() => onRequestChange(item.id, item.observation)} className="text-blue-400 hover:text-blue-600 p-1">
                                        {currentRole === InternalRole.AUDIT ? <MessageSquare size={14}/> : <Edit3 size={14}/>}
                                    </button>
                                    <button onClick={() => onDeleteIshikawa(item.id)} className="text-red-300 hover:text-red-500 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                             )}
                         </div>
                     ))}
                 </div>
             ) : (
                 <p className="text-slate-400 italic text-sm mb-6 text-center">No se ha registrado análisis de causa.</p>
             )}

             {isAdmin && claim.status !== ClaimStatus.CLOSED && (
                 <div className="flex flex-col md:flex-row gap-3 items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <select 
                        className="p-3 rounded-lg border border-slate-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                     >
                         <option>Mano de Obra</option>
                         <option>Maquinaria</option>
                         <option>Materiales</option>
                         <option>Método</option>
                         <option>Medio Ambiente</option>
                         <option>Medición</option>
                     </select>
                     <div className="flex-1 w-full relative">
                         <input 
                            type="text" 
                            className="w-full p-3 pr-10 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-slate-900 placeholder-slate-400"
                            placeholder="Observación de causa..."
                            value={observation}
                            onChange={(e) => setObservation(e.target.value)}
                         />
                         <button 
                            onClick={handleEnhance} 
                            disabled={isEnhancing || !observation}
                            className="absolute right-2 top-2 p-1 text-indigo-400 hover:text-indigo-600 transition disabled:opacity-30"
                            title="Mejorar con IA"
                         >
                             <Sparkles size={16} className={isEnhancing ? 'animate-pulse' : ''} />
                         </button>
                     </div>
                     <button 
                        onClick={handleSave} 
                        disabled={!observation}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg font-bold text-sm shadow-md transition disabled:opacity-50"
                     >
                         <Plus size={18}/>
                     </button>
                 </div>
             )}
        </div>
    );
};

// --- ACTION PLAN SECTION ---
interface ActionPlanSectionProps extends SectionProps {
    onSaveTask: (desc: string, assignedTo: string) => void;
    onExecuteTask: (id: string, note: string, file: File | null) => void;
    onDeleteTask: (id: string) => void;
    onRequestChange: (id: string, currentText?: string) => void;
    onApprovePlan: () => void;
    onViewEvidence: (file: EvidenceFile) => void;
}

export const ActionPlanSection: React.FC<ActionPlanSectionProps> = ({
    claim, isAdmin, currentRole, onSaveTask, onExecuteTask, onDeleteTask, onRequestChange, onApprovePlan, onViewEvidence
}) => {
    const [taskDesc, setTaskDesc] = useState('');
    const [assignedTo, setAssignedTo] = useState('Mantenimiento');
    const [isEnhancing, setIsEnhancing] = useState(false);
    
    // Execution State
    const [executingId, setExecutingId] = useState<string | null>(null);
    const [execNote, setExecNote] = useState('');
    const [execFile, setExecFile] = useState<File | null>(null);

    const handleEnhance = async () => {
        if (!taskDesc) return;
        setIsEnhancing(true);
        const enhanced = await enhanceTaskInstruction(taskDesc);
        setTaskDesc(enhanced);
        setIsEnhancing(false);
    };

    const handleSave = () => {
        if (taskDesc) {
            onSaveTask(taskDesc, assignedTo);
            setTaskDesc('');
        }
    };

    const handleSubmitExecution = () => {
        if (executingId && execNote) {
            onExecuteTask(executingId, execNote, execFile);
            setExecutingId(null);
            setExecNote('');
            setExecFile(null);
        }
    };

    const canExecute = (assignedRole: string) => {
        // RESTRICTION: Only the assigned role can execute. Admin/Audit CANNOT execute for others.
        if (assignedRole === currentRole) return true;
        // Exception: Quality Aux can execute Quality tasks
        if (assignedRole === 'Calidad' && currentRole === InternalRole.QUALITY_AUX) return true;
        return false;
    };

    const allTasksRealized = claim.tasks && claim.tasks.length > 0 && claim.tasks.every(t => t.status === 'Realized');
    const planApproved = claim.actionPlanStatus === 'Approved';

    return (
        <div className={`p-6 rounded-xl border shadow-sm ${planApproved ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-2">
                     <div className={`p-2 rounded-lg ${planApproved ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                         <ClipboardCheck size={20}/>
                     </div>
                     <h3 className={`text-lg font-bold ${planApproved ? 'text-indigo-900' : 'text-slate-800'}`}>Plan de Acción</h3>
                 </div>
                 
                 {planApproved && (
                     <span className="bg-indigo-200 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                         <CheckCircle2 size={12}/> PLAN APROBADO
                     </span>
                 )}
            </div>

            {isAdmin && !planApproved && claim.status !== ClaimStatus.CLOSED && (
                <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Asignar Nueva Tarea</p>
                    <div className="flex flex-col md:flex-row gap-3">
                        <select 
                            className="p-3 rounded-lg border border-slate-200 bg-white text-sm w-full md:w-48"
                            value={assignedTo}
                            onChange={(e) => setAssignedTo(e.target.value)}
                        >
                            {Object.values(InternalRole).filter(r => r !== InternalRole.AUDIT).map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                        <div className="flex-1 relative">
                            <input 
                                className="w-full p-3 pr-10 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder-slate-400"
                                placeholder="Instrucción detallada..."
                                value={taskDesc}
                                onChange={(e) => setTaskDesc(e.target.value)}
                            />
                            <button onClick={handleEnhance} disabled={isEnhancing} className="absolute right-2 top-2 p-1 text-indigo-400 hover:text-indigo-600 transition">
                                <Sparkles size={16} className={isEnhancing ? 'animate-pulse' : ''} />
                            </button>
                        </div>
                        <button onClick={handleSave} disabled={!taskDesc} className="bg-slate-800 text-white px-5 rounded-lg font-bold text-sm hover:bg-black transition disabled:opacity-50">
                            Asignar
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {claim.tasks && claim.tasks.length > 0 ? (
                    claim.tasks.map(task => (
                        <div key={task.id} className={`p-4 rounded-xl border ${task.status === 'Realized' ? 'bg-white border-green-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded">{task.assignedTo}</span>
                                        {task.status === 'Realized' && <span className="text-[10px] font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={10}/> REALIZADO</span>}
                                    </div>
                                    <p className="text-sm text-slate-800 font-medium">{task.description}</p>
                                </div>
                                
                                {/* ADMIN/AUDIT ACTIONS */}
                                {isAdmin && !planApproved && (
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => onRequestChange(task.id, task.description)} className="p-1.5 text-blue-400 hover:text-blue-600 rounded hover:bg-blue-50 transition" title={currentRole === InternalRole.AUDIT ? "Solicitar Cambio" : "Editar Texto"}>
                                            {currentRole === InternalRole.AUDIT ? <MessageSquare size={16}/> : <Edit3 size={16}/>}
                                        </button>
                                        <button onClick={() => onDeleteTask(task.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* EXECUTION FORM (Shows if Pending OR if user clicks Edit on a realized task) */}
                            {(task.status === 'Pending' || executingId === task.id) && (
                                <div className="mt-3">
                                    {canExecute(task.assignedTo) && executingId !== task.id ? (
                                        <button onClick={() => { setExecutingId(task.id); setExecNote(task.executionNotes || ''); }} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold shadow hover:bg-indigo-700 transition flex items-center gap-1">
                                            <Activity size={12}/> {task.status === 'Realized' ? 'Editar Ejecución' : 'Ejecutar Tarea'}
                                        </button>
                                    ) : executingId === task.id ? (
                                        <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm animate-fadeIn">
                                            <p className="text-xs font-bold text-indigo-900 mb-2">Reporte de Ejecución</p>
                                            <textarea 
                                                className="w-full p-2 border border-slate-200 rounded text-sm mb-2 outline-none focus:border-indigo-500 bg-white text-slate-900 placeholder-slate-400"
                                                rows={2}
                                                placeholder="Resultados y observaciones..."
                                                value={execNote}
                                                onChange={(e) => setExecNote(e.target.value)}
                                            />
                                            <div className="flex items-center gap-2">
                                                <input type="file" className="text-xs" onChange={e => setExecFile(e.target.files?.[0] || null)} />
                                                <button onClick={handleSubmitExecution} className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold">Confirmar</button>
                                                <button onClick={() => setExecutingId(null)} className="text-slate-500 px-3 text-xs underline">Cancelar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">Pendiente de ejecución por {task.assignedTo}</p>
                                    )}
                                </div>
                            )}

                            {/* REALIZED DISPLAY */}
                            {task.status === 'Realized' && executingId !== task.id && (
                                <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 -mx-4 -mb-4 p-4 rounded-b-xl relative group">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Resultado:</p>
                                    <p className="text-sm text-slate-700 italic mb-2">"{task.executionNotes}"</p>
                                    {task.executionEvidence && task.executionEvidence.length > 0 && (
                                        <button onClick={() => onViewEvidence(task.executionEvidence![0])} className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold">
                                            <Eye size={12}/> Ver Evidencia Adjunta
                                        </button>
                                    )}
                                    
                                    {/* Re-edit button for owner */}
                                    {canExecute(task.assignedTo) && !planApproved && (
                                        <button 
                                            onClick={() => { setExecutingId(task.id); setExecNote(task.executionNotes || ''); }}
                                            className="absolute top-3 right-3 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1 shadow-sm"
                                            title="Corregir Ejecución"
                                        >
                                            <Edit3 size={14}/>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-6 text-slate-400 italic text-sm border-2 border-dashed border-slate-100 rounded-xl">
                        No hay tareas definidas en el plan.
                    </div>
                )}
            </div>

            {isAdmin && !planApproved && allTasksRealized && claim.ishikawaList && claim.ishikawaList.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                    <button onClick={onApprovePlan} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200 transition flex items-center justify-center gap-2 animate-bounce-subtle">
                        <ThumbsUp size={20}/> Aprobar Plan de Acción y Cerrar Caso (Admin)
                    </button>
                </div>
            )}
        </div>
    );
};
