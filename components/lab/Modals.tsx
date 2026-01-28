
import React, { useRef } from 'react';
import { AlertTriangle, Trash2, EyeOff, CheckCircle2, Loader2, Download, FolderOpen, X, Send, FileText, Lock } from 'lucide-react';
import { Claim, ConfirmationType } from '../../types';
import { ClientReportTemplate, FinalReportTemplate } from '../ReportTemplates';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// --- SLA ALERT ---
export const SLAAlert: React.FC<{ cases: Claim[], onClose: () => void }> = ({ cases, onClose }) => {
    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center relative border-4 border-white/20">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle size={40} className="text-red-500 stroke-2" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">¡Alerta de Vencimiento SLA!</h2>
                <p className="text-slate-500 mb-6">
                    Tienes <strong className="text-red-600">{cases.length} casos</strong> asignados que superan los 25 días.
                </p>
                <div className="bg-slate-50 rounded-xl p-4 mb-6 max-h-60 overflow-y-auto text-left border border-slate-100 shadow-inner">
                    {cases.map(c => (
                        <div key={c.id} className="mb-2 last:mb-0 border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start">
                                <p className="font-bold text-slate-800 text-sm truncate w-2/3" title={c.client}>{c.client}</p>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">{c.id} • {c.incidentType}</p>
                        </div>
                    ))}
                </div>
                <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition shadow-xl">Entendido</button>
            </div>
        </div>
    );
};

