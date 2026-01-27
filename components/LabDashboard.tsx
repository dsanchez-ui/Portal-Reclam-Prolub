
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  FlaskConical, Wrench, Factory, Truck, Receipt, Container, ClipboardCheck, ShieldCheck, LogOut, ChevronLeft, 
  Search, Filter, CheckCircle2, Clock, FileText, Save, Plus, Trash2, X, Sparkles, Download, Printer, Zap, Stethoscope,
  Upload, ListFilter, ArrowRight, Activity, AlertTriangle, UserCircle, History, AlertCircle, Eye, BarChart3, TrendingUp, Calendar, ExternalLink, Paperclip, Timer, Users, Image as ImageIcon,
  ArrowDownUp, FolderOpen, Loader2, Lock, AlertOctagon, ThumbsUp, PieChart, BarChart4, ClipboardList, EyeOff
} from 'lucide-react';
import { Claim, ClaimStatus, InternalRole, IshikawaEntry, Task, EvidenceFile, MitigationAction } from '../types';
import { enhanceIshikawaObservation, enhanceTaskInstruction, enhanceImmediateSolution } from '../services/geminiService';
import { ClientReportTemplate, FinalReportTemplate } from './ReportTemplates';
import { uploadPdfToDrive, closeClaimSimple, archiveClaimInSheet } from '../services/sheetsService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface LabDashboardProps {
  claims: Claim[];
  onUpdateClaim: (claim: Claim, files?: File[]) => void;
  onDeleteClaim: (id: string) => void; 
  onLogout: () => void;
  onRefresh: () => Promise<void>; 
}

