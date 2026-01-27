
import React, { useState, useEffect } from 'react';
import { CommercialWizard } from './components/CommercialWizard';
import { LabDashboard } from './components/LabDashboard';
import { CommercialDashboard } from './components/CommercialDashboard';
import { AppView, Claim, ClaimStatus, Brand, IncidentType } from './types';
import { saveClaimToSheet, updateClaimInSheet, getClaimsFromSheet, deleteClaimFromSheet, sendClaimNotification } from './services/sheetsService';
import { 
  Briefcase, 
  FlaskConical, 
  Lightbulb, 
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  X,
  RefreshCw,
  Upload,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Trash2,
  ShieldCheck,
  Zap,
  LayoutGrid,
  TrendingUp,
  Activity,
  Database,
  CloudLightning
} from 'lucide-react';

// Enhanced Improvement Wizard Component with File Upload
const ImprovementWizard = ({ onBack, onSubmit }: { onBack: () => void, onSubmit: (data: any, files: File[]) => void }) => {
  const [desc, setDesc] = useState('');
  const [area, setArea] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!area || !desc) {
      alert("Por favor complete el área y la descripción.");
      return;
    }
    onSubmit({ area, description: desc }, files);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
       <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-8 max-w-lg w-full relative">
         <button onClick={onBack} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600">
           <ArrowLeft size={24} />
         </button>
         
         <div className="text-center mb-6">
           <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600 shadow-inner">
             <Lightbulb size={32} />
           </div>
           <h2 className="text-2xl font-bold text-slate-800">Oportunidad de Mejora</h2>
           <p className="text-slate-500 text-sm mt-2">Reporta ideas o hallazgos para mejorar nuestros procesos.</p>
         </div>

         <div className="space-y-4">
           <div>
             <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Área Relacionada</label>
             <select 
               className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 bg-white/50"
               value={area}
               onChange={(e) => setArea(e.target.value)}
             >
               <option value="">Seleccione...</option>
               <option value="Planta_Produccion">Planta / Producción</option>
               <option value="Logistica_Bodega">Logística / Bodega</option>
               <option value="Calidad_Laboratorio">Calidad / Laboratorio</option>
               <option value="Administrativo">Administrativo</option>
               <option value="Ventas_Campo">Ventas / Campo</option>
             </select>
           </div>
           
           <div>
             <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Descripción del Hallazgo</label>
             <textarea 
               rows={4}
               className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 resize-none bg-white/50"
               placeholder="Describa la oportunidad de mejora..."
               value={desc}
               onChange={(e) => setDesc(e.target.value)}
             ></textarea>
           </div>

           {/* File Upload Section */}
           <div>
             <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Evidencias (Fotos/Docs)</label>
             <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50/50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100/50 hover:border-yellow-400 transition relative">
                <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
                    multiple 
                    accept="image/*,video/*,application/pdf" 
                    onChange={handleFileChange}
                />
                <Upload size={20} className="text-slate-400 mb-1" />
                <span className="text-xs text-slate-500 font-medium">Click para subir archivos</span>
             </div>

             {files.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {files.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50/80 p-2 rounded border border-slate-100 text-xs">
                            {file.type.includes('image') ? <ImageIcon size={12} className="text-blue-500"/> : 
                             file.type.includes('pdf') ? <FileText size={12} className="text-red-500"/> :
                             <FileIcon size={12} className="text-slate-500"/>}
                            <span className="truncate flex-1 text-slate-700">{file.name}</span>
                            <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
             )}
           </div>

           <button 
             onClick={handleSubmit}
             className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-yellow-200 flex items-center justify-center gap-2 mt-2"
           >
             <CheckCircle2 size={20} /> Enviar Reporte
           </button>
         </div>
       </div>
    </div>
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeCommercialUser, setActiveCommercialUser] = useState<string>('');
  const [notification, setNotification] = useState<{message: string, subMessage?: string, visible: boolean} | null>(null);
  const [showInternalAuth, setShowInternalAuth] = useState(false);
  const [internalPin, setInternalPin] = useState('');
  const [internalPinError, setInternalPinError] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadClaims();
    
    // Polling Mechanism: Refresh every 30 seconds
    const interval = setInterval(() => {
        // Only silent refresh if not currently in a loading state to avoid flickers/blocks
        if (!isLoading) {
            console.log("Polling updates...");
            getClaimsFromSheet().then(data => {
                if(data && data.length > 0) setClaims(data);
            }).catch(e => console.error("Polling failed", e));
        }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadClaims = async () => {
    setIsLoading(true);
    try {
      const data = await getClaimsFromSheet();
      setClaims(data || []);
    } catch (error) {
      console.error("Failed to load claims, showing empty state.", error);
      setClaims([]);
    }
    setIsLoading(false);
  };

  const showSuccessNotification = (message: string, subMessage: string) => {
    setNotification({ message, subMessage, visible: true });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCommercialSubmit = async (newClaimData: any, rawFiles: File[]) => {
    setIsLoading(true);
    const newClaim: Claim = {
      id: `CLM-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
      date: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      status: ClaimStatus.PENDING,
      ...newClaimData
    };

    // 1. Save Data (Sheet + Drive)
    const result = await saveClaimToSheet(newClaim, rawFiles);
    
    if (result.success) {
         // 2. Send Email (Only if save succeeded)
         // PASS THE GENERATED DRIVE URLs TO THE EMAIL SERVICE
         const claimForEmail = {
            ...newClaim,
            driveFolderUrl: result.driveFolderUrl,
            driveClientFolderUrl: result.driveClientFolderUrl
         };
         
         await sendClaimNotification(claimForEmail);
         
         await loadClaims(); // RE-FETCH from the single source of truth

        setCurrentView(AppView.COMMERCIAL_DASHBOARD);
        showSuccessNotification(
            "¡Reclamación Exitosa!",
            "Su caso ha sido enviado al laboratorio correctamente."
        );
    } else {
        alert("Hubo un error al guardar el caso. Por favor intente nuevamente.");
    }
    setIsLoading(false);
  };

  const handleImprovementSubmit = async (data: any, files: File[]) => {
    setIsLoading(true);
    const id = `IMP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
    
    const improvementClaim: any = {
      id: id,
      date: new Date().toLocaleDateString('es-ES'),
      status: ClaimStatus.PENDING,
      client: `MEJORA - ${data.area}`, 
      reporterName: 'Mejora Continua',
      incidentType: IncidentType.QUALITY,
      brand: Brand.MAQUILA, 
      description: data.description,
    };

    await saveClaimToSheet(improvementClaim, files);
    await loadClaims(); // RE-FETCH
    
    setIsLoading(false);
    showSuccessNotification("¡Reporte Enviado!", "Tu oportunidad de mejora ha sido registrada.");
    setCurrentView(AppView.LANDING);
  };

  const handleLabUpdate = async (updatedClaim: Claim, newFiles: File[] = []) => {
    setIsLoading(true);
    // Modified to handle status response
    const result = await updateClaimInSheet(updatedClaim, newFiles);
    
    if (!result.success && result.error === 'STALE_DATA') {
        alert("¡ATENCIÓN! Los datos han sido modificados por otro usuario mientras usted editaba.\n\nLa página se recargará para mostrar la información más reciente. Por favor, vuelva a intentar su acción.");
    } else if (!result.success) {
        alert(`Error al guardar: ${result.error}`);
    }

    await loadClaims(); // Always re-fetch to sync state
    setIsLoading(false);
  };

  const handleDeleteClaim = async (claimId: string) => {
      setIsLoading(true);
      await deleteClaimFromSheet(claimId);
      await loadClaims(); // RE-FETCH from the single source of truth
      setIsLoading(false);
  };

  const handleCreateNewClaim = (reporterName: string) => {
    setActiveCommercialUser(reporterName);
    setCurrentView(AppView.COMMERCIAL_WIZARD);
  };

  const handleCommercialLogout = () => {
    setActiveCommercialUser('');
    setCurrentView(AppView.LANDING);
  };

  const handleInternalAuthSubmit = () => {
    if (internalPin === '2026') {
      setShowInternalAuth(false);
      setInternalPin('');
      setInternalPinError(false);
      setCurrentView(AppView.LAB_DASHBOARD);
    } else {
      setInternalPinError(true);
    }
  };

  const openInternalAuth = () => {
    setShowInternalAuth(true);
    setInternalPin('');
    setInternalPinError(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 20;
    const y = (e.clientY / window.innerHeight - 0.5) * 20;
    setMousePos({ x, y });
  };

  const renderView = () => {
    if (currentView === AppView.LANDING) {
      return (
        <div className="flex flex-col justify-center items-center relative z-10 px-6 max-w-7xl mx-auto w-full pt-10 pb-20">
            <div className="text-center mb-16 max-w-4xl mx-auto animate-fadeIn flex flex-col items-center">
               <div className="mb-10 transform hover:scale-105 transition duration-500">
                 <img 
                   src="https://i.ibb.co/0RTvYnq6/Logo-Prolub-principal-3.png" 
                   alt="Prolub Logo" 
                   className="h-24 md:h-32 object-contain drop-shadow-xl" 
                 />
               </div>
               <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-2 leading-tight drop-shadow-sm">Portal</h1>
               <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-purple-700 tracking-tight leading-tight drop-shadow-sm pb-2">Oportunidades de Mejora</h1>
               <div className="w-16 h-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mt-8 mb-8 mx-auto opacity-80"></div>
               <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto tracking-wide">Gestión centralizada de calidad, logística y excelencia operativa.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
              <div onClick={() => setCurrentView(AppView.COMMERCIAL_DASHBOARD)} className="group relative bg-white/70 backdrop-blur-xl rounded-[2rem] p-10 border border-white/80 shadow-lg hover:shadow-2xl hover:bg-white/90 transition-all duration-500 hover:-translate-y-1 cursor-pointer overflow-hidden ring-1 ring-white/60">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-purple-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10 flex flex-col h-full items-center text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500"><TrendingUp size={32} /></div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Gestión Comercial</h2>
                    <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">Reporte de novedades en campo, seguimiento de clientes y gestión de PQR.</p>
                    <div className="mt-auto flex items-center text-indigo-700 font-bold text-sm bg-indigo-50 border border-indigo-100 px-8 py-3 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">Ingresar <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" /></div>
                </div>
              </div>
              <div onClick={openInternalAuth} className="group relative bg-white/70 backdrop-blur-xl rounded-[2rem] p-10 border border-white/80 shadow-lg hover:shadow-2xl hover:bg-white/90 transition-all duration-500 hover:-translate-y-1 cursor-pointer overflow-hidden ring-1 ring-white/60">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-blue-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10 flex flex-col h-full items-center text-center">
                    <div className="w-16 h-16 bg-white border-2 border-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500"><Activity size={32} /></div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Gestión Interna</h2>
                    <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">Laboratorio, Planta, Logística y HSEQ. Análisis de causa raíz y asignación de tareas.</p>
                    <div className="mt-auto flex items-center text-slate-600 font-bold text-sm bg-white border border-slate-200 px-8 py-3 rounded-full group-hover:bg-slate-800 group-hover:text-white group-hover:border-slate-800 transition-all duration-300 shadow-sm">Acceder <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" /></div>
                </div>
              </div>
            </div>
            <div className="mt-20 py-6 text-center relative z-10 border-t border-slate-200/50 w-full max-w-4xl">
               <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">© 2026 Doge Ai - Prolub S.A. - Todos los derechos reservados</p>
            </div>
        </div>
      );
    }

    if (currentView === AppView.COMMERCIAL_DASHBOARD) return <CommercialDashboard claims={claims} onCreateNew={handleCreateNewClaim} onLogout={handleCommercialLogout} activeUser={activeCommercialUser} onUserChange={setActiveCommercialUser} />;
    if (currentView === AppView.COMMERCIAL_WIZARD) return <CommercialWizard onSubmit={handleCommercialSubmit} onCancel={() => setCurrentView(AppView.COMMERCIAL_DASHBOARD)} defaultReporterName={activeCommercialUser} />;
    if (currentView === AppView.LAB_DASHBOARD) return <LabDashboard claims={claims} onUpdateClaim={handleLabUpdate} onDeleteClaim={handleDeleteClaim} onLogout={() => setCurrentView(AppView.LANDING)} onRefresh={loadClaims} />;
    if (currentView === AppView.IMPROVEMENT) return <ImprovementWizard onBack={() => setCurrentView(AppView.LANDING)} onSubmit={handleImprovementSubmit} />;
    return <div>Error: Vista desconocida</div>;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 relative overflow-hidden" onMouseMove={handleMouseMove}>
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute -top-[10%] left-[10%] w-[80vw] h-[80vw] bg-indigo-100/40 rounded-full mix-blend-multiply filter blur-[120px] opacity-60 animate-float-slow" style={{ transform: `translate(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px)` }}></div>
         <div className="absolute top-[20%] right-[10%] w-[60vw] h-[60vw] bg-purple-100/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-float-medium" style={{ transform: `translate(${mousePos.x * -0.5}px, ${mousePos.y * -0.5}px)` }}></div>
         <div className="absolute inset-0 opacity-[0.2] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </div>
      <style>{`@keyframes float { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(10px, -20px) scale(1.05); } 66% { transform: translate(-10px, 10px) scale(0.95); } 100% { transform: translate(0px, 0px) scale(1); } } .animate-float-slow { animation: float 25s ease-in-out infinite; } .animate-float-medium { animation: float 20s ease-in-out infinite reverse; }`}</style>
      
      {/* NOTIFICATIONS */}
      {notification && notification.visible && (<div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[200] animate-bounce-in px-4 w-full max-w-md"><div className="bg-green-600 text-white px-6 py-5 rounded-2xl shadow-2xl flex items-center gap-4 border border-green-500/50 backdrop-blur-sm"><div className="bg-white/20 p-3 rounded-full flex-shrink-0"><CheckCircle2 size={32} className="text-white" strokeWidth={3} /></div><div className="flex-1"><h4 className="font-bold text-xl leading-none mb-1">{notification.message}</h4>{notification.subMessage && (<p className="text-green-100 text-sm leading-tight opacity-90">{notification.subMessage}</p>)}</div></div></div>)}
      
      {/* INTERNAL AUTH MODAL */}
      {showInternalAuth && (<div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"><div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative animate-fadeIn border border-white/50"><button onClick={() => setShowInternalAuth(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition"><X size={20} /></button><div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-lg"><Lock size={32} /></div><h3 className="text-xl font-bold text-slate-800 mb-2">Acceso Corporativo</h3><p className="text-sm text-slate-500 mb-6">Área restringida. Ingrese credenciales.</p><input type="password" autoFocus placeholder="PIN" className="w-full text-center text-3xl font-mono tracking-[0.5em] p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent mb-3 transition-all bg-white" value={internalPin} onChange={(e) => { setInternalPin(e.target.value); setInternalPinError(false); }} onKeyDown={(e) => e.key === 'Enter' && handleInternalAuthSubmit()} />{internalPinError && <p className="text-xs text-red-500 font-bold mb-4 bg-red-50 py-1 px-3 rounded-full inline-block">Código incorrecto</p>}<button onClick={handleInternalAuthSubmit} className="w-full mt-2 py-4 rounded-xl bg-gradient-to-r from-indigo-700 to-purple-800 text-white font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">VALIDAR ACCESO</button></div></div>)}
      
      {/* FULL SCREEN LOADING OVERLAY */}
      {isLoading && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fadeIn cursor-wait transition-all">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden border border-white/20">
            {/* Decorative Top Bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse"></div>
            
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-indigo-50/50">
              <RefreshCw size={32} className="text-indigo-600 animate-spin" />
            </div>
            
            <h3 className="text-xl font-black text-slate-800 mb-2">Sincronizando</h3>
            
            <div className="space-y-4">
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Conectando con la base de datos en Google Sheets...
              </p>
              
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-50 py-2 px-3 rounded-lg border border-slate-100">
                 <Database size={12} className="text-slate-400"/>
                 <span>No cierres esta ventana</span>
              </div>
              
              <p className="text-[10px] text-indigo-400 font-bold animate-pulse">
                Esto puede tomar unos segundos...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col min-h-screen">{renderView()}</div>
    </div>
  );
}