// --- CONFIRM MODAL ---
interface ConfirmModalProps {
    isOpen: boolean;
    type: ConfirmationType;
    isProcessing: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, type, isProcessing, onConfirm, onCancel }) => {
    if (!isOpen || !type) return null;

    return (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-white/20">
                {(type === 'DELETE_TASK' || type === 'DELETE_MITIGATION' || type === 'DELETE_CLAIM') ? (
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><Trash2 size={32} /></div>
                ) : (type === 'ARCHIVE_CLAIM') ? (
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600"><EyeOff size={32} /></div>
                ) : (
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><CheckCircle2 size={32} /></div>
                )}

                <h3 className="text-xl font-bold text-slate-800 mb-2">
                    {type === 'APPROVE_PLAN' ? '¿Aprobar Plan de Acción?' : 
                    type === 'CLOSE_CASE_DEFINITIVE' ? '¿Cerrar Caso Definitivamente?' :
                    type === 'ARCHIVE_CLAIM' ? '¿Ocultar Caso de la Lista?' :
                    '¿Eliminar Elemento?'}
                </h3>

                <p className="text-sm text-slate-500 mb-6">
                    {type === 'APPROVE_PLAN' ? 'Esto habilitará el cierre administrativo del caso. Verifique que todo esté correcto.' :
                    type === 'CLOSE_CASE_DEFINITIVE' ? 'El caso pasará a estado CERRADO y no se podrán hacer más ediciones.' :
                    type === 'ARCHIVE_CLAIM' ? 'El caso dejará de ser visible en los listados operativos, pero SE MANTENDRÁ en la base de datos.' :
                    'Esta acción es irreversible.'}
                </p>

                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition">Cancelar</button>
                    <button 
                        onClick={onConfirm} 
                        disabled={isProcessing}
                        className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition flex items-center justify-center gap-2
                            ${(type?.includes('DELETE')) ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : (type === 'ARCHIVE_CLAIM') ? 'bg-slate-700 hover:bg-slate-900 shadow-slate-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}
                        `}
                    >
                        {isProcessing ? <Loader2 size={18} className="animate-spin"/> : (type?.includes('DELETE') ? "Eliminar" : type === 'ARCHIVE_CLAIM' ? "Ocultar" : "Confirmar")}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- REPORT PREVIEW MODAL ---
interface ReportModalProps {
    claim: Claim;
    mode: 'CLIENT' | 'FINAL' | 'CLIENT_SEND' | 'FINAL_CLOSURE'; 
    onClose: () => void;
    onUploadToDrive: (fileName: string, base64: string) => Promise<boolean>;
}

export const ReportPreviewModal: React.FC<ReportModalProps> = ({ claim, mode, onClose, onUploadToDrive }) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    const handleAction = async (action: 'download' | 'drive') => {
        if(!printRef.current) return;
        if (action === 'drive') setIsSaving(true);

        try {
            const element = printRef.current;
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, windowWidth: element.scrollWidth, windowHeight: element.scrollHeight });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            // Standard A4 aspect ratio 
            
            let heightLeft = canvas.height * (pdfWidth / canvas.width);
            let position = 0;
            const scaledHeight = canvas.height * (pdfWidth / canvas.width);

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
            heightLeft -= pdfHeight;
            
            while (heightLeft > 0) {
                position = heightLeft - scaledHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
                heightLeft -= pdfHeight;
            }
            
            const fileName = `Reporte_${claim.id}_${mode.includes('CLIENT') ? 'CLIENT' : 'FINAL'}.pdf`;

            if (action === 'download') {
                pdf.save(fileName);
                setIsSaving(false);
            } else {
                const pdfBlob = pdf.output('blob');
                const reader = new FileReader();
                reader.readAsDataURL(pdfBlob);
                reader.onloadend = async () => {
                    const base64data = (reader.result as string).split(',')[1];
                    const success = await onUploadToDrive(fileName, base64data);
                    
                    if (mode === 'CLIENT_SEND') {
                        if (success) alert("✅ Éxito: El reporte ha sido enviado por correo y guardado en Drive.");
                        else alert("⚠️ Advertencia: Hubo un problema enviando el correo.");
                    } else if (mode === 'FINAL_CLOSURE') {
                        if (success) alert("✅ Caso CERRADO exitosamente.");
                        else alert("⚠️ Hubo un error al cerrar el caso.");
                    } else {
                        if (success) alert("✅ PDF Guardado exitosamente en Drive.");
                        else alert("⚠️ Error al guardar en Drive.");
                    }
                    setIsSaving(false);
                };
            }
        } catch (e) {
            console.error(e);
            setIsSaving(false);
            alert("Error crítico generando PDF");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border-4 border-white/20">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${mode === 'CLIENT_SEND' ? 'bg-indigo-100 text-indigo-600' : mode === 'FINAL_CLOSURE' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {mode === 'CLIENT_SEND' ? <Send size={20}/> : mode === 'FINAL_CLOSURE' ? <Lock size={20}/> : <FileText size={20}/>}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 leading-none">
                                {mode === 'CLIENT_SEND' ? 'Vista Previa y Envío' : mode === 'FINAL_CLOSURE' ? 'Cierre Definitivo del Caso' : mode === 'CLIENT' ? 'Informe Cliente' : 'Informe Cierre'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {mode === 'FINAL_CLOSURE' ? 'Al confirmar, se guardará el informe y se cerrará el caso.' : 'Verifique el contenido antes de continuar'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {(mode !== 'CLIENT_SEND' && mode !== 'FINAL_CLOSURE') && (
                            <button onClick={() => handleAction('download')} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-50 transition text-xs shadow-sm"><Download size={14}/> Descargar</button>
                        )}
                        <button onClick={() => handleAction('drive')} disabled={isSaving} className={`px-5 py-2 text-white rounded-lg font-bold flex items-center gap-2 transition text-xs shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${mode === 'CLIENT_SEND' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : mode === 'FINAL_CLOSURE' ? 'bg-black hover:bg-slate-800 shadow-slate-400' : 'bg-slate-800 hover:bg-black shadow-slate-200'}`}>
                            {isSaving ? <Loader2 className="animate-spin" size={14} /> : mode === 'CLIENT_SEND' ? <Send size={14}/> : mode === 'FINAL_CLOSURE' ? <Lock size={14}/> : <FolderOpen size={14}/>} 
                            {isSaving ? 'Procesando...' : mode === 'CLIENT_SEND' ? 'Enviar Reporte y Finalizar' : mode === 'FINAL_CLOSURE' ? 'Cerrar Caso y Guardar Reporte' : mode === 'FINAL' ? 'Guardar Cierre en Drive' : 'Guardar en Drive'}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center">
                    <div ref={printRef} className="bg-white shadow-2xl origin-top transition-transform">
                        {(mode === 'CLIENT' || mode === 'CLIENT_SEND') ? <ClientReportTemplate claim={claim} /> : <FinalReportTemplate claim={claim} />}
                    </div>
                </div>
            </div>
        </div>
    );
};