// Helper Component for File Thumbnails to handle errors and filenames
const FileThumbnail: React.FC<{ file: EvidenceFile, onClick: () => void }> = ({ file, onClick }) => {
    const [imgError, setImgError] = useState(false);
    
    // Guard clause: If file is undefined or empty, do not render to avoid crash
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

type SortOption = 'DATE_DESC' | 'DATE_ASC' | 'ALPHA' | 'STATUS_PENDING' | 'STATUS_CLOSED';
type AuditFilterType = 'APPROVAL_READY' | 'PENDING_EXECUTION' | 'ACTION_PLAN_PENDING' | 'CLOSURE_READY' | 'HISTORY';

// DATE HELPERS
const parseDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    // Check if it's ISO
    if (dateStr.includes('T') && dateStr.includes('-')) return new Date(dateStr);
    // Assume DD/MM/YYYY
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

const getDaysBetween = (startStr: string, endStr?: string) => {
    const start = parseDate(startStr);
    const end = endStr ? parseDate(endStr) : new Date();
    if (!start || !end) return 0;
    return Math.floor(getDaysDiff(start, end));
};

// Types for the Unified Confirmation Modal
type ConfirmationType = 'DELETE_TASK' | 'DELETE_MITIGATION' | 'DELETE_CLAIM' | 'APPROVE_PLAN' | 'CLOSE_CASE_DEFINITIVE' | 'ARCHIVE_CLAIM' | null;

export const LabDashboard: React.FC<LabDashboardProps> = ({ claims, onUpdateClaim, onDeleteClaim, onLogout, onRefresh }) => {
  const [currentRole, setCurrentRole] = useState<InternalRole | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('DATE_DESC');
  
  const [viewMode, setViewMode] = useState<'CLAIMS' | 'INDICATORS'>('CLAIMS');
  const [auditFilter, setAuditFilter] = useState<AuditFilterType>('APPROVAL_READY');

  const [showSLAAlert, setShowSLAAlert] = useState(false);
  const [overdueCases, setOverdueCases] = useState<Claim[]>([]);
  const [hasCheckedSLA, setHasCheckedSLA] = useState(false); 

  const [ishikawaInput, setIshikawaInput] = useState({ category: 'Mano de Obra', observation: '' });
  const [taskInput, setTaskInput] = useState({ description: '', assignedTo: 'Mantenimiento' });
  const [immediateInput, setImmediateInput] = useState('');
  const [immediateResponsible, setImmediateResponsible] = useState('Logística');
  
  const [executionNote, setExecutionNote] = useState('');
  const [executionFile, setExecutionFile] = useState<File | null>(null);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null); 
  const [executingMitigationId, setExecutingMitigationId] = useState<string | null>(null);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false); // Generic processing state
  
  // Indicators State
  const [indicatorTimeFilter, setIndicatorTimeFilter] = useState<'30' | '60' | '90' | 'ALL' | 'PENDING'>('ALL');
  const [indicatorCaseFilter, setIndicatorCaseFilter] = useState<string>('GLOBAL');
  const indicatorsRef = useRef<HTMLDivElement>(null);

  // UNIFIED CONFIRMATION MODAL STATE
  const [confirmModal, setConfirmModal] = useState<{ 
      isOpen: boolean, 
      type: ConfirmationType, 
      itemId: string | null 
  }>({ isOpen: false, type: null, itemId: null });

  const printRef = useRef<HTMLDivElement>(null);
  const [reportMode, setReportMode] = useState<'CLIENT' | 'FINAL' | null>(null);

  useEffect(() => {
    setHasCheckedSLA(false);
    setShowSLAAlert(false);
  }, [currentRole]);

  useEffect(() => {
    if (selectedClaim && !isProcessingAction) {
        const freshClaim = claims.find(c => c.id === selectedClaim.id);
        if (freshClaim && freshClaim !== selectedClaim) {
            setSelectedClaim(freshClaim);
        }
    }
  }, [claims, selectedClaim, isProcessingAction]);

  useEffect(() => {
    if (currentRole && claims.length > 0 && !hasCheckedSLA) {
        const cases = claims.filter(c => {
            const days = getDaysPassed(c.date);
            if (days < 25) return false;
            
            const roleIsAdmin = currentRole === InternalRole.LAB || currentRole === InternalRole.AUDIT;
            const pendingMitigation = c.mitigationActions?.some(m => m.assignedTo === currentRole && m.status === 'Pending');
            const pendingTasks = c.tasks?.some(t => t.assignedTo === currentRole && t.status === 'Pending');
            
            if (roleIsAdmin) {
                return c.status !== ClaimStatus.CLOSED;
            }

            return pendingMitigation || pendingTasks;
        });

        if (cases.length > 0) {
            setOverdueCases(cases);
            setShowSLAAlert(true);
        }
        
        setHasCheckedSLA(true);
    }
  }, [currentRole, claims, hasCheckedSLA]);

  const filteredClaims = useMemo(() => {
    // BASE FILTER: Exclude archived claims UNLESS we are in INDICATORS view (Indicators logic handles its own)
    // Actually, ViewMode 'CLAIMS' handles the sidebar list.
    // If archived is true, we generally hide it from the active list.
    
    let result = claims.filter(c => {
        // Exclude archived claims from the operational list
        if (c.archived) return false;

        const term = searchTerm.toLowerCase();
        const client = String(c.client || '').toLowerCase();
        const id = String(c.id || '').toLowerCase();
        return (client.includes(term) || id.includes(term));
    });

    if (currentRole === InternalRole.AUDIT && viewMode === 'CLAIMS') {
        if (auditFilter === 'APPROVAL_READY') {
            // "Aprobar Soluciones Inmediatas": Casos con soluciones ejecutadas y faltan por aprobación.
            result = result.filter(c => 
                c.mitigationActions?.some(m => m.status === 'Pending' && m.executionNotes)
            );
        } else if (auditFilter === 'PENDING_EXECUTION') {
            // "Soluciones Inmediatas Pendientes por Ejecutar": Casos abiertos sin terminar de ejecutar todas sus acciones inmediatas.
            // O casos sin acciones creadas.
            result = result.filter(c => {
                if (c.status === ClaimStatus.CLOSED) return false;
                // If no actions, it counts as pending execution/definition
                if (!c.mitigationActions || c.mitigationActions.length === 0) return true;
                // If any action is Pending AND has no execution notes (meaning not executed)
                return c.mitigationActions.some(m => m.status === 'Pending' && !m.executionNotes);
            });
        } else if (auditFilter === 'ACTION_PLAN_PENDING') {
            // "Plan de Acción Pendiente": Ya se aprobaron sus soluciones inmediatas (todas), 
            // pero falta el plan de acción (o no llenado, o no terminado de ejecutar).
            result = result.filter(c => {
                if (c.status === ClaimStatus.CLOSED) return false;
                
                const hasMitigations = c.mitigationActions && c.mitigationActions.length > 0;
                const allMitigationsApproved = hasMitigations && c.mitigationActions!.every(m => m.status === 'Approved');
                
                if (!allMitigationsApproved) return false; // Must have approved mitigations first

                // Check Action Plan Status
                const hasTasks = c.tasks && c.tasks.length > 0;
                const allTasksRealized = hasTasks && c.tasks!.every(t => t.status === 'Realized');

                // Include if: No tasks defined OR Tasks defined but not all realized
                return !hasTasks || !allTasksRealized;
            });
        } else if (auditFilter === 'CLOSURE_READY') {
            // "Tickets Pendientes por Cierre Administrativo": 
            // Plan de acción ejecutado (todas las tareas asignadas ejecutadas) y soluciones inmediatas aprobadas.
            // Solo falta aprobar el plan de acción (si no está aprobado) y hacer el cierre definitivo.
            result = result.filter(c => {
                 if (c.status === ClaimStatus.CLOSED) return false;
                 
                 const hasMitigations = c.mitigationActions && c.mitigationActions.length > 0;
                 const allMitigationsApproved = hasMitigations && c.mitigationActions!.every(m => m.status === 'Approved');
                 
                 const hasTasks = c.tasks && c.tasks.length > 0;
                 const allTasksRealized = hasTasks && c.tasks!.every(t => t.status === 'Realized');

                 return allMitigationsApproved && allTasksRealized;
            });
        } else if (auditFilter === 'HISTORY') {
             // "Histórico Solicitudes Cerradas"
             result = result.filter(c => c.status === ClaimStatus.CLOSED);
        }
    }

    return result.sort((a, b) => {
          if (sortOption === 'ALPHA') return a.client.localeCompare(b.client);
          
          if (sortOption === 'STATUS_PENDING') {
               const isClosedA = a.status === ClaimStatus.CLOSED;
               const isClosedB = b.status === ClaimStatus.CLOSED;
               if (isClosedA === isClosedB) return 0;
               return isClosedA ? 1 : -1;
          }

          if (sortOption === 'STATUS_CLOSED') {
               const isClosedA = a.status === ClaimStatus.CLOSED;
               const isClosedB = b.status === ClaimStatus.CLOSED;
               if (isClosedA === isClosedB) return 0;
               return isClosedA ? -1 : 1;
          }

          const getDate = (dateStr: string) => {
              if(!dateStr) return new Date(0).getTime();
              const parts = dateStr.includes('/') ? dateStr.split('/') : null;
              return parts ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime() : new Date(dateStr).getTime();
          };
          const timeA = getDate(a.date);
          const timeB = getDate(b.date);
          return sortOption === 'DATE_ASC' ? timeA - timeB : timeB - timeA;
    });
  }, [claims, searchTerm, sortOption, currentRole, auditFilter, viewMode]);

  // --- INDICATORS LOGIC ---
  const indicatorsData = useMemo(() => {
      // 1. Apply Filters
      let filtered = claims;
      
      // Time Filter
      if (indicatorTimeFilter !== 'ALL') {
          const now = new Date();
          filtered = filtered.filter(c => {
              if (indicatorTimeFilter === 'PENDING') return c.status !== ClaimStatus.CLOSED;
              
              // For closed cases, use internalCloseDate, for open, use date (report date)
              const refDate = c.status === ClaimStatus.CLOSED && c.internalCloseDate ? parseDate(c.internalCloseDate) : parseDate(c.date);
              if (!refDate) return false;
              const daysDiff = getDaysDiff(refDate, now);
              return daysDiff <= parseInt(indicatorTimeFilter);
          });
      }

      // Case Filter
      if (indicatorCaseFilter !== 'GLOBAL') {
          filtered = filtered.filter(c => c.id === indicatorCaseFilter);
      }

      // 2. Calculate Metrics
      let totalMitigationDays = 0;
      let mitigationCount = 0;
      
      let totalPlanTaskDays = 0;
      let planTaskCount = 0;

      let totalImmediateClosureDays = 0;
      let immediateClosureCount = 0;

      let totalAdminClosureDays = 0;
      let adminClosureCount = 0;

      const productFrequency: Record<string, number> = {};
      const brandFrequency: Record<string, number> = {};

      filtered.forEach(c => {
          const startDate = parseDate(c.date);

          // 2.1 Mitigation Execution Time (Avg per task)
          c.mitigationActions?.forEach(m => {
              if (m.completedAt && m.createdAt) {
                  const days = getDaysDiff(parseDate(m.createdAt), parseDate(m.completedAt));
                  totalMitigationDays += days;
                  mitigationCount++;
              }
          });

          // 2.2 Immediate Mitigation Closure (Case Start -> Last Mitigation Approved)
          if (c.mitigationActions && c.mitigationActions.length > 0) {
              // Find the last approval date
              const approvalDates = c.mitigationActions
                  .map(m => m.approvedAt ? parseDate(m.approvedAt) : null)
                  .filter(Boolean) as Date[];
              
              if (approvalDates.length === c.mitigationActions.length && startDate) {
                  // All approved
                  const lastApproval = new Date(Math.max(...approvalDates.map(d => d.getTime())));
                  totalImmediateClosureDays += getDaysDiff(startDate, lastApproval);
                  immediateClosureCount++;
              }
          }

          // 2.3 Action Plan Tasks Execution (Avg per task)
          c.tasks?.forEach(t => {
              if (t.completedAt && t.createdAt) {
                  const days = getDaysDiff(parseDate(t.createdAt), parseDate(t.completedAt));
                  totalPlanTaskDays += days;
                  planTaskCount++;
              }
          });

          // 2.4 Administrative Closure (Case Start -> Internal Close Date)
          if (c.status === ClaimStatus.CLOSED && c.internalCloseDate && startDate) {
              const closeDate = parseDate(c.internalCloseDate);
              if (closeDate) {
                  totalAdminClosureDays += getDaysDiff(startDate, closeDate);
                  adminClosureCount++;
              }
          }

          // 2.5 Product Stats (Parsing separated by | and cleaning quantity)
          if (c.productRef) {
              const items = c.productRef.split('|');
              items.forEach(item => {
                  // Remove " (Cant: ...)" suffix to group products correctly
                  const cleanName = item.replace(/\s*\(Cant:.*?\)/i, '').trim();
                  if (cleanName) {
                      productFrequency[cleanName] = (productFrequency[cleanName] || 0) + 1;
                  }
              });
          }

          // 2.6 Brand Stats (Parsing separated by |)
          if ((c as any).brand) { // Type cast to access raw if concatenated
              const brandStr = String((c as any).brand);
              const brands = brandStr.split('|');
              brands.forEach(b => {
                  const cleanBrand = b.trim();
                  if (cleanBrand) {
                      brandFrequency[cleanBrand] = (brandFrequency[cleanBrand] || 0) + 1;
                  }
              });
          }
      });

      // Sort Products
      const topProducts = Object.entries(productFrequency)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

      // Sort Brands
      const topBrands = Object.entries(brandFrequency)
          .sort(([, a], [, b]) => b - a);

      return {
          totalClaims: filtered.length,
          totalMitigations: mitigationCount,
          totalPlanTasks: planTaskCount,
          avgMitigationExec: mitigationCount ? (totalMitigationDays / mitigationCount).toFixed(1) : '0',
          avgImmediateClosure: immediateClosureCount ? (totalImmediateClosureDays / immediateClosureCount).toFixed(1) : '0',
          avgPlanTaskExec: planTaskCount ? (totalPlanTaskDays / planTaskCount).toFixed(1) : '0',
          avgAdminClosure: adminClosureCount ? (totalAdminClosureDays / adminClosureCount).toFixed(1) : '0',
          topProducts,
          topBrands,
          filteredClaims: filtered
      };
  }, [claims, indicatorTimeFilter, indicatorCaseFilter]);

  const downloadIndicatorsPDF = async () => {
      if(!indicatorsRef.current) return;
      try {
          // Force white background for the capture to avoid transparency issues
          const canvas = await html2canvas(indicatorsRef.current, { 
              scale: 2,
              backgroundColor: '#ffffff', 
              useCORS: true 
          });
          
          const imgData = canvas.toDataURL('image/png');
          
          // Use 'l' for Landscape orientation
          const pdf = new jsPDF('l', 'mm', 'a4');
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          
          const imgProps = pdf.getImageProperties(imgData);
          
          // Calculate dimensions to fit WIDTH
          let printWidth = pdfWidth;
          let printHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          // If height is still too big for the page, scale down to fit HEIGHT instead (Contain)
          if (printHeight > pdfHeight) {
              const scale = pdfHeight / printHeight;
              printHeight = pdfHeight;
              printWidth = printWidth * scale;
          }
          
          // Center the image if it was scaled down by height
          const x = (pdfWidth - printWidth) / 2;
          
          pdf.addImage(imgData, 'PNG', x, 0, printWidth, printHeight);
          pdf.save(`Indicadores_Calidad_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (e) {
          console.error(e);
          alert("Error generando PDF");
      }
  };

  const handleRoleSelect = (role: InternalRole) => setCurrentRole(role);
  const handleBack = () => selectedClaim ? setSelectedClaim(null) : setCurrentRole(null);

  const handlePreviewFinalReport = () => {
      setReportMode('FINAL');
  };

  const getActionPlanBlockingReason = () => {
      if (!selectedClaim) return null;
      if (!selectedClaim.mitigationActions || selectedClaim.mitigationActions.length === 0) return "No hay mitigaciones registradas";
      if (!selectedClaim.mitigationActions.every(m => m.status === 'Approved')) return "Mitigaciones pendientes por aprobar";
      if (!selectedClaim.tasks || selectedClaim.tasks.length === 0) return "No hay tareas creadas";
      if (!selectedClaim.tasks.every(t => t.status === 'Realized')) return "Tareas pendientes por ejecutar";
      if (!selectedClaim.ishikawaList || selectedClaim.ishikawaList.length === 0) return "Falta registro en Ishikawa";
      return null;
  };

  // --- UNIFIED MODAL HANDLERS ---
  
  const openConfirmModal = (type: ConfirmationType, itemId: string | null = null) => {
      // Pre-checks for specific types
      if (type === 'APPROVE_PLAN') {
          const reason = getActionPlanBlockingReason();
          if (reason) {
              alert(`NO SE PUEDE APROBAR EL PLAN:\n\nMotivo: ${reason}`);
              return;
          }
      }
      setConfirmModal({ isOpen: true, type, itemId });
  };

  const handleConfirmAction = async () => {
      if (!selectedClaim) return;
      
      const { type, itemId } = confirmModal;
      setIsProcessingAction(true);

      try {
        if (type === 'DELETE_TASK') {
            const updatedTasks = selectedClaim.tasks?.filter(t => t.id !== itemId) || [];
            const updatedClaim = { ...selectedClaim, tasks: updatedTasks };
            setSelectedClaim(updatedClaim);
            await onUpdateClaim(updatedClaim);
        } 
        else if (type === 'DELETE_MITIGATION') {
            const updatedActions = selectedClaim.mitigationActions?.filter(a => a.id !== itemId) || [];
            const updatedClaim = { ...selectedClaim, mitigationActions: updatedActions };
            setSelectedClaim(updatedClaim);
            await onUpdateClaim(updatedClaim);
        }
        else if (type === 'DELETE_CLAIM') {
            await onDeleteClaim(selectedClaim.id);
            setSelectedClaim(null);
        }
        else if (type === 'APPROVE_PLAN') {
            const updated = { ...selectedClaim, actionPlanStatus: 'Approved' as const };
            await onUpdateClaim(updated);
            setSelectedClaim(updated);
        }
        else if (type === 'CLOSE_CASE_DEFINITIVE') {
             if (selectedClaim.actionPlanStatus !== 'Approved') {
                alert("Debe aprobar el Plan de Acción primero.");
                setIsProcessingAction(false);
                setConfirmModal({ isOpen: false, type: null, itemId: null });
                return;
             }
             const today = new Date();
             const day = today.getDate().toString().padStart(2, '0');
             const month = (today.getMonth() + 1).toString().padStart(2, '0');
             const year = today.getFullYear();
             const formattedDate = `${day}/${month}/${year}`;
             const success = await closeClaimSimple(selectedClaim.id, formattedDate);
             if (success) {
                  // Optimistically update local state to avoid stale UI while refreshing
                  setSelectedClaim({ ...selectedClaim, status: ClaimStatus.CLOSED, internalCloseDate: formattedDate });
                  await onRefresh();
             } else {
                  alert("Error al cerrar el caso.");
             }
        } else if (type === 'ARCHIVE_CLAIM') {
            const success = await archiveClaimInSheet(selectedClaim.id);
            if (success) {
                alert("Caso archivado/ocultado de la lista.");
                setSelectedClaim(null); // Return to list
                await onRefresh(); // Refresh list
            } else {
                alert("Error al archivar el caso.");
            }
        }
      } catch (e) {
          console.error(e);
          alert("Error ejecutando la acción.");
      } finally {
          setIsProcessingAction(false);
          setConfirmModal({ isOpen: false, type: null, itemId: null });
      }
  };


  const handleViewEvidence = (file: { url?: string, base64?: string }) => {
     if (file.url) window.open(file.url, '_blank');
     else if (file.base64) {
        const win = window.open();
        win?.document.write('<iframe src="' + "data:application/pdf;base64," + file.base64 + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
     }
  };

  const handleOpenDrive = () => {
      if (selectedClaim?.driveFolderUrl) {
          window.open(selectedClaim.driveFolderUrl, '_blank');
      } else {
          alert("Carpeta de Drive no encontrada.");
      }
  };

  const saveIshikawa = () => {
    if (!selectedClaim || !ishikawaInput.observation) return;
    const newEntry: IshikawaEntry = {
      id: Date.now().toString(),
      category: ishikawaInput.category,
      observation: ishikawaInput.observation,
      createdAt: new Date().toISOString()
    };
    const updated = { ...selectedClaim, ishikawaList: [...(selectedClaim.ishikawaList || []), newEntry] };
    onUpdateClaim(updated);
    setSelectedClaim(updated);
    setIshikawaInput({ ...ishikawaInput, observation: '' });
  };

  const saveTask = () => {
    if (!selectedClaim || !taskInput.description) return;
    const newTask: Task = {
        id: Date.now().toString(),
        description: taskInput.description,
        assignedTo: taskInput.assignedTo,
        status: 'Pending',
        createdAt: new Date().toISOString()
    };
    const updated = { ...selectedClaim, tasks: [...(selectedClaim.tasks || []), newTask] };
    onUpdateClaim(updated);
    setSelectedClaim(updated);
    setTaskInput({ ...taskInput, description: '' });
  };

  // --- MITIGATION ACTIONS LOGIC ---

  const addMitigationAction = () => {
      if (!selectedClaim || !immediateInput) return;
      
      const newAction: MitigationAction = {
          id: Date.now().toString(),
          description: immediateInput,
          assignedTo: immediateResponsible,
          status: 'Pending',
          createdAt: new Date().toISOString()
      };

      const updatedActions = [...(selectedClaim.mitigationActions || []), newAction];
      
      const updated: any = { 
          ...selectedClaim, 
          mitigationActions: updatedActions,
          // Legacy fields for backward compatibility
          immediateSolutionStatus: 'Pending' as const
      };
      
      onUpdateClaim(updated);
      setSelectedClaim(updated);
      setImmediateInput(''); 
  };

  const handleExecuteMitigation = (actionId: string) => {
      setExecutingMitigationId(actionId);
      setExecutionNote('');
      setExecutionFile(null);
  };

  const submitMitigationExecution = () => {
      if (!selectedClaim || !executingMitigationId || !executionNote) {
          alert("Debe agregar una nota.");
          return;
      }
      
      const filesToUpload: File[] = [];
      let newEvidence: EvidenceFile[] = [];

      if (executionFile) {
           const fileExtension = executionFile.name.split('.').pop();
           const cleanRole = currentRole?.replace(/[^a-zA-Z0-9]/g, '') || 'User';
           const newName = `EVIDENCIA_MITIGACION_${cleanRole}_${selectedClaim.id}_${executingMitigationId}.${fileExtension}`;
           const renamedFile = new File([executionFile], newName, { type: executionFile.type });
           filesToUpload.push(renamedFile);

           newEvidence.push({
              name: newName,
              type: executionFile.type,
              url: URL.createObjectURL(executionFile),
              size: executionFile.size
          });
      }

      const updatedActions = selectedClaim.mitigationActions?.map(action => {
          if (action.id === executingMitigationId) {
              return {
                  ...action,
                  executionNotes: executionNote,
                  executionEvidence: newEvidence,
                  completedAt: new Date().toISOString()
              };
          }
          return action;
      });

      const updatedClaim = {
          ...selectedClaim,
          mitigationActions: updatedActions
      };
      
      onUpdateClaim(updatedClaim, filesToUpload);
      setSelectedClaim(updatedClaim);
      setExecutingMitigationId(null);
      alert("Mitigación ejecutada.");
  };

  const approveMitigation = (actionId: string) => {
      if (!selectedClaim || !selectedClaim.mitigationActions) return;
      
      const updatedActions = selectedClaim.mitigationActions.map(action => {
          if (action.id === actionId) {
              if (!action.executionNotes) {
                  alert("No se puede aprobar una acción sin ejecución.");
                  throw new Error("Validation Error");
              }
              return {
                  ...action,
                  status: 'Approved' as const,
                  approvedAt: new Date().toISOString()
              };
          }
          return action;
      });

      // Update global status if ALL are approved
      const allApproved = updatedActions.every(a => a.status === 'Approved');

      const updated = { 
          ...selectedClaim, 
          mitigationActions: updatedActions,
          immediateSolutionStatus: allApproved ? 'Approved' as const : 'Pending' as const
      };
      
      onUpdateClaim(updated);
      setSelectedClaim(updated);
  };

  const handleExecuteTask = (task: Task) => {
      setExecutingTaskId(task.id);
      setExecutionNote('');
      setExecutionFile(null);
  };

  const submitTaskExecution = () => {
      if (!selectedClaim || !executingTaskId || !executionNote) {
          alert("Debe agregar una nota de ejecución.");
          return;
      }
      
      const filesToUpload: File[] = [];
      let newEvidence: EvidenceFile[] = [];

      if (executionFile) {
          const fileExtension = executionFile.name.split('.').pop();
          const cleanRole = currentRole?.replace(/[^a-zA-Z0-9]/g, '') || 'User';
          const newName = `EVIDENCIA_${cleanRole}_${executingTaskId}.${fileExtension}`;
          
          const renamedFile = new File([executionFile], newName, { type: executionFile.type });
          filesToUpload.push(renamedFile);
          
          newEvidence.push({
              name: newName,
              type: executionFile.type,
              url: URL.createObjectURL(executionFile),
              size: executionFile.size
          });
      }

      const updatedTasks = selectedClaim.tasks?.map(t => {
          if (t.id === executingTaskId) {
              return { 
                  ...t, 
                  status: 'Realized' as const, 
                  executionNotes: executionNote,
                  executionEvidence: newEvidence, 
                  completedAt: new Date().toISOString()
              };
          }
          return t;
      });

      const updatedClaim = { ...selectedClaim, tasks: updatedTasks };
      onUpdateClaim(updatedClaim, filesToUpload);
      setSelectedClaim(updatedClaim);
      setExecutingTaskId(null);
      alert("Tarea ejecutada y evidencia cargada.");
  };

  const downloadPDF = async (action: 'download' | 'drive' = 'download') => {
    if(!printRef.current || !selectedClaim) return;
    
    if (action === 'drive') setIsSavingPdf(true);

    try {
        const element = printRef.current;
        const canvas = await html2canvas(element, { 
            scale: 2, 
            useCORS: true,
            logging: false,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        const ratio = pdfWidth / imgWidth;
        const scaledHeight = imgHeight * ratio;
        
        let heightLeft = scaledHeight;
        let position = 0;
        
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
        
        while (heightLeft > 0) {
            position = heightLeft - scaledHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
            heightLeft -= pdfHeight;
        }
        
        const fileName = `Reporte_${selectedClaim.id}_${reportMode}.pdf`;

        if (action === 'download') {
            pdf.save(fileName);
        } else {
            const pdfBlob = pdf.output('blob');
            const reader = new FileReader();
            reader.readAsDataURL(pdfBlob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];
                // PASSING THE REPORT MODE ('CLIENT' OR 'FINAL') TO THE SERVICE
                const success = await uploadPdfToDrive(selectedClaim.id, fileName, base64data, reportMode || 'FINAL');
                if (success) {
                    alert("PDF Guardado exitosamente en la carpeta correspondiente de Drive.");
                } else {
                    alert("Error al guardar en Drive.");
                }
                setIsSavingPdf(false);
            };
        }
    } catch (e) {
        console.error(e);
        setIsSavingPdf(false);
        alert("Error generando PDF");
    }
  };

  const handleEnhance = async (type: 'ishikawa' | 'task' | 'immediate') => {
      // ... same implementation ...
      setIsEnhancing(true);
      try {
        if (type === 'ishikawa' && ishikawaInput.observation) {
            const res = await enhanceIshikawaObservation(ishikawaInput.observation);
            setIshikawaInput(p => ({...p, observation: res}));
        } else if (type === 'task' && taskInput.description) {
            const res = await enhanceTaskInstruction(taskInput.description);
            setTaskInput(p => ({...p, description: res}));
        } else if (type === 'immediate' && immediateInput) {
            const res = await enhanceImmediateSolution(immediateInput);
            setImmediateInput(res);
        }
      } catch (e) { console.error(e); } finally { setIsEnhancing(false); }
  };

  if (!currentRole) {
    // ... same implementation ...
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
            <RoleCard onClick={() => handleRoleSelect(InternalRole.LAB)} role={InternalRole.LAB} label="Laboratorio" desc="Análisis y Diagnóstico." icon={FlaskConical} colorClass="bg-indigo-600" />
            <RoleCard onClick={() => handleRoleSelect(InternalRole.MAINTENANCE)} role={InternalRole.MAINTENANCE} label="Mantenimiento" desc="Ejecución técnica." icon={Wrench} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelect(InternalRole.PRODUCTION)} role={InternalRole.PRODUCTION} label="Producción" desc="Planta y Procesos." icon={Factory} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelect(InternalRole.LOGISTICS)} role={InternalRole.LOGISTICS} label="Logística" desc="Bodega y Despachos." icon={Truck} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelect(InternalRole.BILLING)} role={InternalRole.BILLING} label="Facturación" desc="Notas Crédito." icon={Receipt} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelect(InternalRole.SUPPLY)} role={InternalRole.SUPPLY} label="Abastecimiento" desc="Insumos." icon={Container} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelect(InternalRole.QUALITY_AUX)} role={InternalRole.QUALITY_AUX} label="Aux. Calidad" desc="Apoyo." icon={ClipboardCheck} colorClass="bg-orange-500" />
            <RoleCard onClick={() => handleRoleSelect(InternalRole.AUDIT)} role={InternalRole.AUDIT} label="Auditoría / Cierre" desc="Aprobación Final." icon={ShieldCheck} colorClass="bg-green-600" />
        </div>
      </div>
    );
  }

  const isAdminRole = currentRole === InternalRole.LAB || currentRole === InternalRole.AUDIT;
  
  const canExecute = (assignedTo: string | undefined) => {
      // ... same ...
      if (!assignedTo) return false;
      if (assignedTo === currentRole) return true;
      if (assignedTo === 'Calidad' && currentRole === InternalRole.QUALITY_AUX) return true;
      return false;
  };

  const visibleTasks = selectedClaim?.tasks?.filter(t => {
      if (isAdminRole) return true;
      return canExecute(t.assignedTo); 
  }) || [];
  
  const actionPlanBlockingReason = getActionPlanBlockingReason();
  const canApproveActionPlan = !actionPlanBlockingReason;

  if (viewMode === 'INDICATORS') {
      const { 
          avgMitigationExec, avgImmediateClosure, avgPlanTaskExec, avgAdminClosure,
          totalClaims, totalMitigations, totalPlanTasks, topProducts, topBrands, filteredClaims 
      } = indicatorsData;

      return (
          <div className="h-screen bg-slate-50 flex flex-col overflow-auto font-sans">
              <div className="p-8 max-w-7xl mx-auto w-full">
                  <div className="flex justify-between items-start mb-8">
                      <div>
                          <button onClick={() => setViewMode('CLAIMS')} className="mb-2 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold"><ArrowRight className="rotate-180" size={20}/> Volver al Tablero</button>
                          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><BarChart3 size={32} className="text-indigo-600"/> Panel de Gestión de Calidad</h1>
                      </div>
                      <button onClick={downloadIndicatorsPDF} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-black transition flex items-center gap-2">
                          <Download size={20}/> Exportar PDF
                      </button>
                  </div>

                  <div ref={indicatorsRef} className="bg-slate-50 p-4 -m-4">
                      {/* ... Indicators Layout ... */}
                      {/* FILTERS */}
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                              {['ALL', '30', '60', '90', 'PENDING'].map(f => (
                                  <button 
                                    key={f} 
                                    onClick={() => setIndicatorTimeFilter(f as any)}
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition ${indicatorTimeFilter === f ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                  >
                                      {f === 'ALL' ? 'Historico Total' : f === 'PENDING' ? 'Pendientes' : `Últimos ${f} días`}
                                  </button>
                              ))}
                          </div>
                          
                          <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 uppercase">Alcance:</span>
                              <select 
                                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                value={indicatorCaseFilter}
                                onChange={(e) => setIndicatorCaseFilter(e.target.value)}
                              >
                                  <option value="GLOBAL">Global (Toda la Operación)</option>
                                  {claims.map(c => (
                                      <option key={c.id} value={c.id}>{c.id} - {c.client}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      {/* KPI CARDS */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><FileText size={32}/></div>
                              <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Reclamaciones</p><p className="text-4xl font-black text-slate-800 leading-none">{totalClaims}</p></div>
                          </div>
                          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                              <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><Zap size={32}/></div>
                              <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acciones Mitigación</p><p className="text-4xl font-black text-slate-800 leading-none">{totalMitigations}</p></div>
                          </div>
                          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                              <div className="p-4 bg-green-50 text-green-600 rounded-2xl"><ClipboardCheck size={32}/></div>
                              <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tareas Plan Acción</p><p className="text-4xl font-black text-slate-800 leading-none">{totalPlanTasks}</p></div>
                          </div>
                      </div>

                      {/* MAIN METRICS GRID - SIMPLIFIED FOR PDF READABILITY */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                          {/* Time Metrics - BOX LIST */}
                          <div className="lg:col-span-2 space-y-6">
                              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Timer size={20} className="text-indigo-600"/> Tiempos de Ciclo Promedio</h3>
                              
                              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                  {/* Simple Boxes instead of Bars */}
                                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                      <span className="text-xs font-bold text-slate-600">Ejecución Tarea Mitigación</span>
                                      <span className="text-sm font-black text-slate-900">{avgMitigationExec} días</span>
                                  </div>

                                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                      <span className="text-xs font-bold text-slate-600">Cierre Fase Mitigación</span>
                                      <span className="text-sm font-black text-slate-900">{avgImmediateClosure} días</span>
                                  </div>

                                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                      <span className="text-xs font-bold text-slate-600">Ejecución Tareas Plan Acción</span>
                                      <span className="text-sm font-black text-slate-900">{avgPlanTaskExec} días</span>
                                  </div>

                                  <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100 mt-2">
                                      <span className="text-xs font-bold text-indigo-800">Cierre Administrativo Total</span>
                                      <span className="text-sm font-black text-indigo-900">{avgAdminClosure} días</span>
                                  </div>
                              </div>
                          </div>

                          {/* Stats Column */}
                          <div className="space-y-6">
                              {/* Brand Stats - Simple List */}
                              <div>
                                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><PieChart size={20} className="text-purple-600"/> Distribución por Marca</h3>
                                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                      {topBrands.length > 0 ? (
                                          <div className="space-y-0 divide-y divide-slate-100">
                                              {topBrands.map(([name, count], idx) => (
                                                  <div key={idx} className="flex justify-between items-center py-3">
                                                      <span className="text-xs font-bold text-slate-600">{name}</span>
                                                      <span className="text-sm font-black text-slate-800">{count}</span>
                                                  </div>
                                              ))}
                                          </div>
                                      ) : <div className="text-center text-slate-400 text-xs italic">Sin datos</div>}
                                  </div>
                              </div>

                              {/* Product Stats - Simple Table (No Bars) */}
                              <div>
                                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><BarChart4 size={20} className="text-indigo-600"/> Top Productos</h3>
                                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-auto">
                                      {topProducts.length > 0 ? (
                                          <div className="space-y-0 divide-y divide-slate-100">
                                              {topProducts.map(([name, count], idx) => (
                                                  <div key={idx} className="flex justify-between items-start py-3 gap-4">
                                                      <span className="text-[10px] font-bold text-slate-600 leading-tight w-3/4">{name}</span>
                                                      <span className="text-sm font-black text-indigo-600">{count}</span>
                                                  </div>
                                              ))}
                                          </div>
                                      ) : (
                                          <div className="text-center text-slate-400 py-4 italic text-xs">No hay datos suficientes</div>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* DETAILED TABLE */}
                      <div className="mb-8">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><ListFilter size={20} className="text-indigo-600"/> Detalle de Casos ({indicatorTimeFilter === 'PENDING' ? 'Pendientes' : 'Cerrados y Filtrados'})</h3>
                          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                              <table className="w-full text-left text-sm">
                                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                      <tr>
                                          <th className="p-4 text-slate-600">Fecha Inicio</th>
                                          <th className="p-4 text-slate-600">ID Caso</th>
                                          <th className="p-4 text-slate-600">Cliente</th>
                                          <th className="p-4 text-slate-600">Producto</th>
                                          <th className="p-4 text-slate-600">Estado</th>
                                          <th className="p-4 text-slate-600">Fecha Cierre</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {filteredClaims.map(c => (
                                          <tr key={c.id} className="hover:bg-slate-50 transition">
                                              <td className="p-4 font-mono text-slate-500 text-xs">{c.date}</td>
                                              <td className="p-4 font-bold text-slate-700">{c.id}</td>
                                              <td className="p-4 font-medium text-slate-800">{c.client}</td>
                                              <td className="p-4 text-xs text-slate-500 max-w-xs truncate" title={c.productRef}>{c.productRef}</td>
                                              <td className="p-4">
                                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${c.status === ClaimStatus.CLOSED ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                                      {c.status}
                                                  </span>
                                              </td>
                                              <td className="p-4 font-mono text-slate-500 text-xs">{c.internalCloseDate || '-'}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                              {filteredClaims.length === 0 && <div className="text-center py-8 text-slate-400 italic">No hay registros para los filtros seleccionados.</div>}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className={`h-screen bg-slate-50 flex flex-col font-sans relative ${isProcessingAction ? 'cursor-wait' : ''}`}>
       {/* SLA Alert & Modals ... (Rest of the component remains the same) */}
       {showSLAAlert && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center relative border-4 border-white/20">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle size={40} className="text-red-500 stroke-2" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 mb-2">¡Alerta de Vencimiento SLA!</h2>
                  <p className="text-slate-500 mb-6">
                     Tienes <strong className="text-red-600">{overdueCases.length} casos</strong> asignados que superan los 25 días.
                  </p>
                  
                  {/* LISTA DETALLADA RESTAURADA */}
                  <div className="bg-slate-50 rounded-xl p-4 mb-6 max-h-60 overflow-y-auto text-left border border-slate-100 shadow-inner">
                      {overdueCases.map(c => (
                          <div key={c.id} className="mb-2 last:mb-0 border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                              <div className="flex justify-between items-start">
                                  <p className="font-bold text-slate-800 text-sm truncate w-2/3" title={c.client}>{c.client}</p>
                                  <span className="text-red-600 font-bold text-xs bg-red-50 px-2 py-0.5 rounded border border-red-100">{getDaysPassed(c.date)} días</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">{c.id} • {c.incidentType}</p>
                          </div>
                      ))}
                  </div>

                  <button onClick={() => setShowSLAAlert(false)} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition shadow-xl">Entendido</button>
              </div>
          </div>
       )}

       {/* ... Confirm Modal & Rest of UI ... */}
       {confirmModal.isOpen && (
           <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-white/20">
                   {/* ... Modal Content ... */}
                   {(confirmModal.type === 'DELETE_TASK' || confirmModal.type === 'DELETE_MITIGATION' || confirmModal.type === 'DELETE_CLAIM') ? (
                       <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                           <Trash2 size={32} />
                       </div>
                   ) : (confirmModal.type === 'ARCHIVE_CLAIM') ? (
                       <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                           <EyeOff size={32} />
                       </div>
                   ) : (
                       <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                           <CheckCircle2 size={32} />
                       </div>
                   )}

                   {/* DYNAMIC TITLE */}
                   <h3 className="text-xl font-bold text-slate-800 mb-2">
                       {confirmModal.type === 'APPROVE_PLAN' ? '¿Aprobar Plan de Acción?' : 
                        confirmModal.type === 'CLOSE_CASE_DEFINITIVE' ? '¿Cerrar Caso Definitivamente?' :
                        confirmModal.type === 'ARCHIVE_CLAIM' ? '¿Ocultar Caso de la Lista?' :
                        '¿Eliminar Elemento?'}
                   </h3>

                   {/* DYNAMIC DESCRIPTION */}
                   <p className="text-sm text-slate-500 mb-6">
                       {confirmModal.type === 'APPROVE_PLAN' ? 'Esto habilitará el cierre administrativo del caso. Verifique que todo esté correcto.' :
                        confirmModal.type === 'CLOSE_CASE_DEFINITIVE' ? 'El caso pasará a estado CERRADO y no se podrán hacer más ediciones.' :
                        confirmModal.type === 'ARCHIVE_CLAIM' ? 'El caso dejará de ser visible en los listados operativos, pero SE MANTENDRÁ en la base de datos para indicadores.' :
                        'Esta acción es irreversible.'}
                   </p>

                   <div className="flex gap-3">
                       <button onClick={() => setConfirmModal({ isOpen: false, type: null, itemId: null })} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition">Cancelar</button>
                       <button 
                           onClick={handleConfirmAction} 
                           disabled={isProcessingAction}
                           className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition flex items-center justify-center gap-2
                               ${(confirmModal.type?.includes('DELETE')) ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : (confirmModal.type === 'ARCHIVE_CLAIM') ? 'bg-slate-700 hover:bg-slate-900 shadow-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}
                           `}
                       >
                           {isProcessingAction ? <Loader2 size={18} className="animate-spin"/> : (confirmModal.type?.includes('DELETE') ? "Eliminar" : confirmModal.type === 'ARCHIVE_CLAIM' ? "Ocultar" : "Confirmar")}
                       </button>
                   </div>
               </div>
           </div>
       )}

       {isEnhancing && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"><div className="bg-white p-8 rounded-2xl shadow-2xl"><h3 className="font-bold">Procesando IA...</h3></div></div>}

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
                onClick={() => { setCurrentRole(null); setSelectedClaim(null); }} 
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
                          onChange={(e) => setSortOption(e.target.value as SortOption)}
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
                       <input type="text" placeholder="Buscar caso..." className="pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm w-64 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                     </div>
                 </div>
             )}
             <button onClick={onLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition text-xs font-bold" title="Cerrar Sesión">
                <LogOut size={18} />
                <span className="hidden sm:inline">Salir</span>
             </button>
          </div>
       </header>

       <div className="flex-1 flex overflow-hidden">
          <aside className={`w-full md:w-96 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 ${selectedClaim ? 'hidden md:block' : 'block'}`}>
             {currentRole === InternalRole.AUDIT && (
                 <div className="p-6 space-y-4">
                     {/* ... Filter Buttons ... */}
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
                         <button onClick={() => setViewMode('INDICATORS')} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg hover:bg-slate-900 transition flex items-center justify-center gap-2">
                             <BarChart3 size={18} /> Ver Indicadores
                         </button>
                     </div>
                 </div>
             )}
             <div className="px-4 pb-4 space-y-3">
                {filteredClaims.map(claim => (
                    <div key={claim.id} onClick={() => setSelectedClaim(claim)} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-shadow group relative ${selectedClaim?.id === claim.id ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-slate-200'}`}>
                        {/* ... Claim List Item Content ... */}
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

          <main className={`flex-1 overflow-y-auto bg-slate-50/50 p-6 ${selectedClaim ? 'block' : 'hidden md:flex md:items-center md:justify-center'}`}>
             {selectedClaim ? (
                <div className="max-w-4xl mx-auto space-y-6">
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                       <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                           <div>
                               <div className="flex items-center gap-2">
                                   <h2 className="text-xl font-bold text-slate-800">{selectedClaim.client}</h2>
                                   <button onClick={handleOpenDrive} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition" title="Ir a Carpeta de Drive">
                                       <FolderOpen size={16}/>
                                   </button>
                               </div>
                               <p className="text-sm text-slate-500">{selectedClaim.id} • {selectedClaim.date}</p>
                           </div>
                           <div className="flex gap-2">
                               {isAdminRole && (
                                 <>
                                    <button onClick={() => openConfirmModal('DELETE_CLAIM', selectedClaim.id)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Eliminar Caso"><Trash2 size={20}/></button>
                                    
                                    <button 
                                        onClick={() => openConfirmModal('ARCHIVE_CLAIM', selectedClaim.id)} 
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" 
                                        title="Ocultar Caso (Archivar)"
                                    >
                                        <EyeOff size={20}/>
                                    </button>
                                    
                                    <button onClick={handlePreviewFinalReport} disabled={selectedClaim.immediateSolutionStatus !== 'Approved'} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold shadow-sm flex gap-2 hover:bg-indigo-700 disabled:opacity-50"><Printer size={16}/> Ver Informe Cierre</button>
                                    
                                    {currentRole === InternalRole.AUDIT && selectedClaim.status !== ClaimStatus.CLOSED && selectedClaim.actionPlanStatus === 'Approved' && (
                                        <button 
                                            onClick={() => openConfirmModal('CLOSE_CASE_DEFINITIVE')} 
                                            className="px-4 py-2 bg-slate-800 text-white rounded text-sm font-bold shadow-sm flex gap-2 hover:bg-black hover:shadow-md hover:-translate-y-0.5 transition-all"
                                        >
                                            <Lock size={16}/>
                                            Cierre Definitivo
                                        </button>
                                    )}
                                    
                                    <button onClick={() => setReportMode('CLIENT')} disabled={selectedClaim.immediateSolutionStatus !== 'Approved'} className="px-4 py-2 bg-white border rounded text-sm font-bold shadow-sm flex gap-2 hover:bg-slate-50 disabled:opacity-50"><FileText size={16}/> Reporte Cliente</button>
                                 </>
                               )}
                           </div>
                       </div>
                       
                       {/* ... Rest of Claim Details ... */}
                       <div className="p-6">
                           <div className="flex gap-2 mb-6">
                              {(() => {
                                  const daysOpen = getDaysPassed(selectedClaim.date);
                                  const clientSlaMet = selectedClaim.immediateSolutionStatus === 'Approved';
                                  return (
                                    <>
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase border ${clientSlaMet ? 'bg-green-50 border-green-200 text-green-700' : daysOpen > 5 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                            <Zap size={14} /> Respuesta Cliente: {clientSlaMet ? 'LISTO' : daysOpen + '/5 Días'}
                                        </div>
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase border ${selectedClaim.status === ClaimStatus.CLOSED ? 'bg-slate-100 text-slate-500' : daysOpen > 30 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                            <Timer size={14} /> Cierre Interno: {selectedClaim.status === ClaimStatus.CLOSED ? 'CERRADO' : daysOpen + '/30 Días'}
                                        </div>
                                    </>
                                  );
                              })()}
                           </div>

                           <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 italic text-slate-700">
                               <p className="text-xs font-bold text-slate-400 uppercase mb-2">Descripción del Problema</p>
                               "{selectedClaim.description}"
                           </div>

                           {/* Products Table ... */}
                           <div className="mb-6">
                               <p className="text-xs font-bold text-slate-400 uppercase mb-2">Productos Afectados</p>
                               {selectedClaim.affectedItems && selectedClaim.affectedItems.length > 0 ? (
                                   <div className="border border-slate-200 rounded-lg overflow-hidden">
                                       <table className="w-full text-left text-sm">
                                           <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase">
                                               <tr>
                                                   <th className="p-3">Referencia</th>
                                                   <th className="p-3">Lote</th>
                                                   <th className="p-3">Cantidad</th>
                                               </tr>
                                           </thead>
                                           <tbody className="divide-y divide-slate-100">
                                               {selectedClaim.affectedItems.map((item, idx) => (
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
                                          <p className="text-xs font-medium text-slate-800">{selectedClaim.productRef}</p>
                                       </div>
                                       <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Lote</span>
                                          <p className="text-xs font-medium text-slate-800">{selectedClaim.batch}</p>
                                       </div>
                                   </div>
                               )}
                           </div>

                           {/* Initial Evidence Grid */}
                           {selectedClaim.files && selectedClaim.files.length > 0 && (
                               <div>
                                   <p className="text-xs font-bold text-slate-400 uppercase mb-2">Evidencia Inicial</p>
                                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                       {selectedClaim.files.map((file, idx) => (
                                           <FileThumbnail key={idx} file={file} onClick={() => handleViewEvidence(file)} />
                                       ))}
                                   </div>
                               </div>
                           )}
                       </div>
                   </div>

                   {/* --- SECTIONS (MITIGATION, ISHIKAWA, TASKS) --- */}
                   {/* ... (Existing Implementation for Mitigation, Ishikawa, Tasks) ... */}
                   {/* Just copying the wrapper div for brevity, assume content inside is unchanged from previous request unless specified */}
                   <div className={`p-6 rounded-xl shadow-sm border ${selectedClaim.immediateSolutionStatus === 'Approved' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                      {/* ... Mitigation Content ... */}
                      <div className="flex justify-between items-center mb-4">
                          <h3 className={`text-lg font-bold flex items-center gap-2 ${selectedClaim.immediateSolutionStatus === 'Approved' ? 'text-green-900' : 'text-amber-900'}`}><Zap size={20}/> Acción de Mitigación Inmediata</h3>
                          {selectedClaim.immediateSolutionStatus === 'Approved' && <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 size={12}/> Mitigado / Aprobado</span>}
                      </div>
                      
                      {isAdminRole && selectedClaim.status !== ClaimStatus.CLOSED && (
                          <div className="space-y-3 border-b border-amber-200 pb-4 mb-4">
                             {/* ... Input fields ... */}
                             <p className="text-xs text-amber-700 font-bold mb-1">Agregar nueva instrucción:</p>
                             <div className="flex gap-2">
                                <select className="p-3 rounded-lg border border-amber-200 bg-white text-slate-900 w-40" value={immediateResponsible} onChange={e => setImmediateResponsible(e.target.value)}>
                                    <option>Logística</option><option>Facturación</option><option>Calidad</option><option>Mantenimiento</option><option>Abastecimiento</option>
                                </select>
                                <input className="flex-1 p-3 rounded-lg border border-amber-200 bg-white text-slate-900 placeholder-slate-400" placeholder="Definir acción de mitigación..." value={immediateInput} onChange={e => setImmediateInput(e.target.value)} />
                                <button onClick={() => handleEnhance('immediate')} disabled={isEnhancing} className="p-2 text-amber-600 hover:bg-amber-100 rounded-full transition"><Sparkles size={18}/></button>
                                <button onClick={addMitigationAction} className="bg-amber-500 text-white px-6 rounded-lg font-bold shadow-sm hover:bg-amber-600 transition">Asignar</button>
                             </div>
                          </div>
                      )}

                      <div className="space-y-4">
                          {selectedClaim.mitigationActions && selectedClaim.mitigationActions.length > 0 ? (
                              selectedClaim.mitigationActions.map((action) => (
                                  <div key={action.id} className={`group relative bg-white p-4 rounded-xl border shadow-sm ${action.status === 'Approved' ? 'border-green-200 bg-green-50/20' : 'border-amber-100'}`}>
                                      {/* ... Action Item ... */}
                                      <div className="flex justify-between items-start mb-2">
                                          <div className="flex-1 pr-6">
                                              <div className="font-medium text-amber-900 text-sm mb-1 whitespace-pre-wrap">{action.description}</div>
                                              <div className="flex gap-2 items-center">
                                                  <span className="text-amber-700 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded">Resp: {action.assignedTo}</span>
                                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${action.status === 'Approved' ? 'bg-green-200 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                      {action.status === 'Approved' ? 'APROBADO' : 'PENDIENTE'}
                                                  </span>
                                                  {isAdminRole && (
                                                      <button 
                                                        onClick={(e) => { e.stopPropagation(); openConfirmModal('DELETE_MITIGATION', action.id); }} 
                                                        className="ml-2 p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                                                        title="Eliminar Mitigación"
                                                      >
                                                          <Trash2 size={14} />
                                                      </button>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                      {/* ... Execution Buttons ... */}
                                      {canExecute(action.assignedTo) && action.status === 'Pending' && executingMitigationId !== action.id && (
                                          <div className="mt-2">
                                              <button onClick={() => handleExecuteMitigation(action.id)} className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-amber-700 transition flex items-center gap-2 shadow-lg shadow-amber-200">
                                                  <CheckCircle2 size={14}/> {action.executionNotes ? "EDITAR REPORTE" : "EJECUTAR ACCIÓN"}
                                              </button>
                                          </div>
                                      )}
                                      {/* ... Execution Form ... */}
                                      {executingMitigationId === action.id && (
                                          <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 animate-fadeIn">
                                              <h4 className="font-bold text-slate-700 mb-2 text-sm">Reportar Ejecución</h4>
                                              <textarea className="w-full p-2 border rounded mb-2 text-sm bg-white text-slate-900" placeholder="Describa qué se hizo..." rows={2} value={executionNote} onChange={e => setExecutionNote(e.target.value)}/>
                                              <div className="flex gap-2 items-center">
                                                  <input type="file" className="text-xs" onChange={e => setExecutionFile(e.target.files?.[0] || null)} />
                                                  <button onClick={submitMitigationExecution} className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold">Confirmar</button>
                                                  <button onClick={() => setExecutingMitigationId(null)} className="text-slate-500 px-3 text-xs underline">Cancelar</button>
                                              </div>
                                          </div>
                                      )}
                                      {/* ... Execution Display ... */}
                                      {action.executionNotes && (
                                          <div className="mt-3 pt-3 border-t border-amber-100 text-sm text-slate-600">
                                              <p className="font-bold text-green-700 mb-1 text-xs uppercase tracking-wide">Ejecución:</p>
                                              <div className="whitespace-pre-wrap text-xs bg-slate-50 p-2 rounded border border-slate-100 font-mono text-slate-700">{action.executionNotes}</div>
                                              
                                              <div className="flex justify-between items-end mt-2">
                                                  {action.executionEvidence && action.executionEvidence.length > 0 ? (
                                                      <button onClick={() => handleViewEvidence(action.executionEvidence![action.executionEvidence!.length - 1])} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1">
                                                          <Eye size={12}/> Ver Evidencia
                                                      </button>
                                                  ) : <span></span>}

                                                  {currentRole === InternalRole.AUDIT && action.status === 'Pending' && (
                                                      <button onClick={() => approveMitigation(action.id)} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-700 transition flex items-center gap-1 shadow-sm">
                                                          <CheckCircle2 size={12}/> Aprobar Item
                                                      </button>
                                                  )}
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              ))
                          ) : (
                              !isAdminRole && <p className="text-slate-400 italic text-center text-sm py-2">Sin mitigación definida.</p>
                          )}
                      </div>
                   </div>

                   {/* ... Ishikawa Section ... */}
                   <div className={`bg-white p-6 rounded-xl shadow-sm border ${selectedClaim.actionPlanStatus === 'Approved' ? 'border-green-200 bg-green-50/20' : 'border-slate-200'}`}>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Stethoscope size={20} className="text-indigo-600"/> Análisis de Causa (Ishikawa)
                        {selectedClaim.actionPlanStatus === 'Approved' && <span className="ml-auto text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">Aprobado</span>}
                      </h3>
                      {isAdminRole && selectedClaim.status !== ClaimStatus.CLOSED && selectedClaim.actionPlanStatus !== 'Approved' && (
                        <div className="flex gap-3 mb-4">
                           <select className="p-3 border border-slate-200 rounded-lg text-sm bg-white text-slate-900" value={ishikawaInput.category} onChange={e => setIshikawaInput({...ishikawaInput, category: e.target.value})}>
                              <option>Mano de Obra</option><option>Maquinaria</option><option>Materiales</option><option>Método</option><option>Medio Ambiente</option>
                           </select>
                           <input type="text" className="flex-1 p-3 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400" placeholder="Hallazgo..." value={ishikawaInput.observation} onChange={e => setIshikawaInput({...ishikawaInput, observation: e.target.value})} />
                           <button onClick={() => handleEnhance('ishikawa')} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full transition"><Sparkles size={18}/></button>
                           <button onClick={saveIshikawa} className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition"><Plus size={18}/></button>
                        </div>
                      )}
                      <div className="space-y-2">
                         {selectedClaim.ishikawaList?.map((e, i) => (
                             <div key={i} className="flex gap-2 text-sm bg-slate-50 p-2 rounded border"><strong className="text-indigo-700">{e.category}:</strong> {e.observation}</div>
                         ))}
                         {(!selectedClaim.ishikawaList || selectedClaim.ishikawaList.length === 0) && (
                             <div className="text-center py-4 text-slate-400 italic text-sm border-2 border-dashed border-slate-100 rounded-lg">
                                No hay hallazgos registrados. Agregue uno arriba (+).
                             </div>
                         )}
                      </div>
                   </div>

                   {/* ... Tasks Section ... */}
                   <div className={`bg-white p-6 rounded-xl shadow-sm border ${selectedClaim.actionPlanStatus === 'Approved' ? 'border-green-200 bg-green-50/20' : 'border-slate-200'}`}>
                      <div className="flex justify-between items-center mb-4">
                         <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <ClipboardCheck size={20} className="text-indigo-600"/> Plan de Acción
                            {selectedClaim.actionPlanStatus === 'Approved' && <span className="ml-auto text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">Aprobado</span>}
                         </h3>
                         {!isAdminRole && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">Mis Tareas</span>}
                      </div>
                      {isAdminRole && selectedClaim.status !== ClaimStatus.CLOSED && selectedClaim.actionPlanStatus !== 'Approved' && (
                          <div className="flex gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                             <select className="p-3 border border-slate-200 rounded-lg text-sm bg-white text-slate-900" value={taskInput.assignedTo} onChange={e => setTaskInput({...taskInput, assignedTo: e.target.value})}>
                                <option>Mantenimiento</option><option>Producción</option><option>Logística</option><option>Calidad</option><option>Facturación</option><option>Abastecimiento</option>
                             </select>
                             <input type="text" className="flex-1 p-3 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400" placeholder="Asignar nueva tarea..." value={taskInput.description} onChange={e => setTaskInput({...taskInput, description: e.target.value})} />
                             <button onClick={() => handleEnhance('task')} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full transition"><Sparkles size={18}/></button>
                             <button onClick={saveTask} className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition"><Plus size={18}/></button>
                          </div>
                      )}
                      <div className="space-y-4">
                         {visibleTasks.length > 0 ? visibleTasks.map((t) => (
                             <div key={t.id} className={`group relative flex flex-col p-4 rounded-xl border transition-all ${t.status === 'Realized' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'}`}>
                                 <div className="flex justify-between items-start mb-2">
                                     <div className="flex items-center gap-2">
                                         <span className="text-xs font-bold uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{t.assignedTo}</span>
                                         <p className="font-medium text-slate-800 pr-6">{t.description}</p>
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.status === 'Realized' ? (selectedClaim.actionPlanStatus === 'Approved' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-green-200 text-green-800') : 'bg-yellow-100 text-yellow-800'}`}>
                                             {t.status === 'Realized' ? (selectedClaim.actionPlanStatus === 'Approved' ? 'APROBADO' : 'EJECUTADO') : 'PENDIENTE'}
                                         </span>
                                         {isAdminRole && (
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); openConfirmModal('DELETE_TASK', t.id); }} 
                                                className="ml-2 p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                                                title="Eliminar Tarea"
                                              >
                                                  <Trash2 size={14} />
                                              </button>
                                         )}
                                     </div>
                                 </div>
                                 {t.status === 'Pending' && canExecute(t.assignedTo) && executingTaskId !== t.id && (
                                     <button onClick={() => handleExecuteTask(t)} className="self-end mt-2 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition flex items-center gap-1 shadow-sm">
                                         <CheckCircle2 size={12}/> Ejecutar Tarea
                                     </button>
                                 )}
                                 {executingTaskId === t.id && (
                                     <div className="mt-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100 animate-fadeIn">
                                         <p className="text-xs font-bold text-indigo-900 mb-2 flex items-center gap-1"><Activity size={12}/> Reportar Ejecución:</p>
                                         <textarea className="w-full p-2 text-sm border rounded mb-2 bg-white text-slate-900" placeholder="Describa los resultados de la acción..." value={executionNote} onChange={e => setExecutionNote(e.target.value)}/>
                                         <div className="flex items-center gap-2 bg-white p-2 rounded border border-indigo-100">
                                             <label className="flex-1 cursor-pointer flex items-center gap-2 text-xs text-slate-500 truncate hover:text-indigo-600 transition">
                                                <Upload size={14} className="text-indigo-400"/>
                                                <span className="font-bold">{executionFile ? executionFile.name : 'Adjuntar Evidencia (Obligatorio)'}</span>
                                                <input type="file" className="hidden" onChange={e => setExecutionFile(e.target.files?.[0] || null)}/>
                                             </label>
                                             <div className="h-4 w-px bg-slate-200 mx-2"></div>
                                             <button onClick={submitTaskExecution} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-green-700">Enviar</button>
                                             <button onClick={() => setExecutingTaskId(null)} className="text-slate-500 px-2 text-xs hover:text-slate-700">Cancelar</button>
                                         </div>
                                     </div>
                                 )}
                                 {t.status === 'Realized' && (
                                     <div className="mt-2 text-xs text-slate-600 border-t border-green-100 pt-2 pl-2 border-l-2 border-l-green-400 flex justify-between">
                                         <div><strong>Nota:</strong> {t.executionNotes} <br/><span className="italic text-[10px] text-slate-400">Completado el {t.completedAt?.split('T')[0]}</span></div>
                                         <button onClick={() => {if (t.executionEvidence && t.executionEvidence.length > 0) {handleViewEvidence(t.executionEvidence[0] as any);} else {alert("Evidencia no disponible en vista previa.");}}} className="text-slate-400 hover:text-indigo-600 p-1"><Eye size={16}/></button>
                                     </div>
                                 )}
                             </div>
                         )) : <div className="text-center py-10 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200"><ClipboardCheck size={32} className="mx-auto mb-2 opacity-50"/><p className="text-sm">No tienes tareas asignadas en este caso.</p></div>}
                      </div>
                      
                      {/* ... Approve Plan Button ... */}
                      {currentRole === InternalRole.AUDIT && selectedClaim.status !== ClaimStatus.CLOSED && selectedClaim.actionPlanStatus !== 'Approved' && canApproveActionPlan && (
                          <div className="mt-6 flex justify-end border-t border-slate-100 pt-4 relative z-10">
                               <button 
                                   onClick={() => openConfirmModal('APPROVE_PLAN')}
                                   className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center gap-2"
                               >
                                   <ThumbsUp size={18}/> Aprobar Plan de Acción
                               </button>
                          </div>
                      )}
                   </div>
                </div>
             ) : <div className="text-center text-slate-400 py-20"><Filter size={48} className="mx-auto mb-4 opacity-50"/><p>Seleccione un caso</p></div>}
          </main>
       </div>

       {/* PDF MODAL */}
       {reportMode && selectedClaim && (
           <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold">Vista Previa: {reportMode === 'CLIENT' ? 'Informe Cliente' : 'Informe Cierre'}</h3>
                      <div className="flex gap-2">
                          <button onClick={() => downloadPDF('download')} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded font-bold flex gap-2 hover:bg-slate-50"><Download size={16}/> Descargar</button>
                          
                          {/* NEW SAVE TO DRIVE BUTTON */}
                          <button 
                            onClick={() => downloadPDF('drive')} 
                            disabled={isSavingPdf}
                            className="px-4 py-2 bg-indigo-600 text-white rounded font-bold flex gap-2 hover:bg-indigo-700 disabled:opacity-50"
                          >
                             {isSavingPdf ? <Loader2 className="animate-spin" size={16} /> : <FolderOpen size={16}/>} 
                             {reportMode === 'FINAL' ? 'Confirmar y Guardar en Drive' : 'Guardar en Drive'}
                          </button>

                          <button onClick={() => setReportMode(null)} className="p-2 hover:bg-slate-100 rounded"><X size={20}/></button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-auto bg-slate-500 p-8 flex justify-center">
                      <div ref={printRef} className="bg-white shadow-2xl origin-top">
                          {reportMode === 'CLIENT' ? <ClientReportTemplate claim={selectedClaim} /> : <FinalReportTemplate claim={selectedClaim} />}
                      </div>
                  </div>
              </div>
           </div>
       )}
    </div>
  );
};

function FolderIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
    )
}
