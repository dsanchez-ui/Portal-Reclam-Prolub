
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  AlertTriangle, 
  User, 
  Wrench, 
  LogOut,
  ClipboardList,
  Upload,
  CheckCircle2, 
  ShieldCheck,
  Briefcase,
  LayoutDashboard,
  HardHat,
  CheckSquare,
  Factory,
  Truck,
  FlaskConical,
  History,
  Lock,
  FileText,
  ArrowRight,
  ChevronLeft,
  File as FileIcon,
  Video,
  Eye,
  Info,
  Paperclip,
  Trash2,
  Sparkles,
  Edit3,
  ExternalLink,
  FolderOpen,
  BarChart3,
  Clock,
  PieChart,
  TrendingUp,
  Target,
  Calendar,
  Activity,
  ListFilter,
  Package,
  Zap,
  Save,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ClipboardCheck,
  SearchCheck,
  X,
  Plus,
  Receipt,
  Container,
  Timer,
  FileSearch,
  MessageCircle,
  Stethoscope,
  Image as ImageIcon,
  Layers,
  Award
} from 'lucide-react';
import { Claim, ClaimStatus, IncidentType, InternalRole, IshikawaEntry, Task, EvidenceFile, Brand } from '../types';
import { enhanceExecutionNote, enhanceIshikawaObservation, enhanceTaskInstruction, enhanceImmediateSolution } from '../services/geminiService';

interface InternalManagementProps {
  claims: Claim[];
  onUpdateClaim: (updatedClaim: Claim, newFiles?: File[]) => void;
  onLogout: () => void;
}

const statusColors = {
  [ClaimStatus.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [ClaimStatus.ANALYSIS]: 'bg-blue-100 text-blue-800 border-blue-200',
  [ClaimStatus.ASSIGNED]: 'bg-purple-100 text-purple-800 border-purple-200',
  [ClaimStatus.FOR_CLOSURE]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  [ClaimStatus.CLOSED]: 'bg-green-100 text-green-800 border-green-200',
};

const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(dateStr);
};

