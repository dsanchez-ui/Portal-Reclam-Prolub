
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Filter, MessageSquare, Edit3 } from 'lucide-react';
import { Claim, ClaimStatus, InternalRole, IshikawaEntry, Task, EvidenceFile, MitigationAction, SortOption, AuditFilterType, ConfirmationType } from '../types';
import { uploadPdfToDrive, closeClaimSimple, archiveClaimInSheet, sendAssignmentAlert, finalizeClaimResponse, AREA_EMAILS, sendAuditAlert, sendChangeRequest, resolveChangeRequest } from '../services/sheetsService';

// SUBCOMPONENTS
import { RoleSelector, LabHeader, ClaimsSidebar } from './lab/Navigation';
import { IndicatorsView } from './lab/IndicatorsView';
import { ClaimHeader, ClaimInfo, ChangeRequestHistory } from './lab/ClaimDetail';
import { MitigationSection, IshikawaSection, ActionPlanSection } from './lab/LabSections';
import { SLAAlert, ConfirmModal, ReportPreviewModal, InputModal } from './lab/Modals';

interface LabDashboardProps {
  claims: Claim[];
  onUpdateClaim: (claim: Claim, files?: File[]) => void;
  onDeleteClaim: (id: string) => void; 
  onLogout: () => void;
  onRefresh: () => Promise<void>; 
}

const parseDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes('T') && dateStr.includes('-')) return new Date(dateStr);
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return null;
};

const getDaysPassed = (dateStr: string) => {
    const start = parseDate(dateStr);
    if (!start) return 0;
    const now = new Date();
    const diff = Math.abs(now.getTime() - start.getTime());
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};

// Helper to check assignment compatibility (e.g. Quality Aux can see Quality tasks)
const isAssignedToUser = (assignedTo: string, currentRole: InternalRole) => {
    if (assignedTo === currentRole) return true;
    if (currentRole === InternalRole.QUALITY_AUX && assignedTo === 'Calidad') return true;
    return false;
};

