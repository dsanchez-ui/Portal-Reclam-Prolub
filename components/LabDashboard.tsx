
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Filter } from 'lucide-react';
import { Claim, ClaimStatus, InternalRole, IshikawaEntry, Task, EvidenceFile, MitigationAction, SortOption, AuditFilterType, ConfirmationType } from '../types';
import { uploadPdfToDrive, closeClaimSimple, archiveClaimInSheet, sendAssignmentAlert, finalizeClaimResponse, AREA_EMAILS } from '../services/sheetsService';

// SUBCOMPONENTS
import { RoleSelector, LabHeader, ClaimsSidebar } from './lab/Navigation';
import { IndicatorsView } from './lab/IndicatorsView';
import { ClaimHeader, ClaimInfo } from './lab/ClaimDetail';
import { MitigationSection, IshikawaSection, ActionPlanSection } from './lab/LabSections';
import { SLAAlert, ConfirmModal, ReportPreviewModal } from './lab/Modals';

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
            const pendingMitigation = c.mitigationActions?.some(m => m.assignedTo === currentRole && m.status === 'Pending');
            const pendingTasks = c.tasks?.some(t => t.assignedTo === currentRole && t.status === 'Pending');
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
            const hasMyMitigation = c.mitigationActions?.some(m => m.assignedTo === currentRole);
            const hasMyTask = c.tasks?.some(t => t.assignedTo === currentRole);
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

  const handleExecuteMitigation = (id: string, note: string, file: File | null) => {
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
      const updatedActions = selectedClaim.mitigationActions?.map(action => action.id === id ? { ...action, executionNotes: note, executionEvidence: newEvidence, completedAt: new Date().toISOString() } : action);
      const updated = { ...selectedClaim, mitigationActions: updatedActions };
      onUpdateClaim(updated, filesToUpload);
      setSelectedClaim(updated);
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

  const handleExecuteTask = (id: string, note: string, file: File | null) => {
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
      const updatedTasks = selectedClaim.tasks?.map(t => t.id === id ? { ...t, status: 'Realized' as const, executionNotes: note, executionEvidence: newEvidence, completedAt: new Date().toISOString() } : t);
      const updated = { ...selectedClaim, tasks: updatedTasks };
      onUpdateClaim(updated, filesToUpload);
      setSelectedClaim(updated);
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
  const viewableClaim = (selectedClaim && !isAdmin) ? {
      ...selectedClaim,
      mitigationActions: selectedClaim.mitigationActions?.filter(m => m.assignedTo === currentRole),
      tasks: selectedClaim.tasks?.filter(t => t.assignedTo === currentRole)
  } : selectedClaim;

  return (
    <div className={`h-screen bg-slate-50 flex flex-col font-sans relative ${isProcessingAction ? 'cursor-wait' : ''}`}>
       {showSLAAlert && <SLAAlert cases={overdueCases} onClose={() => setShowSLAAlert(false)} />}
       <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} isProcessing={isProcessingAction} onConfirm={handleConfirmAction} onCancel={() => setConfirmModal({ isOpen: false, type: null, itemId: null })} />
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

                   <MitigationSection 
                        claim={viewableClaim} 
                        isAdmin={isAdmin} 
                        currentRole={currentRole} 
                        onAddMitigation={handleAddMitigation} 
                        onExecuteMitigation={handleExecuteMitigation} 
                        onApproveMitigation={handleApproveMitigation} 
                        onDeleteMitigation={(id) => openConfirmModal('DELETE_MITIGATION', id)} 
                        onViewEvidence={handleViewEvidence}
                        onFinalizeResponse={handleManualFinalizeResponse}
                   />
                   <IshikawaSection claim={selectedClaim} isAdmin={isAdmin} currentRole={currentRole} onSaveIshikawa={handleSaveIshikawa} />
                   <ActionPlanSection claim={viewableClaim} isAdmin={isAdmin} currentRole={currentRole} onSaveTask={handleSaveTask} onExecuteTask={handleExecuteTask} onDeleteTask={(id) => openConfirmModal('DELETE_TASK', id)} onApprovePlan={() => openConfirmModal('APPROVE_PLAN')} onViewEvidence={handleViewEvidence} />
                </div>
             ) : (
                <div className="text-center text-slate-400 py-20"><Filter size={48} className="mx-auto mb-4 opacity-50"/><p>Seleccione un caso</p></div>
             )}
          </main>
       </div>
    </div>
  );
};