const getDaysPassed = (dateStr: string) => {
    const start = parseDate(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const LabDashboard: React.FC<InternalManagementProps> = ({ claims, onUpdateClaim, onLogout }) => {
  const [currentRole, setCurrentRole] = useState<InternalRole | null>(null);
  const [labFilter, setLabFilter] = useState<'ACTION' | 'TRACKING'>('ACTION');
  const [hseqFilter, setHseqFilter] = useState<'QUICK_SOLUTIONS' | 'APPROVED_MITIGATIONS' | 'PENDING' | 'HISTORY' | 'DASHBOARD'>('QUICK_SOLUTIONS');
  const [kpiSelectedClaimId, setKpiSelectedClaimId] = useState<string>('');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });

  const [urgentClaims, setUrgentClaims] = useState<Claim[]>([]);
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  const [slaModalShownThisSession, setSlaModalShownThisSession] = useState(false);

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [ishikawaInput, setIshikawaInput] = useState({ category: 'Maquinaria', observation: '' });
  const [taskInput, setTaskInput] = useState({ description: '', assignedTo: 'Mantenimiento (Manuel)' });
  const [immediateSolutionInput, setImmediateSolutionInput] = useState('');
  const [immediateResponsibleInput, setImmediateResponsibleInput] = useState('Mantenimiento (Manuel)');
  const [hseqFeedbackInput, setHseqFeedbackInput] = useState('');
  
  const [isEnhancingIshikawa, setIsEnhancingIshikawa] = useState(false);
  const [isEnhancingTask, setIsEnhancingTask] = useState(false);
  const [isEnhancingImmediate, setIsEnhancingImmediate] = useState(false);

  const selectedClaim = claims.find(c => c.id === selectedClaimId);

  useEffect(() => {
    if (selectedClaim) {
        setImmediateSolutionInput(selectedClaim.immediateSolution || '');
        setImmediateResponsibleInput(selectedClaim.immediateSolutionResponsible || 'Mantenimiento (Manuel)');
        setHseqFeedbackInput(selectedClaim.immediateSolutionFeedback || '');
    }
  }, [selectedClaimId, selectedClaim]);

  useEffect(() => {
    if (currentRole && !slaModalShownThisSession) {
        const roleClaims = claims.filter(c => {
            if (c.status === ClaimStatus.CLOSED) return false;
            if (currentRole === InternalRole.LAB || currentRole === InternalRole.HSEQ) return true;
            
            const roleMap: Record<string, string> = {
                [InternalRole.MAINTENANCE]: 'Mantenimiento',
                [InternalRole.PRODUCTION]: 'Producción',
                [InternalRole.LOGISTICS]: 'Logística',
                [InternalRole.QUALITY_AUX]: 'Calidad',
                [InternalRole.BILLING]: 'Facturación',
                [InternalRole.SUPPLY]: 'Abastecimiento'
            };
            const roleKeyword = roleMap[currentRole as string];
            return c.tasks?.some(t => t.assignedTo.includes(roleKeyword) && t.status === 'Pending');
        });

        const critical = roleClaims.filter(c => getDaysPassed(c.date) >= 25);
        if (critical.length > 0) {
            setUrgentClaims(critical);
            setIsSlaModalOpen(true);
            setSlaModalShownThisSession(true);
        }
    }
  }, [currentRole, claims, slaModalShownThisSession]);

  const kpiData = useMemo(() => {
    if (currentRole !== InternalRole.HSEQ) return null;
    const total = claims.length;
    const closed = claims.filter(c => c.status === ClaimStatus.CLOSED).length;
    const open = total - closed;
    const qualityCount = claims.filter(c => c.incidentType === IncidentType.QUALITY).length;
    const logisticsCount = claims.filter(c => c.incidentType === IncidentType.LOGISTICS).length;
    
    const byBrand = {
        [Brand.GULF]: claims.filter(c => c.brand === Brand.GULF).length,
        [Brand.VALVOLINE]: claims.filter(c => c.brand === Brand.VALVOLINE).length,
        [Brand.MAQUILA]: claims.filter(c => c.brand === Brand.MAQUILA).length,
    };

    let totalDays = 0;
    let closedCountWithDates = 0;
    claims.forEach(c => {
        if (c.status === ClaimStatus.CLOSED) {
            totalDays += Math.floor(Math.random() * 5) + 1;
            closedCountWithDates++;
        }
    });
    const avgDays = closedCountWithDates > 0 ? (totalDays / closedCountWithDates).toFixed(1) : "0";

    const areaStats: Record<string, { total: number, completed: number }> = {
        'Mantenimiento': { total: 0, completed: 0 },
        'Producción': { total: 0, completed: 0 },
        'Logística': { total: 0, completed: 0 },
        'Calidad': { total: 0, completed: 0 },
        'Facturación': { total: 0, completed: 0 },
        'Abastecimiento': { total: 0, completed: 0 }
    };

    claims.forEach(c => {
        c.tasks?.forEach(t => {
            let key = 'Otros';
            if (t.assignedTo.includes('Mantenimiento')) key = 'Mantenimiento';
            else if (t.assignedTo.includes('Producción')) key = 'Producción';
            else if (t.assignedTo.includes('Logística')) key = 'Logística';
            else if (t.assignedTo.includes('Calidad')) key = 'Calidad';
            else if (t.assignedTo.includes('Facturación')) key = 'Facturación';
            else if (t.assignedTo.includes('Abastecimiento')) key = 'Abastecimiento';
            
            if (areaStats[key]) {
                areaStats[key].total += 1;
                if (t.status === 'Realized') areaStats[key].completed += 1;
            }
        });
    });
    return { total, closed, open, qualityCount, logisticsCount, byBrand, avgDays, areaStats };
  }, [claims, currentRole]);

  const individualKpiData = useMemo(() => {
     if (!kpiSelectedClaimId) return null;
     const claim = claims.find(c => c.id === kpiSelectedClaimId);
     if (!claim) return null;
     const daysOpen = getDaysPassed(claim.date);
     const totalTasks = claim.tasks?.length || 0;
     const completedTasks = claim.tasks?.filter(t => t.status === 'Realized').length || 0;
     const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
     return { claim, daysOpen, progress, totalTasks, completedTasks };
  }, [kpiSelectedClaimId, claims]);

  const triggerToast = (msg: string) => {
    setShowToast({ message: msg, visible: true });
    setTimeout(() => setShowToast({ message: '', visible: false }), 3000);
  };

  const handleRoleSelectAttempt = (role: InternalRole) => {
    if (role === InternalRole.HSEQ) {
      setIsPinModalOpen(true);
      setPinInput('');
      setPinError(false);
    } else {
      setCurrentRole(role);
      setSelectedClaimId(null);
    }
  };

  const verifyPin = () => {
    if (pinInput === '1234') {
      setCurrentRole(InternalRole.HSEQ);
      setSelectedClaimId(null);
      setIsPinModalOpen(false);
    } else {
      setPinError(true);
    }
  };

  const handleEnhanceIshikawa = async () => {
    if (!ishikawaInput.observation.trim()) return;
    setIsEnhancingIshikawa(true);
    const enhanced = await enhanceIshikawaObservation(ishikawaInput.observation);
    setIshikawaInput(prev => ({ ...prev, observation: enhanced }));
    setIsEnhancingIshikawa(false);
  };

  const handleAddIshikawa = () => {
    if (!selectedClaim || !ishikawaInput.observation) return;
    const newEntry: IshikawaEntry = {
      id: Date.now().toString(),
      category: ishikawaInput.category,
      observation: ishikawaInput.observation,
      createdAt: new Date().toLocaleString()
    };
    onUpdateClaim({
      ...selectedClaim,
      status: ClaimStatus.ANALYSIS,
      ishikawaList: [...(selectedClaim.ishikawaList || []), newEntry]
    });
    setIshikawaInput(prev => ({ ...prev, observation: '' }));
    triggerToast("Análisis agregado.");
  };

  const handleEnhanceImmediate = async () => {
    if (!immediateSolutionInput.trim()) return;
    setIsEnhancingImmediate(true);
    const enhanced = await enhanceImmediateSolution(immediateSolutionInput);
    setImmediateSolutionInput(enhanced);
    setIsEnhancingImmediate(false);
  };

  const handleSaveImmediateSolution = () => {
    if (!selectedClaim) return;
    onUpdateClaim({ 
        ...selectedClaim, 
        immediateSolution: immediateSolutionInput,
        immediateSolutionResponsible: immediateResponsibleInput,
        immediateSolutionStatus: 'Pending',
        immediateSolutionFeedback: '' 
    });
    triggerToast("Solución enviada a HSEQ.");
  };

  const handleApproveImmediate = () => {
    if (!selectedClaim) return;
    onUpdateClaim({ ...selectedClaim, immediateSolutionStatus: 'Approved' });
    triggerToast("Solución Inmediata APROBADA.");
    setSelectedClaimId(null);
  };

  const handleRejectImmediate = () => {
    if (!selectedClaim) return;
    onUpdateClaim({ 
        ...selectedClaim, 
        immediateSolutionStatus: 'Rejected',
        immediateSolutionFeedback: hseqFeedbackInput 
    });
    triggerToast("Solución Inmediata RECHAZADA.");
    setSelectedClaimId(null);
  };

  const handleAssignTask = () => {
    if (!selectedClaim || !taskInput.description) return;
    const newTask: Task = {
      id: Date.now().toString(),
      description: taskInput.description,
      assignedTo: taskInput.assignedTo,
      status: 'Pending',
      createdAt: new Date().toLocaleString()
    };
    onUpdateClaim({
      ...selectedClaim,
      status: ClaimStatus.ASSIGNED,
      tasks: [...(selectedClaim.tasks || []), newTask]
    });
    setTaskInput(prev => ({ ...prev, description: '' }));
    triggerToast(`Tarea asignada a ${taskInput.assignedTo}.`);
  };

  const handleExecutionNoteChange = (taskId: string, text: string) => {
    if (!selectedClaim) return;
    const updatedTasks = selectedClaim.tasks?.map(t => {
      if (t.id === taskId) return { ...t, executionNotes: text };
      return t;
    });
    onUpdateClaim({ ...selectedClaim, tasks: updatedTasks });
  };

  const handleUploadEvidence = (taskId: string, files: FileList | null) => {
    if (!selectedClaim || !files || files.length === 0) return;
    const rawFilesArray = Array.from(files);
    const newFiles: EvidenceFile[] = rawFilesArray.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file)
    }));
    const updatedTasks = selectedClaim.tasks?.map(t => {
      if (t.id === taskId) {
        const existingEvidence = t.executionEvidence || [];
        return { ...t, executionEvidence: [...existingEvidence, ...newFiles] };
      }
      return t;
    });
    onUpdateClaim({ ...selectedClaim, tasks: updatedTasks }, rawFilesArray);
    triggerToast("Evidencia cargada.");
  };

  const handleMarkAsDone = (taskId: string) => {
    if (!selectedClaim) return;
    const task = selectedClaim.tasks?.find(t => t.id === taskId);
    if (!task?.executionEvidence || task.executionEvidence.length === 0) {
        triggerToast("ERROR: Falta evidencia.");
        return;
    }
    const updatedTasks = selectedClaim.tasks?.map(t => {
      if (t.id === taskId) return { ...t, status: 'Realized' as const, completedAt: new Date().toLocaleString() };
      return t;
    });
    const allTasksRealized = updatedTasks?.every(t => t.status === 'Realized');
    let newStatus = selectedClaim.status;
    if (allTasksRealized) newStatus = ClaimStatus.FOR_CLOSURE;
    onUpdateClaim({ ...selectedClaim, tasks: updatedTasks, status: newStatus });
    triggerToast("Tarea finalizada.");
  };

  // --- PARCHE: LÓGICA DE EJECUCIÓN MITIGACIÓN INMEDIATA ---
  const handleImmediateExecutionNoteChange = (text: string) => {
    if (!selectedClaim) return;
    onUpdateClaim({ ...selectedClaim, immediateSolutionExecutionNotes: text });
  };

  const handleUploadImmediateEvidence = (files: FileList | null) => {
    if (!selectedClaim || !files || files.length === 0) return;
    const rawFilesArray = Array.from(files);
    const newFiles: EvidenceFile[] = rawFilesArray.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file)
    }));
    const existingEvidence = selectedClaim.immediateSolutionExecutionEvidence || [];
    onUpdateClaim({ 
        ...selectedClaim, 
        immediateSolutionExecutionEvidence: [...existingEvidence, ...newFiles] 
    }, rawFilesArray);
    triggerToast("Evidencia cargada.");
  };

  const handleSendImmediateToHSEQ = () => {
    if (!selectedClaim) return;
    if (!selectedClaim.immediateSolutionExecutionNotes) {
        triggerToast("ERROR: El reporte es obligatorio.");
        return;
    }
    onUpdateClaim({ ...selectedClaim, immediateSolutionStatus: 'Pending' });
    triggerToast("Enviado a Jenny para aprobación.");
  };
  // -------------------------------------------------------------

  const handleFinalClose = () => {
    if (!selectedClaim) return;
    onUpdateClaim({ ...selectedClaim, status: ClaimStatus.CLOSED });
    triggerToast("TICKET CERRADO EXITOSAMENTE.");
    setSelectedClaimId(null);
  };

  const filteredClaims = claims.filter(c => {
    if (currentRole === InternalRole.HSEQ) {
      if (hseqFilter === 'DASHBOARD') return false; 
      if (hseqFilter === 'QUICK_SOLUTIONS') return c.immediateSolution && (c.immediateSolutionStatus === 'Pending' || c.immediateSolutionStatus === 'Rejected');
      if (hseqFilter === 'APPROVED_MITIGATIONS') return c.immediateSolution && c.immediateSolutionStatus === 'Approved';
      if (hseqFilter === 'PENDING') return c.status === ClaimStatus.FOR_CLOSURE;
      if (hseqFilter === 'HISTORY') return c.status === ClaimStatus.CLOSED;
    }
    if (currentRole === InternalRole.LAB) {
        if (labFilter === 'ACTION') return c.status === ClaimStatus.PENDING || c.status === ClaimStatus.ANALYSIS;
        return c.status === ClaimStatus.ASSIGNED || c.status === ClaimStatus.FOR_CLOSURE || c.status === ClaimStatus.CLOSED;
    }
    
    const roleMap: Record<string, string> = {
        [InternalRole.MAINTENANCE]: 'Mantenimiento (Manuel)',
        [InternalRole.PRODUCTION]: 'Producción (Andrea)',
        [InternalRole.LOGISTICS]: 'Logística (Germán/Javier)',
        [InternalRole.QUALITY_AUX]: 'Calidad (Interno)',
        [InternalRole.BILLING]: 'Facturación',
        [InternalRole.SUPPLY]: 'Abastecimiento'
    };
    
    const roleKeyword = roleMap[currentRole as string] || 'Otros';
    
    // Ruteo dinámico: Tareas Estructurales O Mitigación Inmediata Asignada
    const hasStructuralTask = c.tasks?.some(t => t.assignedTo.includes(roleKeyword.split(' (')[0]));
    const isMitigationResponsible = c.immediateSolutionResponsible === currentRole;
    
    return hasStructuralTask || isMitigationResponsible;
  });

  const RoleCard = ({ role, label, icon: Icon, colorClass, desc }: any) => (
    <button onClick={() => handleRoleSelectAttempt(role)} className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all flex flex-col items-center text-center group h-full relative overflow-hidden">
        <div className={`w-16 h-16 rounded-2xl ${colorClass} bg-opacity-10 flex items-center justify-center mb-4 group-hover:scale-110 transition duration-300`}>
             <Icon size={32} className={colorClass.replace('bg-', 'text-')} />
        </div>
        <h3 className="text-xl font-black text-slate-800 mb-1">{label}</h3>
        <p className="text-xs text-slate-400 font-medium">{desc}</p>
        <div className={`mt-auto pt-6 text-xs font-black uppercase tracking-widest flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${colorClass.replace('bg-', 'text-')}`}>Ingresar <ArrowRight size={14} /></div>
    </button>
  );

  // --- PARCHE: LÓGICA DE COMPARACIÓN ROBUSTA DE ROLES ---
  const normalizeRoleString = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s*\(.*?\)\s*/g, "").trim() : "";
  const claimResponsibleNorm = normalizeRoleString(selectedClaim?.immediateSolutionResponsible || "");
  const currentRoleNorm = normalizeRoleString(currentRole || "");
  const isImmediateResponsibleMatch = claimResponsibleNorm && currentRoleNorm && (claimResponsibleNorm.includes(currentRoleNorm) || currentRoleNorm.includes(claimResponsibleNorm));

  useEffect(() => {
    if (selectedClaim && currentRole) {
        console.log("DEBUG MITIGACIÓN:", {
            currentRole: currentRole,
            responsibleInClaim: selectedClaim.immediateSolutionResponsible,
            matchResult: isImmediateResponsibleMatch
        });
    }
  }, [selectedClaim, currentRole, isImmediateResponsibleMatch]);
  // ------------------------------------------------------

  const handleChangeRole = () => {
    setCurrentRole(null);
    setSlaModalShownThisSession(false);
  };

  if (!currentRole) {
    return (
      <div className="min-h-screen flex flex-col relative bg-slate-50">
        {isPinModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-sm w-full text-center animate-fadeIn">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 shadow-inner">
                        <Lock size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-1">Acceso HSEQ</h3>
                    <p className="text-sm text-slate-500 mb-6">Ingrese su código de seguridad</p>
                    <input type="password" autoFocus placeholder="PIN" className="w-full text-center text-3xl font-mono tracking-[0.5em] p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-green-500/20 mb-2 transition-all" value={pinInput} onChange={(e) => { setPinInput(e.target.value); setPinError(false); }} onKeyDown={(e) => e.key === 'Enter' && verifyPin()} />
                    {pinError && <p className="text-xs text-red-500 font-bold mb-4">Código incorrecto.</p>}
                    <div className="flex gap-2">
                        <button onClick={() => setIsPinModalOpen(false)} className="flex-1 py-3 text-slate-500 font-black hover:bg-slate-50 rounded-xl transition">Cancelar</button>
                        <button onClick={verifyPin} className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition">Ingresar</button>
                    </div>
                </div>
            </div>
        )}
        <header className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white pt-16 pb-24 px-6 text-center rounded-b-[4rem] shadow-2xl relative border-b border-indigo-500/30">
           <h1 className="text-4xl font-black mb-2 tracking-tight">Gestión Interna</h1>
           <p className="text-indigo-200 font-medium">Control de calidad y excelencia operativa Prolub</p>
           <div className="mt-4 inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/10">
              <Timer size={14} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-wider">SLA Corporativo: Máximo 30 días para cierre técnico</span>
           </div>
           <button onClick={onLogout} className="absolute top-8 left-8 text-white/70 hover:text-white flex items-center gap-2 text-sm font-bold"><ChevronLeft size={18} /> Volver al Inicio</button>
        </header>
        <div className="flex-1 px-6 -mt-16 pb-20 max-w-6xl mx-auto w-full relative z-10">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <RoleCard role={InternalRole.LAB} label="Laboratorio" desc="Mayerly: Análisis y Plan de Acción." icon={FlaskConical} colorClass="bg-indigo-600" />
              <RoleCard role={InternalRole.MAINTENANCE} label="Mantenimiento" desc="Manuel: Ejecución técnica." icon={Wrench} colorClass="bg-orange-500" />
              <RoleCard role={InternalRole.PRODUCTION} label="Producción" desc="Andrea: Líneas de fabricación." icon={Factory} colorClass="bg-orange-500" />
              <RoleCard role={InternalRole.LOGISTICS} label="Logística" desc="Germán/Javier: Bodega y transporte." icon={Truck} colorClass="bg-orange-500" />
              <RoleCard role={InternalRole.BILLING} label="Facturación" desc="Gestión de Notas Crédito." icon={Receipt} colorClass="bg-orange-500" />
              <RoleCard role={InternalRole.SUPPLY} label="Abastecimiento" desc="Reposición de Insumos." icon={Container} colorClass="bg-orange-500" />
              <RoleCard role={InternalRole.QUALITY_AUX} label="Auxiliar Calidad" desc="Apoyo técnico en planta." icon={ClipboardCheck} colorClass="bg-orange-500" />
              <RoleCard role={InternalRole.HSEQ} label="HSEQ / Jenny" desc="Cierres, Auditoría e Indicadores." icon={ShieldCheck} colorClass="bg-green-600" />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      
      {isSlaModalOpen && (
          <div className="fixed inset-0 bg-red-900/90 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white rounded-[3rem] shadow-2xl max-w-2xl w-full p-12 text-center border-t-[12px] border-red-600 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Timer size={200} />
                  </div>
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8 text-red-600 shadow-inner">
                      <AlertTriangle size={48} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">¡Alerta de Vencimiento SLA!</h2>
                  <p className="text-slate-500 text-lg font-medium mb-8">Tienes <span className="text-red-600 font-black">{urgentClaims.length} casos</span> que superan los 25 días. Por favor, prioriza su gestión hoy mismo para cumplir el límite de 30 días.</p>
                  
                  <div className="max-h-60 overflow-y-auto space-y-3 mb-10 pr-2">
                      {urgentClaims.map(c => (
                          <div key={c.id} className="flex justify-between items-center p-5 bg-red-50 rounded-2xl border border-red-100">
                              <div className="text-left">
                                  <p className="font-black text-slate-800 mb-1 leading-none">{c.client}</p>
                                  <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest">{c.id}</p>
                              </div>
                              <div className="text-right">
                                  <span className="text-xl font-black text-red-700">{getDaysPassed(c.date)}</span>
                                  <span className="text-[10px] font-bold text-red-400 block uppercase">Días Abierto</span>
                              </div>
                          </div>
                      ))}
                  </div>
                  
                  <button onClick={() => setIsSlaModalOpen(false)} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 text-lg">Entendido, priorizaré estos casos <ArrowRight size={20}/></button>
              </div>
          </div>
      )}

      <div className="bg-white border-b border-slate-200 px-8 py-5 shadow-sm z-30 flex justify-between items-center">
        <div className="flex items-center gap-4">
             <div className={`w-12 h-12 rounded-2xl ${currentRole === InternalRole.LAB ? 'bg-indigo-600' : currentRole === InternalRole.HSEQ ? 'bg-green-600' : 'bg-orange-500'} flex items-center justify-center text-white shadow-lg`}>
                <User size={24} />
             </div>
             <div>
                 <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Estación Activa</h2>
                 <p className="text-xl font-black text-slate-900 leading-none">{currentRole === InternalRole.LAB ? 'Mayerly (Laboratorio)' : currentRole === InternalRole.HSEQ ? 'Jenny (HSEQ)' : currentRole}</p>
             </div>
        </div>
        <div className="hidden md:flex items-center gap-3 px-6 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl">
            <Timer size={18} className="text-amber-500" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Límite de Gestión: <span className="text-slate-900">30 Días Calendario</span></p>
        </div>
        <button onClick={handleChangeRole} className="text-slate-600 hover:text-indigo-600 flex items-center gap-2 text-sm font-black bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-200 transition">
            <LayoutDashboard size={18} /> <span>Cambiar Área</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        <div className="w-85 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 shadow-inner overflow-hidden">
          
          <div className="bg-slate-50/50 p-2 space-y-1">
              {currentRole === InternalRole.LAB && (
                  <div className="flex gap-1">
                      <button onClick={() => { setLabFilter('ACTION'); setSelectedClaimId(null); }} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition ${labFilter === 'ACTION' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}>Por Gestionar</button>
                      <button onClick={() => { setLabFilter('TRACKING'); setSelectedClaimId(null); }} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition ${labFilter === 'TRACKING' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}>Seguimiento</button>
                  </div>
              )}
              {currentRole === InternalRole.HSEQ && (
                  <div className="space-y-1">
                      <button onClick={() => { setHseqFilter('QUICK_SOLUTIONS'); setSelectedClaimId(null); }} className={`w-full py-3 px-4 text-left text-[10px] font-black uppercase rounded-xl transition flex items-center gap-3 ${hseqFilter === 'QUICK_SOLUTIONS' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}>
                         <Zap size={14} /> Aprobar Soluciones Inmediatas
                      </button>
                      <button onClick={() => { setHseqFilter('PENDING'); setSelectedClaimId(null); }} className={`w-full py-3 px-4 text-left text-[10px] font-black uppercase rounded-xl transition flex items-center gap-3 ${hseqFilter === 'PENDING' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}>
                         <ShieldCheck size={14} /> Tickets Pendientes por Cerrar
                      </button>
                      <button onClick={() => { setHseqFilter('APPROVED_MITIGATIONS'); setSelectedClaimId(null); }} className={`w-full py-3 px-4 text-left text-[10px] font-black uppercase rounded-xl transition flex items-center gap-3 ${hseqFilter === 'APPROVED_MITIGATIONS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}>
                         <CheckCircle2 size={14} /> Histórico Mitigaciones Aprobadas
                      </button>
                      <div className="flex gap-1 pt-1">
                        <button onClick={() => { setHseqFilter('HISTORY'); setSelectedClaimId(null); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition ${hseqFilter === 'HISTORY' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>Histórico</button>
                        <button onClick={() => { setHseqFilter('DASHBOARD'); setSelectedClaimId(null); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition ${hseqFilter === 'DASHBOARD' ? 'bg-indigo-700 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>Indicadores</button>
                      </div>
                  </div>
              )}
          </div>

          {hseqFilter !== 'DASHBOARD' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative group">
                        <Search className="absolute left-3 top-3 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                        <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredClaims.length === 0 ? (
                        <div className="text-center py-20 opacity-40">
                            <FolderOpen size={40} className="mx-auto mb-3 text-slate-300" strokeWidth={1}/>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin registros</p>
                        </div>
                    ) : (
                        filteredClaims.map((claim) => {
                            const days = getDaysPassed(claim.date);
                            const isCritical = days >= 25 && claim.status !== ClaimStatus.CLOSED;
                            const isVencido = days > 30 && claim.status !== ClaimStatus.CLOSED;

                            return (
                                <div key={claim.id} onClick={() => setSelectedClaimId(claim.id)} className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 relative group ${selectedClaimId === claim.id ? 'border-indigo-600 bg-indigo-50 shadow-xl ring-1 ring-indigo-600' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-md'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${statusColors[claim.status]}`}>{claim.status}</span>
                                        <div className={`flex items-center gap-1 text-[9px] font-black ${isVencido ? 'text-red-600 animate-pulse' : isCritical ? 'text-amber-600' : 'text-slate-400'}`}>
                                            <Timer size={10} /> {isVencido ? 'VENCIDO' : `Día ${days}`}
                                        </div>
                                    </div>
                                    <h4 className="font-black text-slate-800 text-sm mb-1 leading-tight truncate">{claim.client}</h4>
                                    <p className="text-[10px] text-slate-500 truncate font-medium">{claim.productRef}</p>
                                    
                                    {isCritical && (
                                        <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${isVencido ? 'bg-red-600' : 'bg-amber-500'}`} style={{ width: `${Math.min((days / 30) * 100, 100)}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
              </div>
          )}
        </div>

        <div className="flex-1 bg-slate-50 p-10 overflow-y-auto">
          
          {currentRole === InternalRole.HSEQ && hseqFilter === 'DASHBOARD' && kpiData && (
              <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
                     <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                           <BarChart3 className="text-indigo-600" size={40}/>
                           {kpiSelectedClaimId ? 'Auditoría Técnica' : 'Panel de Indicadores'}
                        </h2>
                        <p className="text-slate-500 font-medium text-lg mt-1">Control de calidad y cumplimiento operativo Prolub.</p>
                     </div>
                     <select className="pl-4 pr-10 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-black shadow-sm focus:ring-4 focus:ring-indigo-500/10 outline-none cursor-pointer" value={kpiSelectedClaimId} onChange={(e) => setKpiSelectedClaimId(e.target.value)}>
                         <option value="">Vista Global</option>
                         {claims.map(c => <option key={c.id} value={c.id}>{c.id} - {c.client}</option>)}
                     </select>
                 </div>

                 {!kpiSelectedClaimId ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Reportes</span>
                            <h3 className="text-4xl font-black text-slate-900">{kpiData.total}</h3>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">En Curso</span>
                            <h3 className="text-4xl font-black text-amber-500">{kpiData.open}</h3>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cerrados</span>
                            <h3 className="text-4xl font-black text-green-600">{kpiData.closed}</h3>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Días SLA</span>
                            <h3 className="text-4xl font-black text-indigo-600">{kpiData.avgDays}</h3>
                        </div>
                        <div className="md:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Eficiencia Operativa</h3>
                            <div className="space-y-8">
                                {Object.entries(kpiData.areaStats).map(([area, stats]: [string, any]) => {
                                    const perc = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                                    return (
                                        <div key={area}>
                                            <div className="flex justify-between text-sm font-black text-slate-700 mb-2">
                                                <span>{area}</span>
                                                <span className="text-indigo-600">{perc}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner">
                                                <div className={`h-full rounded-full transition-all duration-1000 ${perc === 100 ? 'bg-green-500' : 'bg-indigo-600'}`} style={{ width: `${perc}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="md:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col">
                             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-10 text-center">Resumen SLA Corporativo</h3>
                             <div className="flex-1 flex flex-col justify-center items-center gap-6">
                                <div className="w-48 h-48 rounded-full border-[12px] border-slate-50 flex flex-col items-center justify-center relative shadow-inner">
                                    <Timer size={40} className="text-slate-200 absolute top-6" />
                                    <span className="text-5xl font-black text-slate-900">30</span>
                                    <span className="text-xs font-black text-slate-400 uppercase">Días Límite</span>
                                </div>
                                <p className="text-xs font-bold text-slate-400 text-center px-10 leading-relaxed uppercase tracking-wider">Todos los tickets deben resolverse antes de cumplir los 30 días calendario.</p>
                             </div>
                        </div>
                    </div>
                 ) : (
                    <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100">
                        {individualKpiData && (
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xs font-black text-indigo-500 uppercase tracking-[0.3em] mb-2">Auditoría en Curso</h3>
                                    <h4 className="text-4xl font-black text-slate-900 tracking-tight">{individualKpiData.claim.client}</h4>
                                </div>
                                <div className="flex items-center gap-10">
                                    <div className="text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Días Abierto</p>
                                        <p className={`text-4xl font-black ${individualKpiData.daysOpen >= 25 ? 'text-red-600' : 'text-slate-900'}`}>{individualKpiData.daysOpen}</p>
                                    </div>
                                    <div className="text-right border-l pl-10 border-slate-100">
                                        <span className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest ${statusColors[individualKpiData.claim.status]}`}>{individualKpiData.claim.status}</span>
                                        <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-widest">Progreso Ejecución: {individualKpiData.progress}%</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                 )}
              </div>
          )}

          {currentRole === InternalRole.LAB && selectedClaim && (
              <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn pb-32">
                  
                  <div className="flex justify-between items-center border-b border-slate-200 pb-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-100 rounded-3xl text-indigo-600 shadow-sm"><FlaskConical size={32}/></div>
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Módulo de Gestión Laboratorio</h3>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">{selectedClaim.client}</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-6 py-3 rounded-2xl border flex flex-col items-center ${getDaysPassed(selectedClaim.date) >= 25 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Tiempo Transcurrido</span>
                            <span className="text-xl font-black">{getDaysPassed(selectedClaim.date)} / 30 Días</span>
                        </div>
                        <button onClick={() => setSelectedClaimId(null)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition"><X size={28}/></button>
                    </div>
                 </div>

                 <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl">
                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3"><Info size={16}/> 1. Contexto Original del Reporte</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 p-8 bg-slate-50 rounded-[2rem] border border-slate-100 italic text-slate-700 leading-relaxed shadow-inner">
                            "{selectedClaim.description}"
                        </div>
                        <div className="space-y-4">
                            <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Referencia Producto</span>
                                <span className="text-sm font-black text-slate-800 leading-tight">{selectedClaim.productRef}</span>
                            </div>
                            <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Lote (Batch)</span>
                                <span className="text-sm font-black text-slate-800 font-mono">{selectedClaim.batch}</span>
                            </div>
                        </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    
                    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl flex flex-col border-t-8 border-t-amber-400">
                        <div className="flex justify-between items-center mb-8">
                            <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3"><Zap size={16} className="fill-amber-500"/> 2. Acción de Mitigación Inmediata</h4>
                            {selectedClaim.immediateSolutionStatus === 'Approved' && <span className="text-[8px] bg-green-100 text-green-700 px-3 py-1 rounded-full font-black uppercase ring-1 ring-green-600/20">Aprobada HSEQ</span>}
                        </div>
                        
                        {selectedClaim.immediateSolutionFeedback && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-[10px] font-black text-red-800 leading-tight animate-pulse">
                                COMENTARIO DE JENNY: "{selectedClaim.immediateSolutionFeedback}"
                            </div>
                        )}

                        <div className="space-y-4 flex-grow">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Responsable de Ejecución</label>
                                <select 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-amber-500/10" 
                                    value={immediateResponsibleInput} 
                                    onChange={e => setImmediateResponsibleInput(e.target.value)}
                                >
                                    <option value={InternalRole.MAINTENANCE}>Mantenimiento (Manuel)</option>
                                    <option value={InternalRole.PRODUCTION}>Producción (Andrea)</option>
                                    <option value={InternalRole.LOGISTICS}>Logística (Germán/Javier)</option>
                                    <option value={InternalRole.QUALITY_AUX}>Calidad (Interno)</option>
                                    <option value={InternalRole.BILLING}>Facturación</option>
                                    <option value={InternalRole.SUPPLY}>Abastecimiento</option>
                                </select>
                            </div>

                            <div className="space-y-2 flex-grow">
                                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Descripción de la Acción</label>
                                <textarea 
                                    className="w-full p-8 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm font-bold outline-none focus:ring-8 focus:ring-amber-500/5 focus:border-amber-400 resize-none min-h-[120px] shadow-inner" 
                                    placeholder="Describir acción rápida para mitigar el reclamo (Ej: Bloqueo de lote, reemplazo urgente)..."
                                    value={immediateSolutionInput}
                                    onChange={e => setImmediateSolutionInput(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <div className="mt-6 flex gap-3">
                            <button onClick={handleEnhanceImmediate} disabled={isEnhancingImmediate || !immediateSolutionInput} className="p-5 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-100 disabled:opacity-30 transition"><Sparkles size={20}/></button>
                            <button onClick={handleSaveImmediateSolution} disabled={!immediateSolutionInput} className="flex-1 py-5 bg-amber-500 text-white font-black rounded-2xl shadow-xl shadow-amber-100 hover:bg-amber-600 transition flex items-center justify-center gap-3"><Save size={20}/> Guardar y Enviar a HSEQ</button>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl border-t-8 border-t-indigo-500">
                        <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-3"><Activity size={16}/> 3. Análisis de Causa Raíz (Ishikawa)</h4>
                        
                        <div className="space-y-4 mb-10 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {selectedClaim.ishikawaList?.length === 0 ? (
                                <div className="text-center py-10 opacity-30">
                                    <SearchCheck size={40} className="mx-auto mb-2"/>
                                    <p className="text-xs font-black uppercase">Sin hallazgos registrados</p>
                                </div>
                            ) : (
                                selectedClaim.ishikawaList?.map((entry) => (
                                    <div key={entry.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group relative hover:border-indigo-300 transition shadow-sm">
                                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-1">{entry.category}</span>
                                        <p className="text-sm text-slate-800 font-bold leading-tight">{entry.observation}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-8 border-t border-slate-100 space-y-4">
                            <div className="flex gap-2">
                                <select className="w-1/3 p-3 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/10" value={ishikawaInput.category} onChange={e => setIshikawaInput(p => ({...p, category: e.target.value}))}>
                                    {['Maquinaria', 'Mano de Obra', 'Material', 'Método', 'Medio Ambiente'].map(c => <option key={c}>{c}</option>)}
                                </select>
                                <input type="text" className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="Hallazgo técnico..." value={ishikawaInput.observation} onChange={e => setIshikawaInput(p => ({...p, observation: e.target.value}))} />
                                <button onClick={handleEnhanceIshikawa} disabled={isEnhancingIshikawa || !ishikawaInput.observation} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 disabled:opacity-30"><Sparkles size={18}/></button>
                            </div>
                            <button onClick={handleAddIshikawa} disabled={!ishikawaInput.observation} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition flex items-center justify-center gap-2"><Plus size={18}/> Registrar Causa</button>
                        </div>
                    </div>
                 </div>

                 <div className="bg-white rounded-[3rem] p-12 border border-slate-200 shadow-2xl border-t-8 border-t-purple-500">
                    <div className="flex justify-between items-center mb-10">
                        <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] flex items-center gap-3"><Wrench size={16}/> 4. Plan de Acción Definitivo y Asignaciones</h4>
                        <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase">{selectedClaim.tasks?.length || 0} Tareas</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                        {selectedClaim.tasks?.map(task => (
                            <div key={task.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-start hover:border-purple-300 transition-colors shadow-sm">
                                <div className="max-w-[75%]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-black text-slate-800 text-xs uppercase tracking-wider">{task.assignedTo}</span>
                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${task.status === 'Realized' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status === 'Realized' ? 'Completado' : 'Pendiente'}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 font-bold leading-tight italic">"{task.description}"</p>
                                </div>
                                <div className="p-2 bg-white rounded-xl text-slate-300"><CheckSquare size={18}/></div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-10 border-t border-slate-100 bg-slate-50/50 p-10 rounded-[2.5rem]">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Asignar Nueva Instrucción Operativa</h5>
                        <div className="flex flex-col lg:flex-row gap-4 items-end">
                            <div className="flex-1 space-y-2 w-full">
                                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Responsable de Ejecución</label>
                                <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-purple-500/10" value={taskInput.assignedTo} onChange={e => setTaskInput(p => ({...p, assignedTo: e.target.value}))}>
                                    <option>Mantenimiento (Manuel)</option>
                                    <option>Producción (Andrea)</option>
                                    <option>Logística (Germán/Javier)</option>
                                    <option>Calidad (Interno)</option>
                                    <option>Facturación</option>
                                    <option>Abastecimiento</option>
                                </select>
                            </div>
                            <div className="flex-[2] space-y-2 w-full">
                                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Instrucción Técnica / Orden de Trabajo</label>
                                <input className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-purple-500/10" placeholder="¿Qué acción correctiva debe realizar el área?" value={taskInput.description} onChange={e => setTaskInput(p => ({...p, description: e.target.value}))}/>
                            </div>
                            <button onClick={handleAssignTask} className="w-full lg:w-auto px-10 py-4 bg-purple-600 text-white font-black rounded-2xl shadow-xl shadow-purple-200 hover:bg-purple-700 transition transform active:scale-95 flex items-center justify-center gap-2 h-[56px]"><Plus size={20}/> Asignar</button>
                        </div>
                    </div>
                 </div>

              </div>
          )}

          {currentRole === InternalRole.HSEQ && hseqFilter === 'QUICK_SOLUTIONS' && selectedClaim && (
              <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn">
                <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-8">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg"><Zap size={24} /></div>
                        Aprobación de Solución de Choque
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border ${getDaysPassed(selectedClaim.date) >= 25 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                            {getDaysPassed(selectedClaim.date)} / 30 Días
                        </div>
                        <button onClick={() => setSelectedClaimId(null)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition"><X size={28}/></button>
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl mb-10">
                    <div className="flex justify-between mb-6">
                        <h4 className="text-3xl font-black text-slate-900 leading-none">{selectedClaim.client}</h4>
                        <span className="text-xs font-black text-slate-400 uppercase font-mono tracking-widest">{selectedClaim.id}</span>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 italic text-sm text-slate-600">
                        REPORTADO: "{selectedClaim.description}"
                    </div>
                </div>

                <div className="bg-white rounded-[3.5rem] shadow-2xl border-8 border-amber-500/5 p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full -mr-20 -mt-20"></div>
                    <div className="mb-12">
                        <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-6 flex items-center gap-3"><Sparkles size={18}/> PROPUESTA DE MITIGACIÓN (MAYERLY)</h3>
                        <div className="flex flex-col gap-4">
                            <span className="text-sm font-black text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 self-start">Responsable Ejecución: {selectedClaim.immediateSolutionResponsible || 'No asignado'}</span>
                            <blockquote className="text-4xl font-black text-slate-900 leading-tight tracking-tight">"{selectedClaim.immediateSolution}"</blockquote>
                        </div>
                    </div>

                    {/* REPORTE DE EJECUCIÓN DEL ÁREA PARA JENNY */}
                    {selectedClaim.immediateSolutionExecutionNotes && (
                        <div className="mb-12 pt-10 border-t border-slate-100 space-y-6 animate-fadeIn">
                            <h3 className="text-xs font-black text-green-600 uppercase tracking-widest flex items-center gap-3">
                                <CheckCircle2 size={18}/> REPORTE DE CIERRE DE MITIGACIÓN
                            </h3>
                            <div className="bg-green-50 p-8 rounded-[2rem] border border-green-100 shadow-inner italic font-bold text-slate-700 leading-relaxed">
                                {selectedClaim.immediateSolutionExecutionNotes}
                            </div>
                            
                            {selectedClaim.immediateSolutionExecutionEvidence && selectedClaim.immediateSolutionExecutionEvidence.length > 0 && (
                                <div className="grid grid-cols-3 gap-4">
                                    {selectedClaim.immediateSolutionExecutionEvidence.map((file, idx) => (
                                        <div key={idx} className="aspect-video bg-white rounded-xl border border-slate-200 overflow-hidden relative group shadow-sm">
                                            {file.type.startsWith('image/') ? (
                                                <img src={file.url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                                    <Video size={24} className="text-indigo-500"/>
                                                    <span className="text-[8px] font-bold text-slate-400 truncate w-full px-2 text-center">{file.name}</span>
                                                </div>
                                            )}
                                            <a href={file.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                <Eye size={24} className="text-white"/>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="pt-10 border-t border-slate-100 space-y-8">
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block mb-4 flex items-center gap-3"><MessageSquare size={16}/> Ajustes o Retroalimentación</label>
                            <textarea className="w-full p-8 bg-slate-50 border border-slate-200 rounded-[2.5rem] text-sm font-bold outline-none focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500 transition-all resize-none shadow-inner" rows={3} placeholder="Instrucciones adicionales para el laboratorio..." value={hseqFeedbackInput} onChange={(e) => setHseqFeedbackInput(e.target.value)} />
                        </div>
                        <div className="flex gap-4">
                            <button onClick={handleRejectImmediate} className="flex-1 py-7 bg-white border-2 border-red-100 text-red-600 font-black rounded-3xl hover:bg-red-50 transition-all flex items-center justify-center gap-3 group"><ThumbsDown size={20} className="group-hover:scale-125 transition-transform"/> SOLICITAR AJUSTE</button>
                            <button onClick={handleApproveImmediate} className="flex-[2] py-7 bg-green-600 text-white font-black rounded-3xl shadow-2xl shadow-green-200 hover:bg-green-700 transition-all transform active:scale-95 flex items-center justify-center gap-4 text-xl group"><ThumbsUp size={28} className="group-hover:scale-110 transition-transform"/> APROBAR AHORA</button>
                        </div>
                    </div>
                </div>
              </div>
          )}

          {currentRole === InternalRole.HSEQ && hseqFilter === 'APPROVED_MITIGATIONS' && selectedClaim && (
              <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn pb-20">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-8">
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><CheckCircle2 size={24} /></div>
                          Histórico: Mitigación Aprobada
                      </h2>
                      <button onClick={() => setSelectedClaimId(null)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition"><X size={28}/></button>
                  </div>

                  <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl">
                      <div className="flex justify-between mb-6">
                          <h4 className="text-3xl font-black text-slate-900 leading-none">{selectedClaim.client}</h4>
                          <span className="text-xs font-black text-slate-400 uppercase font-mono tracking-widest">{selectedClaim.id}</span>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 italic text-sm text-slate-600 mb-6">
                          REPORTADO: "{selectedClaim.description}"
                      </div>

                      <div className="bg-green-50 border-2 border-green-200 rounded-[2.5rem] p-10 space-y-6">
                          <div className="flex items-center gap-4 mb-6">
                              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg">
                                  <CheckCircle2 size={32} strokeWidth={3}/>
                              </div>
                              <div>
                                  <h3 className="text-xs font-black text-green-700 uppercase tracking-widest">MITIGACIÓN APROBADA</h3>
                                  <p className="text-sm text-green-600 font-bold">Estado: Cerrada por HSEQ</p>
                              </div>
                          </div>

                          <div className="space-y-4">
                              <div>
                                  <span className="text-xs font-black text-green-700 uppercase block mb-2">Responsable de Ejecución:</span>
                                  <p className="text-lg font-bold text-slate-800">{selectedClaim.immediateSolutionResponsible || 'No especificado'}</p>
                              </div>

                              <div>
                                  <span className="text-xs font-black text-green-700 uppercase block mb-2">Acción de Mitigación:</span>
                                  <blockquote className="text-xl font-black text-slate-900 leading-tight tracking-tight italic p-6 bg-white rounded-2xl border border-green-100">
                                      "{selectedClaim.immediateSolution}"
                                  </blockquote>
                              </div>

                              {selectedClaim.immediateSolutionExecutionNotes && (
                                  <div>
                                      <span className="text-xs font-black text-green-700 uppercase block mb-2">Reporte de Cierre:</span>
                                      <div className="p-6 bg-white rounded-2xl border border-green-100 italic text-slate-700">
                                          {selectedClaim.immediateSolutionExecutionNotes}
                                      </div>
                                  </div>
                              )}

                              {selectedClaim.immediateSolutionExecutionEvidence && selectedClaim.immediateSolutionExecutionEvidence.length > 0 && (
                                  <div>
                                      <span className="text-xs font-black text-green-700 uppercase block mb-2">Evidencias Adjuntas:</span>
                                      <div className="grid grid-cols-3 gap-4">
                                          {selectedClaim.immediateSolutionExecutionEvidence.map((file, idx) => (
                                              <div key={idx} className="aspect-video bg-white rounded-xl border border-green-100 overflow-hidden relative group shadow-sm">
                                                  {file.type.startsWith('image/') ? (
                                                      <img src={file.url} className="w-full h-full object-cover" alt="Evidencia"/>
                                                  ) : (
                                                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                                          <Video size={24} className="text-indigo-500"/>
                                                          <span className="text-[8px] font-bold text-slate-400 truncate w-full px-2 text-center">{file.name}</span>
                                                      </div>
                                                  )}
                                                  <a href={file.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                      <Eye size={24} className="text-white"/>
                                                  </a>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {currentRole === InternalRole.HSEQ && hseqFilter === 'HISTORY' && selectedClaim && (
              <div className="max-w-6xl mx-auto space-y-12 animate-fadeIn pb-32">
                  <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Award size={28} /></div>
                        <div>
                           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Expediente Técnico: Caso Cerrado</h2>
                           <p className="text-sm font-bold text-green-600 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 size={14}/> Gestión Finalizada Exitosamente</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                          <div className="px-6 py-2 rounded-2xl border text-center bg-white border-slate-200 shadow-sm">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SLA de Cierre</p>
                              <p className="text-lg font-black text-slate-800">{getDaysPassed(selectedClaim.date)} Días</p>
                          </div>
                          <button onClick={() => setSelectedClaimId(null)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition"><X size={28}/></button>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      
                      {/* INFORMACIÓN DEL CLIENTE Y REPORTE */}
                      <div className="lg:col-span-2 space-y-8">
                          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl">
                              <div className="flex justify-between items-start mb-8">
                                  <div>
                                      <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2">1. Información del Cliente</h4>
                                      <h3 className="text-3xl font-black text-slate-900 leading-tight">{selectedClaim.client}</h3>
                                  </div>
                                  <span className="text-[10px] font-black font-mono text-slate-400 border border-slate-100 px-3 py-1 rounded-lg uppercase">{selectedClaim.id}</span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                                  <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Reportado Por</span>
                                      <p className="text-sm font-bold text-slate-700">{selectedClaim.reporterName || 'Comercial'}</p>
                                  </div>
                                  <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fecha Reporte</span>
                                      <p className="text-sm font-bold text-slate-700">{selectedClaim.date}</p>
                                  </div>
                                  <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Tipo Incidente</span>
                                      <p className="text-sm font-bold text-slate-700">{selectedClaim.incidentType}</p>
                                  </div>
                                  <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Solución Técnica</span>
                                      <p className="text-sm font-bold text-slate-700">{selectedClaim.correctionType}</p>
                                  </div>
                              </div>
                          </div>

                          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-8 opacity-5"><MessageCircle size={150} /></div>
                              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                  <FileText size={14}/> 2. Reporte Original del Comercial
                              </h4>
                              <p className="text-xl font-medium leading-relaxed italic opacity-90">
                                  "{selectedClaim.description}"
                              </p>
                          </div>
                      </div>

                      {/* DATOS DEL PRODUCTO */}
                      <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl flex flex-col">
                          <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-8">3. Trazabilidad Producto</h4>
                          
                          <div className="space-y-6 flex-1">
                              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Factura de Referencia</span>
                                  <p className="text-sm font-black text-slate-800">{selectedClaim.invoiceNumber}</p>
                              </div>
                              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Marca / Línea</span>
                                  <p className="text-sm font-black text-slate-800">{selectedClaim.brand}</p>
                              </div>
                              
                              {selectedClaim.affectedItems && selectedClaim.affectedItems.length > 0 ? (
                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Lista de Items Afectados</span>
                                      {selectedClaim.affectedItems.map(item => (
                                          <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-[10px]">
                                              <p className="font-black text-slate-800 mb-1">{item.productRef}</p>
                                              <div className="flex justify-between font-bold text-slate-500">
                                                  <span>LOTE: {item.batch}</span>
                                                  <span>CANT: {item.quantity}</span>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <>
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Referencia Principal</span>
                                        <p className="text-sm font-black text-slate-800 leading-tight">{selectedClaim.productRef}</p>
                                    </div>
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Número de Lote (Batch)</span>
                                        <p className="text-sm font-black text-amber-600 font-mono tracking-widest">{selectedClaim.batch}</p>
                                    </div>
                                  </>
                              )}
                          </div>
                      </div>

                      {/* ANÁLISIS ISHIKAWA (CAUSA RAÍZ) */}
                      <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl border-t-8 border-indigo-600">
                          <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                             <Stethoscope size={16}/> 4. Hallazgos Causa Raíz
                          </h4>
                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              {selectedClaim.ishikawaList && selectedClaim.ishikawaList.length > 0 ? (
                                  selectedClaim.ishikawaList.map(item => (
                                      <div key={item.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group">
                                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-2">{item.category}</span>
                                          <p className="text-sm font-bold text-slate-700 leading-tight italic">"{item.observation}"</p>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-center py-10 opacity-30 italic text-sm">Sin detalles de Ishikawa registrados.</div>
                              )}
                          </div>
                      </div>

                      {/* MITIGACIÓN INMEDIATA */}
                      <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl border-t-8 border-amber-500">
                          <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                             <Zap size={16} className="fill-amber-500"/> 5. Acción de Mitigación Inmediata
                          </h4>
                          
                          <div className="space-y-8">
                             <div className="p-8 bg-amber-50 rounded-[2rem] border border-amber-100">
                                 <span className="text-[10px] font-black text-amber-700 uppercase block mb-2">Instrucción de Laboratorio</span>
                                 <p className="text-xl font-black text-slate-800 leading-tight">"{selectedClaim.immediateSolution || 'No se registró acción rápida.'}"</p>
                                 <div className="mt-4 flex items-center gap-3">
                                     <span className="text-[10px] font-bold text-amber-600 bg-white px-3 py-1 rounded-full border border-amber-200">Ejecutado por: {selectedClaim.immediateSolutionResponsible || 'Área Técnica'}</span>
                                 </div>
                             </div>

                             {selectedClaim.immediateSolutionExecutionNotes && (
                                <div className="space-y-4">
                                   <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Reporte de Ejecución</h5>
                                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 italic font-bold text-slate-600">
                                       {selectedClaim.immediateSolutionExecutionNotes}
                                   </div>
                                </div>
                             )}

                             {selectedClaim.immediateSolutionExecutionEvidence && selectedClaim.immediateSolutionExecutionEvidence.length > 0 && (
                                 <div className="grid grid-cols-3 gap-4">
                                     {selectedClaim.immediateSolutionExecutionEvidence.map((file, idx) => (
                                         <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-slate-100 relative group shadow-sm">
                                             {file.type.startsWith('image/') ? (
                                                 <img src={file.url} className="w-full h-full object-cover" alt="Evidencia"/>
                                             ) : (
                                                 <div className="w-full h-full bg-slate-100 flex items-center justify-center text-indigo-500"><Video size={24}/></div>
                                             )}
                                             <a href={file.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                 <Eye size={20} className="text-white"/>
                                             </a>
                                         </div>
                                     ))}
                                 </div>
                             )}
                          </div>
                      </div>

                      {/* PLAN DE ACCIÓN DEFINITIVO (TAREAS ESTRUCTURALES) */}
                      <div className="lg:col-span-3 bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-2xl border-t-8 border-green-600">
                          <h4 className="text-xs font-black text-green-600 uppercase tracking-[0.4em] mb-12 flex items-center gap-3">
                             <Wrench size={20}/> 6. Plan de Acción Estructural y Ejecución Final
                          </h4>
                          
                          <div className="space-y-12">
                              {selectedClaim.tasks && selectedClaim.tasks.length > 0 ? (
                                  selectedClaim.tasks.map((task) => (
                                      <div key={task.id} className="relative pl-12 border-l-4 border-slate-50 pb-12 last:pb-0">
                                          <div className="absolute -left-[14px] top-0 w-6 h-6 rounded-full bg-green-500 shadow-lg flex items-center justify-center text-white ring-4 ring-white"><CheckCircle2 size={14} strokeWidth={3}/></div>
                                          
                                          <div className="flex flex-col lg:flex-row gap-10 items-start">
                                              <div className="flex-1 space-y-4">
                                                  <div className="flex items-center gap-3">
                                                      <span className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-3 py-1 rounded-lg">{task.assignedTo}</span>
                                                      <span className="text-[10px] font-bold text-slate-400 font-mono">{task.completedAt || 'Finalizado'}</span>
                                                  </div>
                                                  <h5 className="text-2xl font-black text-slate-900 tracking-tight leading-tight italic">"{task.description}"</h5>
                                                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 italic font-bold text-slate-700 leading-relaxed shadow-inner">
                                                      RESULTADO TÉCNICO: "{task.executionNotes || 'Tarea documentada y ejecutada satisfactoriamente.'}"
                                                  </div>
                                              </div>
                                              
                                              {task.executionEvidence && task.executionEvidence.length > 0 && (
                                                  <div className="lg:w-1/3 grid grid-cols-2 gap-3">
                                                      {task.executionEvidence.map((file, idx) => (
                                                          <div key={idx} className="aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative group shadow-md">
                                                              {file.type.startsWith('image/') ? (
                                                                  <img src={file.url} className="w-full h-full object-cover" alt="Tarea Evidencia"/>
                                                              ) : (
                                                                  <div className="w-full h-full flex items-center justify-center text-red-500"><FileIcon size={32}/></div>
                                                              )}
                                                              <a href={file.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><Eye size={32} className="text-white"/></a>
                                                          </div>
                                                      ))}
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-center py-20 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                                      <p className="text-slate-400 font-bold uppercase text-sm">No se registraron tareas estructurales adicionales.</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="bg-slate-900 rounded-[3rem] p-12 text-center text-white space-y-6 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                         <div className="absolute top-0 left-0 w-64 h-64 bg-green-500 blur-[120px] rounded-full"></div>
                      </div>
                      <ShieldCheck size={64} className="mx-auto text-green-500 mb-4" />
                      <h4 className="text-4xl font-black tracking-tight">Resolución Técnica de Calidad</h4>
                      <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
                          Este caso ha cumplido con todos los protocolos de Prolub S.A., incluyendo análisis de causa raíz y ejecución verificada por el área de HSEQ. El expediente ha sido archivado en el histórico corporativo.
                      </p>
                      <button onClick={() => setSelectedClaimId(null)} className="mt-8 px-12 py-4 bg-white text-slate-900 font-black rounded-2xl hover:bg-green-500 hover:text-white transition-all transform active:scale-95 shadow-xl">VOLVER AL LISTADO</button>
                  </div>
              </div>
          )}

          {currentRole === InternalRole.HSEQ && hseqFilter === 'PENDING' && selectedClaim && (
              <div className="max-w-6xl mx-auto space-y-12 animate-fadeIn pb-32">
                    <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-8">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                           <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><ShieldCheck size={24} /></div>
                           Cierre Formal y Auditoría de Gestión
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className={`px-6 py-2 rounded-2xl border text-center ${getDaysPassed(selectedClaim.date) >= 25 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SLA Cumplido</p>
                                <p className={`text-lg font-black ${getDaysPassed(selectedClaim.date) > 30 ? 'text-red-600' : 'text-slate-800'}`}>{getDaysPassed(selectedClaim.date)} / 30 Días</p>
                            </div>
                            <button onClick={() => setSelectedClaimId(null)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition"><X size={28}/></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                        <div className="lg:col-span-1 space-y-8">
                            <div className="bg-white rounded-[3rem] shadow-xl p-10 text-center border border-slate-100">
                                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 shadow-inner">
                                    <ShieldCheck size={48} />
                                </div>
                                <h4 className="text-2xl font-black text-slate-800 mb-1 leading-tight">{selectedClaim.client}</h4>
                                <p className="text-xs font-black text-slate-400 font-mono tracking-widest uppercase">{selectedClaim.id}</p>
                            </div>
                        </div>

                        <div className="lg:col-span-3 space-y-10">
                            <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                                <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">VALIDACIÓN FINAL</h3>
                                        <p className="text-2xl font-black">Plan de Tareas Completado</p>
                                    </div>
                                    <div className="bg-green-500/20 text-green-400 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-green-500/30">
                                        Auditoría Ok
                                    </div>
                                </div>

                                <div className="p-12 space-y-12 bg-white">
                                    {selectedClaim.tasks?.map((task) => (
                                        <div key={task.id} className="relative pl-12 border-l-4 border-slate-50 pb-12 last:pb-0">
                                            <div className="absolute -left-[14px] top-0 w-6 h-6 rounded-full bg-green-500 shadow-lg flex items-center justify-center text-white ring-4 ring-white"><CheckCircle2 size={14} strokeWidth={3}/></div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{task.assignedTo}</h5>
                                                    <h6 className="text-xl font-black text-slate-800 leading-tight">{task.description}</h6>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-50 px-3 py-1 rounded-lg">{task.completedAt?.split(',')[0]}</span>
                                            </div>
                                            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 italic text-slate-700 leading-relaxed shadow-inner">
                                                EJECUCIÓN: "{task.executionNotes || 'No hay notas técnicas.'}"
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-12 bg-slate-50 border-t border-slate-100 flex flex-col items-center text-center">
                                    <h4 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">¿Confirmar Cierre Definitivo?</h4>
                                    <p className="text-slate-500 font-medium max-w-xl mb-10 text-lg">Al cerrar, el comercial y el cliente recibirán la resolución técnica final.</p>
                                    <button onClick={handleFinalClose} className="w-full max-w-lg py-8 bg-slate-900 text-white font-black rounded-[2.5rem] shadow-2xl hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-5 text-xl group"><CheckCircle2 size={32} className="group-hover:scale-110 transition-transform"/> CERRAR TICKET DEFINITIVAMENTE</button>
                                </div>
                            </div>
                        </div>
                    </div>
              </div>
          )}

          {/* GESTIÓN DE ÁREAS (Mantenimiento, Producción, etc.) */}
          {currentRole !== InternalRole.LAB && currentRole !== InternalRole.HSEQ && selectedClaim && (
               <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn pb-20">
                    
                    {/* CABECERA DE ÁREA CON SLA */}
                    <div className="flex justify-between items-center mb-8 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
                         <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center shadow-inner">
                                <HardHat size={32} />
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Módulo de Ejecución Operativa</h3>
                                <h2 className="text-2xl font-black text-slate-900">{currentRole}</h2>
                            </div>
                         </div>
                         <div className={`px-6 py-3 rounded-2xl border text-center ${getDaysPassed(selectedClaim.date) >= 25 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cronómetro SLA</p>
                            <p className={`text-xl font-black ${getDaysPassed(selectedClaim.date) >= 25 ? 'text-red-600' : 'text-slate-800'}`}>{getDaysPassed(selectedClaim.date)} / 30 Días</p>
                         </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* COLUMNA IZQUIERDA: EXPEDIENTE Y EVIDENCIAS ORIGINALES */}
                        <div className="lg:col-span-1 space-y-10">
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-8">
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-3 border-b border-indigo-50 pb-4">
                                    <ImageIcon size={16}/> Evidencias del Cliente
                                </h4>
                                
                                {selectedClaim.files && selectedClaim.files.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {selectedClaim.files.map((file, idx) => (
                                            <div key={idx} className="group relative rounded-2xl overflow-hidden aspect-video border border-slate-100 shadow-sm bg-slate-50">
                                                {file.type.startsWith('image/') ? (
                                                    <img src={file.url} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
                                                        {file.type.includes('pdf') ? <FileText size={32} className="text-red-500" /> : <Video size={32} className="text-blue-500" />}
                                                        <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center">{file.name}</span>
                                                    </div>
                                                )}
                                                <a href={file.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Eye size={32} className="text-white" />
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 opacity-30">
                                        <FolderOpen size={40} className="mx-auto mb-2"/>
                                        <p className="text-[10px] font-black uppercase">Sin archivos originales</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white space-y-6">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-3">
                                    <FileSearch size={16}/> Datos de Facturación
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Factura</span>
                                        <span className="text-sm font-black text-indigo-200">{selectedClaim.invoiceNumber}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Marca</span>
                                        <span className="text-sm font-black text-indigo-200">{selectedClaim.brand}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Lote/Batch</span>
                                        <span className="text-sm font-black text-amber-400 font-mono">{selectedClaim.batch}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: CONTEXTO TÉCNICO Y ACCIÓN */}
                        <div className="lg:col-span-2 space-y-10">
                            
                            {/* Bloque 1: El Problema y Análisis Lab */}
                            <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 space-y-10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-600">
                                    <MessageCircle size={120} />
                                </div>
                                
                                <div className="space-y-4 relative z-10">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                        <MessageCircle size={14}/> Reporte Original (Comercial)
                                    </h3>
                                    <p className="text-2xl font-black text-slate-800 leading-tight italic">
                                        "{selectedClaim.description}"
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 pt-10 border-t border-slate-100">
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                            <Zap size={14} className="fill-amber-500"/> Mitigación Inmediata Lab
                                        </h3>
                                        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                                            <p className="text-sm font-bold text-amber-900 leading-relaxed italic">
                                                "{selectedClaim.immediateSolution || 'Sin solución inmediata registrada.'}"
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                            <Stethoscope size={14}/> Hallazgos de Causa Raíz
                                        </h3>
                                        <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3">
                                            {selectedClaim.ishikawaList && selectedClaim.ishikawaList.length > 0 ? (
                                                selectedClaim.ishikawaList.map(i => (
                                                    <div key={i.id} className="flex gap-2">
                                                        <span className="text-[8px] bg-white text-indigo-600 px-2 py-0.5 rounded-lg border border-indigo-200 shrink-0 font-black uppercase">{i.category}</span>
                                                        <p className="text-[11px] font-bold text-indigo-900 leading-tight">{i.observation}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-[11px] text-indigo-300 italic">Análisis simplificado.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* BLOQUE 1: SI ESTÁ APROBADA - MOSTRAR CHECK VERDE */}
                                {selectedClaim.immediateSolution && 
                                 selectedClaim.immediateSolution !== 'Sin solución inmediata registrada.' && 
                                 selectedClaim.immediateSolutionStatus === 'Approved' && (
                                    <div className="mt-6 p-8 bg-green-50 border-2 border-green-300 rounded-[2rem] flex items-center gap-6 shadow-lg animate-fadeIn">
                                        <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center text-white shadow-xl flex-shrink-0">
                                            <CheckCircle2 size={40} strokeWidth={3}/>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-green-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <ShieldCheck size={16}/> Mitigación Aprobada por HSEQ (Jenny)
                                            </h4>
                                            <p className="text-lg font-bold text-green-900 leading-tight">
                                                La acción inmediata fue validada y cerrada. Continuar con el plan de acción estructural.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* BLOQUE 2: SI NO ESTÁ APROBADA - MOSTRAR FORMULARIO DE CIERRE */}
                                {selectedClaim.immediateSolution && 
                                 selectedClaim.immediateSolution !== 'Sin solución inmediata registrada.' && 
                                 selectedClaim.immediateSolutionStatus !== 'Approved' && (
                                    <div className="mt-6 p-6 bg-white border-2 border-dashed border-green-200 rounded-2xl space-y-4 animate-fadeIn">
                                        <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest">
                                            TU REPORTE DE CIERRE (MITIGACIÓN INMEDIATA)
                                        </h4>
                                        
                                        <textarea 
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-green-500/20 shadow-inner"
                                            rows={3}
                                            placeholder="Describe detalladamente qué acciones tomaste para cumplir la mitigación inmediata…"
                                            value={selectedClaim.immediateSolutionExecutionNotes || ''}
                                            onChange={(e) => handleImmediateExecutionNoteChange(e.target.value)}
                                        />
                                        
                                        <div className="flex gap-2">
                                            <input 
                                                type="file" 
                                                id="f-mit-evidence" 
                                                className="hidden" 
                                                multiple 
                                                accept="image/*,video/*" 
                                                onChange={(e) => handleUploadImmediateEvidence(e.target.files)} 
                                            />
                                            <label 
                                                htmlFor="f-mit-evidence" 
                                                className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 transition"
                                            >
                                                <Upload size={14}/> Adjuntar Evidencia
                                            </label>
                                            <button 
                                                onClick={handleSendImmediateToHSEQ}
                                                disabled={!selectedClaim.immediateSolutionExecutionNotes}
                                                className="flex-[2] px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition shadow-lg shadow-green-100 disabled:opacity-50"
                                            >
                                                <CheckCircle2 size={14}/> Finalizar Mitigación Inmediata
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Bloque 3: Instrucción Técnica Estructural (Original) */}
                            {selectedClaim.tasks?.some(t => {
                                const roleMap: Record<string, string> = {
                                    [InternalRole.MAINTENANCE]: 'Mantenimiento',
                                    [InternalRole.PRODUCTION]: 'Producción',
                                    [InternalRole.LOGISTICS]: 'Logística',
                                    [InternalRole.QUALITY_AUX]: 'Calidad',
                                    [InternalRole.BILLING]: 'Facturación',
                                    [InternalRole.SUPPLY]: 'Abastecimiento'
                                };
                                return t.assignedTo.includes(roleMap[currentRole as string] || 'Otros');
                            }) && (
                                <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 border-t-8 border-t-orange-500">
                                    <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                                        <CheckSquare size={16}/> Instrucción Técnica Definitiva (Plan de Acción)
                                    </h4>
                                    
                                    {selectedClaim.tasks?.filter(t => {
                                        const roleMap: Record<string, string> = {
                                            [InternalRole.MAINTENANCE]: 'Mantenimiento',
                                            [InternalRole.PRODUCTION]: 'Producción',
                                            [InternalRole.LOGISTICS]: 'Logística',
                                            [InternalRole.QUALITY_AUX]: 'Calidad',
                                            [InternalRole.BILLING]: 'Facturación',
                                            [InternalRole.SUPPLY]: 'Abastecimiento'
                                        };
                                        return t.assignedTo.includes(roleMap[currentRole as string] || 'Otros');
                                    }).map(task => (
                                        <div key={task.id} className="space-y-10">
                                            <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 shadow-inner">
                                                <p className="text-4xl font-black text-slate-900 leading-tight tracking-tight italic group-hover:scale-[1.02] transition-transform duration-500">
                                                    "{task.description}"
                                                </p>
                                            </div>
                                            
                                            {task.status === 'Pending' && (
                                                <div className="space-y-8 animate-fadeIn">
                                                    <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm focus-within:ring-8 focus-within:ring-orange-500/5 transition-all">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4 ml-2">Tu Reporte de Cierre Técnico</label>
                                                        <textarea 
                                                            className="w-full p-2 bg-transparent text-lg font-bold text-slate-800 outline-none resize-none placeholder:text-slate-200" 
                                                            rows={4} 
                                                            placeholder="Describe detalladamente qué acciones tomaste para resolver este punto..." 
                                                            value={task.executionNotes || ''} 
                                                            onChange={(e) => handleExecutionNoteChange(task.id, e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col md:flex-row gap-4">
                                                        <input type="file" id={`f-${task.id}`} className="hidden" multiple onChange={(e) => handleUploadEvidence(task.id, e.target.files)} />
                                                        <label htmlFor={`f-${task.id}`} className="flex-1 bg-white border-2 border-slate-200 p-8 rounded-[2rem] text-sm font-black text-slate-600 flex items-center justify-center gap-4 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer shadow-sm">
                                                            <Upload size={24}/> Adjuntar Foto de Evidencia
                                                        </label>
                                                        <button 
                                                            onClick={() => handleMarkAsDone(task.id)} 
                                                            className="flex-1 bg-green-600 text-white p-8 rounded-[2rem] text-xl font-black shadow-2xl shadow-green-200 hover:bg-green-700 transform active:scale-95 transition flex items-center justify-center gap-3"
                                                        >
                                                            Finalizar Mi Parte <CheckCircle2 size={32}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {task.status === 'Realized' && (
                                                <div className="p-10 bg-green-50 rounded-[3rem] border-2 border-green-200 flex items-center gap-6">
                                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-green-600 shadow-lg">
                                                        <CheckCircle2 size={32} strokeWidth={3}/>
                                                    </div>
                                                    <div>
                                                        <h5 className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1">Tarea Completada el {task.completedAt?.split(',')[0]}</h5>
                                                        <p className="text-xl font-bold text-green-900 italic">"{task.executionNotes}"</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
               </div>
          )}

          {/* ESTADO VACIO */}
          {!selectedClaim && hseqFilter !== 'DASHBOARD' && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
               <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl mb-8 group transition-transform hover:scale-105"><Timer size={64} className="text-slate-100 group-hover:text-slate-200 transition-colors" strokeWidth={1} /></div>
               <p className="font-black text-2xl tracking-tight text-slate-400 text-center">Seleccione un reporte para gestionar<br/><span className="text-sm font-medium text-slate-300">Gestión Integral Prolub S.A. • Límite 30 Días</span></p>
            </div>
          )}
        </div>
      </div>
      
      {/* SLA GLOBAL FOOTER REMINDER */}
      <div className="bg-slate-900 text-white py-2 px-8 flex justify-center items-center gap-4 text-[9px] font-black uppercase tracking-[0.3em]">
          <span className="text-amber-500">Aviso Importante:</span>
          <span>SLA Corporativo de Calidad - Tiempo máximo de respuesta: 30 Días Calendario</span>
          <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
      </div>

      {showToast.visible && (
        <div className="fixed bottom-10 right-10 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl animate-bounce z-[300] font-bold text-sm">
            {showToast.message}
        </div>
      )}
    </div>
  );
};