export const LabDashboard: React.FC<LabDashboardProps> = ({ claims, onUpdateClaim, onDeleteClaim, onLogout, onRefresh }) => {
  // STATE
  const [currentRole, setCurrentRole] = useState<InternalRole | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('DATE_DESC');
  const [viewMode, setViewMode] = useState<'CLAIMS' | 'INDICATORS'>('CLAIMS');
  const [auditFilter, setAuditFilter] = useState<AuditFilterType>('APPROVAL_READY');
  
  // ALERTS & MODALS
  const [showSLAAlert, setShowSLAAlert] = useState(false);
  const [overdueCases, setOverdueCases] = useState<Claim[]>([]);
  const [hasCheckedSLA, setHasCheckedSLA] = useState(false); 
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  // Updated type to include FINAL_CLOSURE
  const [reportMode, setReportMode] = useState<'CLIENT' | 'FINAL' | 'CLIENT_SEND' | 'FINAL_CLOSURE' | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, type: ConfirmationType, itemId: string | null }>({ isOpen: false, type: null, itemId: null });
  
  // NEW: Input Modal State for Change Requests / Editing Descriptions
  const [inputModal, setInputModal] = useState<{
      isOpen: boolean;
      mode: 'CHANGE_REQUEST' | 'EDIT_DESCRIPTION';
      itemId: string;
      itemType: 'MITIGATION' | 'TASK' | 'ISHIKAWA';
      currentValue?: string;
  }>({ isOpen: false, mode: 'CHANGE_REQUEST', itemId: '', itemType: 'MITIGATION' });

  // EFFECTS
  useEffect(() => { setHasCheckedSLA(false); setShowSLAAlert(false); }, [currentRole]);

  useEffect(() => {
    if (selectedClaim && !isProcessingAction) {
        const freshClaim = claims.find(c => c.id === selectedClaim.id);
        if (freshClaim && freshClaim !== selectedClaim) setSelectedClaim(freshClaim);
    }
  }, [claims, selectedClaim, isProcessingAction]);

  useEffect(() => {
    if (currentRole && claims.length > 0 && !hasCheckedSLA) {
        const cases = claims.filter(c => {
            const days = getDaysPassed(c.date);
            if (days < 25) return false;
            const roleIsAdmin = currentRole === InternalRole.LAB || currentRole === InternalRole.AUDIT;
            const pendingMitigation = c.mitigationActions?.some(m => isAssignedToUser(m.assignedTo, currentRole) && m.status === 'Pending');
            const pendingTasks = c.tasks?.some(t => isAssignedToUser(t.assignedTo, currentRole) && t.status === 'Pending');
            if (roleIsAdmin) return c.status !== ClaimStatus.CLOSED;
            return pendingMitigation || pendingTasks;
        });
        if (cases.length > 0) {
            setOverdueCases(cases);
            setShowSLAAlert(true);
        }
        setHasCheckedSLA(true);
    }
  }, [currentRole, claims, hasCheckedSLA]);

  // MEMOIZED FILTERING
  const filteredClaims = useMemo(() => {
    const isAdmin = currentRole === InternalRole.LAB || currentRole === InternalRole.AUDIT;

    let result = claims.filter(c => {
        if (c.archived) return false;
        
        // 1. ROLE BASED VISIBILITY FILTER
        if (!isAdmin) {
            // Updated to use helper function for flexible role matching
            const hasMyMitigation = c.mitigationActions?.some(m => isAssignedToUser(m.assignedTo, currentRole!));
            const hasMyTask = c.tasks?.some(t => isAssignedToUser(t.assignedTo, currentRole!));
            if (!hasMyMitigation && !hasMyTask) return false;
        }

        // 2. SEARCH FILTER
        const term = searchTerm.toLowerCase();
        return (c.client.toLowerCase().includes(term) || c.id.toLowerCase().includes(term));
    });

    if (currentRole === InternalRole.AUDIT && viewMode === 'CLAIMS') {
        if (auditFilter === 'APPROVAL_READY') {
            result = result.filter(c => c.mitigationActions?.some(m => m.status === 'Pending' && m.executionNotes));
        } else if (auditFilter === 'PENDING_EXECUTION') {
            result = result.filter(c => {
                if (c.status === ClaimStatus.CLOSED) return false;
                if (!c.mitigationActions || c.mitigationActions.length === 0) return true;
                return c.mitigationActions.some(m => m.status === 'Pending' && !m.executionNotes);
            });
        } else if (auditFilter === 'ACTION_PLAN_PENDING') {
            result = result.filter(c => {
                if (c.status === ClaimStatus.CLOSED) return false;
                const hasMitigations = c.mitigationActions && c.mitigationActions.length > 0;
                const allMitigationsApproved = hasMitigations && c.mitigationActions!.every(m => m.status === 'Approved');
                if (!allMitigationsApproved) return false;
                const hasTasks = c.tasks && c.tasks.length > 0;
                const allTasksRealized = hasTasks && c.tasks!.every(t => t.status === 'Realized');
                return !hasTasks || !allTasksRealized;
            });
        } else if (auditFilter === 'CLOSURE_READY') {
            result = result.filter(c => {
                 if (c.status === ClaimStatus.CLOSED) return false;
                 const hasMitigations = c.mitigationActions && c.mitigationActions.length > 0;
                 const allMitigationsApproved = hasMitigations && c.mitigationActions!.every(m => m.status === 'Approved');
                 const hasTasks = c.tasks && c.tasks.length > 0;
                 const allTasksRealized = hasTasks && c.tasks!.every(t => t.status === 'Realized');
                 return allMitigationsApproved && allTasksRealized;
            });
        } else if (auditFilter === 'HISTORY') {
             result = result.filter(c => c.status === ClaimStatus.CLOSED);
        }
    }

    return result.sort((a, b) => {
          if (sortOption === 'ALPHA') return a.client.localeCompare(b.client);
          if (sortOption === 'STATUS_PENDING') return (a.status === ClaimStatus.CLOSED) === (b.status === ClaimStatus.CLOSED) ? 0 : (a.status === ClaimStatus.CLOSED ? 1 : -1);
          if (sortOption === 'STATUS_CLOSED') return (a.status === ClaimStatus.CLOSED) === (b.status === ClaimStatus.CLOSED) ? 0 : (a.status === ClaimStatus.CLOSED ? -1 : 1);
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

  // --- ACTIONS HANDLERS ---

  const handleAddMitigation = async (desc: string, resp: string) => {
      if (!selectedClaim) return;
      const newAction: MitigationAction = {
          id: Date.now().toString(), description: desc, assignedTo: resp, status: 'Pending', createdAt: new Date().toISOString()
      };
      const updatedActions = [...(selectedClaim.mitigationActions || []), newAction];
      const updated = { ...selectedClaim, mitigationActions: updatedActions, immediateSolutionStatus: 'Pending' as const };
      onUpdateClaim(updated);
      setSelectedClaim(updated);
      
      // SEND EMAIL NOTIFICATION
      await sendAssignmentAlert(updated, newAction, 'MITIGATION');
      alert(`Mitigación asignada a ${newAction.assignedTo}. Notificación enviada.`);
  };

  const handleExecuteMitigation = async (id: string, note: string, file: File | null) => {
      if (!selectedClaim) return;
      const filesToUpload: File[] = [];
      let newEvidence: EvidenceFile[] = [];
      if (file) {
           const fileExtension = file.name.split('.').pop();
           const cleanRole = currentRole?.replace(/[^a-zA-Z0-9]/g, '') || 'User';
           const newName = `EVIDENCIA_MITIGACION_${cleanRole}_${selectedClaim.id}_${id}.${fileExtension}`;
           filesToUpload.push(new File([file], newName, { type: file.type }));
           newEvidence.push({ name: newName, type: file.type, url: URL.createObjectURL(file), size: file.size });
      }
      
      // Keep existing evidence if no new file is uploaded? 
      // Current logic: If new file, add it.
      // Need to handle re-execution (appending vs replacing). The prompt says "delete evidence... load new evidence".
      // Simplified: If file provided, it becomes the latest.
      
      const updatedActions = selectedClaim.mitigationActions?.map(action => {
          if (action.id === id) {
              const currentEvidence = action.executionEvidence || [];
              const finalEvidence = file ? [...currentEvidence, ...newEvidence] : currentEvidence;
              return { 
                  ...action, 
                  executionNotes: note, 
                  executionEvidence: finalEvidence, 
                  completedAt: new Date().toISOString() 
              };
          }
          return action;
      });

      const updated = { ...selectedClaim, mitigationActions: updatedActions };
      onUpdateClaim(updated, filesToUpload);
      setSelectedClaim(updated);

      // AUTOMATED AUDIT ALERT: Check if ALL mitigations are executed (have notes) but NOT all are approved
      if (updatedActions && updatedActions.length > 0) {
          const allExecuted = updatedActions.every(a => a.executionNotes && a.executionNotes.trim() !== '');
          const allApproved = updatedActions.every(a => a.status === 'Approved');
          
          if (allExecuted && !allApproved) {
              await sendAuditAlert(updated, 'MITIGATION_READY');
          }
      }
  };

  const handleApproveMitigation = async (id: string) => {
      if (!selectedClaim || !selectedClaim.mitigationActions) return;
      const updatedActions = selectedClaim.mitigationActions.map(a => a.id === id ? { ...a, status: 'Approved' as const, approvedAt: new Date().toISOString() } : a);
      const allApproved = updatedActions.every(a => a.status === 'Approved');
      const updated = { ...selectedClaim, mitigationActions: updatedActions, immediateSolutionStatus: allApproved ? 'Approved' as const : 'Pending' as const };
      
      await onUpdateClaim(updated);
      setSelectedClaim(updated);
  };

  const handleManualFinalizeResponse = () => {
      if (!selectedClaim) return;
      // Open the modal in "CLIENT_SEND" mode to prompt user confirmation and visualization
      setReportMode('CLIENT_SEND');
  };

  const handleDeleteMitigation = async (id: string) => {
      if (!selectedClaim) return;
      const updatedActions = selectedClaim.mitigationActions?.filter(a => a.id !== id) || [];
      const updated = { ...selectedClaim, mitigationActions: updatedActions };
      await onUpdateClaim(updated);
      setSelectedClaim(updated);
  };

  const handleDeleteIshikawa = async (id: string) => {
      if (!selectedClaim) return;
      const updatedList = selectedClaim.ishikawaList?.filter(i => i.id !== id) || [];
      const updated = { ...selectedClaim, ishikawaList: updatedList };
      await onUpdateClaim(updated);
      setSelectedClaim(updated);
  };

  const handleSaveIshikawa = (category: string, observation: string) => {
      if (!selectedClaim) return;
      const newEntry: IshikawaEntry = { id: Date.now().toString(), category, observation, createdAt: new Date().toISOString() };
      const updated = { ...selectedClaim, ishikawaList: [...(selectedClaim.ishikawaList || []), newEntry] };
      onUpdateClaim(updated);
      setSelectedClaim(updated);
  };

  const handleSaveTask = async (desc: string, assignedTo: string) => {
      if (!selectedClaim) return;
      const newTask: Task = { id: Date.now().toString(), description: desc, assignedTo, status: 'Pending', createdAt: new Date().toISOString() };
      const updated = { ...selectedClaim, tasks: [...(selectedClaim.tasks || []), newTask] };
      onUpdateClaim(updated);
      setSelectedClaim(updated);

      // SEND EMAIL NOTIFICATION
      await sendAssignmentAlert(updated, newTask, 'TASK');
      alert(`Tarea asignada a ${newTask.assignedTo}. Notificación enviada.`);
  };

  const handleExecuteTask = async (id: string, note: string, file: File | null) => {
      if (!selectedClaim) return;
      const filesToUpload: File[] = [];
      let newEvidence: EvidenceFile[] = [];
      if (file) {
          const fileExtension = file.name.split('.').pop();
          const cleanRole = currentRole?.replace(/[^a-zA-Z0-9]/g, '') || 'User';
          const newName = `EVIDENCIA_${cleanRole}_${id}.${fileExtension}`;
          filesToUpload.push(new File([file], newName, { type: file.type }));
          newEvidence.push({ name: newName, type: file.type, url: URL.createObjectURL(file), size: file.size });
      }
      
      const updatedTasks = selectedClaim.tasks?.map(t => {
          if (t.id === id) {
              const currentEvidence = t.executionEvidence || [];
              const finalEvidence = file ? [...currentEvidence, ...newEvidence] : currentEvidence;
              return {
                  ...t,
                  status: 'Realized' as const,
                  executionNotes: note,
                  executionEvidence: finalEvidence,
                  completedAt: new Date().toISOString()
              };
          }
          return t;
      });

      const updated = { ...selectedClaim, tasks: updatedTasks };
      onUpdateClaim(updated, filesToUpload);
      setSelectedClaim(updated);

      // AUTOMATED AUDIT ALERT: Check if ALL tasks are realized but Plan is not approved
      if (updatedTasks && updatedTasks.length > 0) {
          const allRealized = updatedTasks.every(t => t.status === 'Realized');
          const planApproved = selectedClaim.actionPlanStatus === 'Approved';
          
          if (allRealized && !planApproved) {
              await sendAuditAlert(updated, 'PLAN_READY');
          }
      }
  };

  const handleDeleteTask = async (id: string) => {
      if (!selectedClaim) return;
      const updatedTasks = selectedClaim.tasks?.filter(t => t.id !== id) || [];
      const updated = { ...selectedClaim, tasks: updatedTasks };
      await onUpdateClaim(updated);
      setSelectedClaim(updated);
  };

  const handleApprovePlan = async () => {
      if (!selectedClaim) return;
      const updated = { ...selectedClaim, actionPlanStatus: 'Approved' as const };
      await onUpdateClaim(updated);
      setSelectedClaim(updated);
  };

  const handleInitiateClosure = () => {
      if (!selectedClaim) return;
      if (selectedClaim.actionPlanStatus !== 'Approved') { 
          alert("Debe aprobar el Plan de Acción primero antes del cierre definitivo."); 
          return;
      }
      // Open the preview modal in FINAL_CLOSURE mode
      setReportMode('FINAL_CLOSURE');
  };

  // --- NEW: Request Change Handler ---
  const handleRequestChange = (itemId: string, itemType: 'MITIGATION' | 'TASK' | 'ISHIKAWA', currentValue?: string) => {
      if (currentRole === InternalRole.AUDIT) {
          // Open Modal for Audit (Change Request with Email)
          setInputModal({ isOpen: true, mode: 'CHANGE_REQUEST', itemId, itemType });
      } else if (currentRole === InternalRole.LAB) {
          // Open Modal for Lab (Direct Edit)
          setInputModal({ isOpen: true, mode: 'EDIT_DESCRIPTION', itemId, itemType, currentValue });
      }
  };

  // --- NEW: Resolve Change Request ---
  const handleResolveChangeRequest = async (requestId: string) => {
      if (!selectedClaim) return;
      setIsProcessingAction(true);
      try {
          const success = await resolveChangeRequest(requestId);
          if (success) {
              await onRefresh();
              alert("Solicitud marcada como resuelta.");
          } else {
              alert("Error al resolver la solicitud.");
          }
      } catch (e) {
          console.error(e);
          alert("Ocurrió un error.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const handleSubmitInputModal = async (text: string) => {
      if (!selectedClaim) return;
      const { mode, itemId, itemType } = inputModal;
      setIsProcessingAction(true);

      try {
          if (mode === 'CHANGE_REQUEST') {
              // 1. Find item data to send in email
              let itemData = null;
              if (itemType === 'MITIGATION') itemData = selectedClaim.mitigationActions?.find(m => m.id === itemId);
              else if (itemType === 'TASK') itemData = selectedClaim.tasks?.find(t => t.id === itemId);
              else if (itemType === 'ISHIKAWA') itemData = selectedClaim.ishikawaList?.find(i => i.id === itemId);

              if (itemData) {
                  // 2. Send Email via Backend & Save Request
                  const success = await sendChangeRequest(selectedClaim, itemData, text, itemType);
                  if (success) {
                      await onRefresh(); // Refresh to see the new request in list
                      alert("Solicitud de cambio enviada y registrada.");
                  }
                  else alert("Error enviando solicitud.");
              }
          } else if (mode === 'EDIT_DESCRIPTION') {
              // DIRECT EDIT (LAB)
              let updatedClaim = { ...selectedClaim };
              
              if (itemType === 'MITIGATION') {
                  updatedClaim.mitigationActions = selectedClaim.mitigationActions?.map(m => m.id === itemId ? { ...m, description: text } : m);
              } else if (itemType === 'TASK') {
                  updatedClaim.tasks = selectedClaim.tasks?.map(t => t.id === itemId ? { ...t, description: text } : t);
              } // Ishikawa editing is usually deletion/re-creation, but if we want direct text edit, we'd need to map it. Ishikawa currently doesn't store 'description' but 'observation'.
              
              await onUpdateClaim(updatedClaim);
          }
      } catch (e) {
          console.error(e);
          alert("Ocurrió un error.");
      } finally {
          setIsProcessingAction(false);
          setInputModal({ ...inputModal, isOpen: false });
      }
  };

  const handleConfirmAction = async () => {
      if (!selectedClaim) return;
      const { type, itemId } = confirmModal;
      setIsProcessingAction(true);
      try {
        if (type === 'DELETE_TASK') await handleDeleteTask(itemId!);
        else if (type === 'DELETE_MITIGATION') await handleDeleteMitigation(itemId!);
        else if (type === 'DELETE_CLAIM') { await onDeleteClaim(selectedClaim.id); setSelectedClaim(null); }
        else if (type === 'APPROVE_PLAN') await handleApprovePlan();
        else if (type === 'ARCHIVE_CLAIM') {
            const success = await archiveClaimInSheet(selectedClaim.id);
            if(success) { setSelectedClaim(null); await onRefresh(); } else alert("Error al archivar");
        } 
      } catch (e) { console.error(e); alert("Error ejecutando acción."); } 
      finally { setIsProcessingAction(false); setConfirmModal({ isOpen: false, type: null, itemId: null }); }
  };

  const openConfirmModal = (type: ConfirmationType, itemId: string | null = null) => {
      if (type === 'APPROVE_PLAN') {
          if (!selectedClaim?.mitigationActions?.length) { alert("No hay mitigaciones."); return; }
          if (!selectedClaim.mitigationActions.every(m => m.status === 'Approved')) { alert("Mitigaciones pendientes."); return; }
          if (!selectedClaim.tasks?.length) { alert("No hay tareas."); return; }
          if (!selectedClaim.tasks.every(t => t.status === 'Realized')) { alert("Tareas pendientes."); return; }
          if (!selectedClaim.ishikawaList?.length) { alert("Falta Ishikawa."); return; }
      }
      setConfirmModal({ isOpen: true, type, itemId });
  };

  const handleViewEvidence = (file: EvidenceFile) => {
     if (file.url) window.open(file.url, '_blank');
  };

  const handleUploadReport = async (fileName: string, base64: string) => {
      if (reportMode === 'CLIENT_SEND') {
          // Send Email Mode
          const recipients = ['liderlaboratorio@gulfcolombia.com'];
          if (selectedClaim?.reporterEmail) recipients.push(selectedClaim.reporterEmail);
          
          selectedClaim?.mitigationActions?.forEach(m => {
              if (m.assignedTo && AREA_EMAILS[m.assignedTo] && !recipients.includes(AREA_EMAILS[m.assignedTo])) {
                  recipients.push(AREA_EMAILS[m.assignedTo]);
              }
          });

          const success = await finalizeClaimResponse(selectedClaim, base64, recipients);
          
          if (success && selectedClaim) {
              const updatedClaim = { ...selectedClaim, mitigationPhaseClosed: true };
              setSelectedClaim(updatedClaim);
              onRefresh();
          }

          setReportMode(null);
          return success;

      } else if (reportMode === 'FINAL_CLOSURE') {
          // DEFINITIVE CLOSURE WORKFLOW
          if (!selectedClaim) return false;

          // 1. Upload the Final Report to Internal Drive
          const uploadSuccess = await uploadPdfToDrive(
              selectedClaim.id,
              fileName,
              base64,
              'FINAL',
              selectedClaim.driveFolderUrl
          );

          if (!uploadSuccess) {
              alert("Error al guardar el informe en Drive. El cierre se ha cancelado.");
              return false;
          }

          // 2. Close the Case in Sheets
          const today = new Date();
          const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth()+1).toString().padStart(2, '0')}/${today.getFullYear()}`;
          const closeSuccess = await closeClaimSimple(selectedClaim.id, formattedDate);

          if (closeSuccess) {
              const updatedClaim = { ...selectedClaim, status: ClaimStatus.CLOSED, internalCloseDate: formattedDate };
              setSelectedClaim(updatedClaim);
              onRefresh();
              setReportMode(null);
              return true;
          } else {
              alert("Informe guardado, pero hubo un error al actualizar el estado en Sheets.");
              setReportMode(null);
              return false;
          }

      } else {
          // Manual View/Save (Just upload)
          return await uploadPdfToDrive(
              selectedClaim!.id, 
              fileName, 
              base64, 
              reportMode || 'FINAL',
              selectedClaim!.driveFolderUrl 
          );
      }
  };

  // --- RENDER ---
  if (!currentRole) return <RoleSelector onSelect={setCurrentRole} onLogout={onLogout} />;
  
  if (viewMode === 'INDICATORS') return <IndicatorsView claims={claims} onBack={() => setViewMode('CLAIMS')} />;

  const isAdmin = currentRole === InternalRole.LAB || currentRole === InternalRole.AUDIT;

  // VISIBILITY FILTER: For non-admins, filter the visible tasks and mitigations within the selected claim
  // Updated to use helper function
  const viewableClaim = (selectedClaim && !isAdmin) ? {
      ...selectedClaim,
      mitigationActions: selectedClaim.mitigationActions?.filter(m => isAssignedToUser(m.assignedTo, currentRole!)),
      tasks: selectedClaim.tasks?.filter(t => isAssignedToUser(t.assignedTo, currentRole!))
  } : selectedClaim;

  return (
    <div className={`h-screen bg-slate-50 flex flex-col font-sans relative ${isProcessingAction ? 'cursor-wait' : ''}`}>
       {showSLAAlert && <SLAAlert cases={overdueCases} onClose={() => setShowSLAAlert(false)} />}
       <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} isProcessing={isProcessingAction} onConfirm={handleConfirmAction} onCancel={() => setConfirmModal({ isOpen: false, type: null, itemId: null })} />
       <InputModal 
            isOpen={inputModal.isOpen} 
            title={inputModal.mode === 'CHANGE_REQUEST' ? 'Solicitar Cambio' : 'Editar Descripción'}
            subtitle={inputModal.mode === 'CHANGE_REQUEST' ? 'Se notificará al área responsable vía correo electrónico.' : 'Modifique el texto de la tarea/mitigación.'}
            placeholder={inputModal.mode === 'CHANGE_REQUEST' ? 'Describa qué se debe corregir...' : 'Nuevo texto...'}
            initialValue={inputModal.mode === 'EDIT_DESCRIPTION' ? inputModal.currentValue : ''}
            confirmText={inputModal.mode === 'CHANGE_REQUEST' ? 'Enviar Solicitud' : 'Guardar Cambios'}
            confirmColorClass={inputModal.mode === 'CHANGE_REQUEST' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}
            icon={inputModal.mode === 'CHANGE_REQUEST' ? MessageSquare : Edit3}
            isProcessing={isProcessingAction}
            onConfirm={handleSubmitInputModal}
            onCancel={() => setInputModal({ ...inputModal, isOpen: false })}
       />
       {reportMode && selectedClaim && <ReportPreviewModal claim={selectedClaim} mode={reportMode} onClose={() => setReportMode(null)} onUploadToDrive={handleUploadReport} />}

       <LabHeader currentRole={currentRole} onChangeRole={() => { setCurrentRole(null); setSelectedClaim(null); }} onLogout={onLogout} searchTerm={searchTerm} onSearchChange={setSearchTerm} sortOption={sortOption} onSortChange={setSortOption} />

       <div className="flex-1 flex overflow-hidden">
          <ClaimsSidebar claims={filteredClaims} selectedClaimId={selectedClaim?.id} onSelectClaim={setSelectedClaim} currentRole={currentRole} auditFilter={auditFilter} setAuditFilter={setAuditFilter} onViewIndicators={() => setViewMode('INDICATORS')} isHiddenMobile={!!selectedClaim} />

          <main className={`flex-1 overflow-y-auto bg-slate-50/50 p-6 ${selectedClaim ? 'block' : 'hidden md:flex md:items-center md:justify-center'}`}>
             {viewableClaim && selectedClaim ? (
                <div className="max-w-4xl mx-auto space-y-6">
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                       <ClaimHeader claim={selectedClaim} isAdmin={isAdmin} currentRole={currentRole} onDelete={() => openConfirmModal('DELETE_CLAIM')} onArchive={() => openConfirmModal('ARCHIVE_CLAIM')} onCloseCase={handleInitiateClosure} onPreviewReport={setReportMode} />
                       <ClaimInfo claim={selectedClaim} onViewEvidence={handleViewEvidence} />
                   </div>

                   {/* CHANGE REQUESTS HISTORY BLOCK */}
                   {selectedClaim.changeRequests && selectedClaim.changeRequests.length > 0 && (
                        <ChangeRequestHistory 
                            claim={selectedClaim} 
                            currentRole={currentRole} 
                            onResolve={handleResolveChangeRequest} 
                        />
                   )}

                   <MitigationSection 
                        claim={viewableClaim} 
                        isAdmin={isAdmin} 
                        currentRole={currentRole} 
                        onAddMitigation={handleAddMitigation} 
                        onExecuteMitigation={handleExecuteMitigation} 
                        onApproveMitigation={handleApproveMitigation} 
                        onDeleteMitigation={(id) => openConfirmModal('DELETE_MITIGATION', id)} 
                        onRequestChange={(id, text) => handleRequestChange(id, 'MITIGATION', text)}
                        onViewEvidence={handleViewEvidence}
                        onFinalizeResponse={handleManualFinalizeResponse}
                   />
                   <IshikawaSection 
                        claim={selectedClaim} 
                        isAdmin={isAdmin} 
                        currentRole={currentRole} 
                        onSaveIshikawa={handleSaveIshikawa} 
                        onRequestChange={(id, text) => handleRequestChange(id, 'ISHIKAWA', text)}
                        onDeleteIshikawa={(id) => handleDeleteIshikawa(id)}
                   />
                   <ActionPlanSection 
                        claim={viewableClaim} 
                        isAdmin={isAdmin} 
                        currentRole={currentRole} 
                        onSaveTask={handleSaveTask} 
                        onExecuteTask={handleExecuteTask} 
                        onDeleteTask={(id) => openConfirmModal('DELETE_TASK', id)} 
                        onRequestChange={(id, text) => handleRequestChange(id, 'TASK', text)}
                        onApprovePlan={() => openConfirmModal('APPROVE_PLAN')} 
                        onViewEvidence={handleViewEvidence} 
                   />
                </div>
             ) : (
                <div className="text-center text-slate-400 py-20"><Filter size={48} className="mx-auto mb-4 opacity-50"/><p>Seleccione un caso</p></div>
             )}
          </main>
       </div>
    </div>
  );
};
