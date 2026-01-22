
import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  AlertTriangle, 
  Sparkles, 
  Upload, 
  CheckCircle2, 
  FileText,
  User,
  Package,
  Truck,
  ImageIcon,
  File,
  Plus,
  Trash2,
  Layers,
  Info,
  DollarSign
} from 'lucide-react';
import { enhanceClaimDescription } from '../services/geminiService';
import { Claim, Brand, IncidentType, ClaimItem } from '../types';
import { REPORTERS_LIST, GULF_PRODUCTS, VALVOLINE_PRODUCTS } from '../constants';
import { SearchableSelect } from './SearchableSelect';

interface CommercialWizardProps {
  onSubmit: (claim: Omit<Claim, 'id' | 'status' | 'date'>, files: File[]) => void;
  onCancel: () => void;
  defaultReporterName?: string;
}

const STEPS = [
  { id: 1, title: 'Cliente', icon: User },
  { id: 2, title: 'Productos', icon: Package },
  { id: 3, title: 'Detalles', icon: FileText },
  { id: 4, title: 'Evidencia', icon: Upload },
];

export const CommercialWizard: React.FC<CommercialWizardProps> = ({ onSubmit, onCancel, defaultReporterName }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    reporterName: defaultReporterName || '',
    reporterEmail: '',
    client: '',
    invoiceNumber: '',
    incidentType: IncidentType.QUALITY,
    brand: Brand.GULF,
    correctionType: 'Pendiente revisión',
    creditNoteValue: '',
    description: '',
  });

  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  
  // Temporary State
  const [tempProductRef, setTempProductRef] = useState('');
  const [tempBatch, setTempBatch] = useState('');
  const [tempQuantity, setTempQuantity] = useState('');

  useEffect(() => {
    if (defaultReporterName) {
        const selectedReporter = REPORTERS_LIST.find(r => r.name === defaultReporterName);
        if (selectedReporter) {
            setFormData(prev => ({
                ...prev,
                reporterEmail: selectedReporter.email
            }));
        }
    }
  }, [defaultReporterName]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      if (field === 'brand') {
         // Do not clear claimItems when switching brand tabs
         setTempProductRef('');
      }
      return newData;
    });
  };

  const handleReporterChange = (name: string) => {
    const selectedReporter = REPORTERS_LIST.find(r => r.name === name);
    setFormData(prev => ({
      ...prev,
      reporterName: name,
      reporterEmail: selectedReporter?.email || ''
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setUploadedFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    if (!tempProductRef || !tempBatch || !tempQuantity) {
        alert("Complete todos los campos del producto.");
        return;
    }
    const newItem: ClaimItem = {
        id: Date.now().toString(),
        productRef: tempProductRef,
        batch: tempBatch,
        quantity: tempQuantity
    };
    setClaimItems(prev => [...prev, newItem]);
    setTempBatch('');
    setTempQuantity('');
  };

  const handleRemoveItem = (id: string) => {
      setClaimItems(prev => prev.filter(i => i.id !== id));
  };

  const handleNext = () => {
    if (currentStep === 2 && claimItems.length === 0) {
        alert("CRÍTICO: Debe agregar al menos un producto.");
        return;
    }
    if (currentStep === 1 && (!formData.client || !formData.invoiceNumber)) {
        alert("Complete los datos del cliente.");
        return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleEnhanceText = async () => {
    if (!formData.description.trim()) return;
    setIsEnhancing(true);
    try {
        const enhanced = await enhanceClaimDescription(formData.description);
        setFormData(prev => ({ ...prev, description: enhanced }));
    } finally {
        setIsEnhancing(false);
    }
  };

  const detectBrand = (productName: string): string => {
      if (GULF_PRODUCTS.includes(productName)) return Brand.GULF;
      if (VALVOLINE_PRODUCTS.includes(productName)) return Brand.VALVOLINE;
      // Fallback: If current tab is Maquila and product isn't in lists, assume Maquila
      if (formData.brand === Brand.MAQUILA) return Brand.MAQUILA;
      // Fallback: Return current tab selection
      return formData.brand;
  };

  const handleSubmit = () => {
    if (uploadedFiles.length === 0) {
        alert("OBLIGATORIO: Debe adjuntar al menos una evidencia.");
        return;
    }

    const processedFiles = uploadedFiles.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file) 
    }));

    // Construct detailed strings for Sheets storage
    let finalProductRef = '';
    let finalBatch = '';
    let calculatedBrands = formData.brand as string;
    
    if (claimItems.length > 0) {
        finalProductRef = claimItems.map(i => `${i.productRef} (Cant: ${i.quantity})`).join(' | ');
        finalBatch = claimItems.map(i => i.batch).join(' | ');
        
        // Calculate all unique brands involved in this claim
        const uniqueBrands = new Set(claimItems.map(item => detectBrand(item.productRef)));
        calculatedBrands = Array.from(uniqueBrands).join(' | ');
    } else {
        // Fallback if no items (should be blocked by validation)
        finalProductRef = "Sin Especificar";
        finalBatch = "Sin Especificar";
    }

    onSubmit({
      ...formData,
      brand: calculatedBrands as Brand, // Type assertion since it might be a concatenated string now
      productRef: finalProductRef,
      batch: finalBatch,
      affectedItems: claimItems, 
      files: processedFiles
    }, uploadedFiles);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* AI LOADING OVERLAY */}
       {isEnhancing && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center border border-white/20">
                <div className="relative mb-4">
                   <div className="w-16 h-16 border-4 border-indigo-100 rounded-full"></div>
                   <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                   <Sparkles className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800">Mejorando Redacción</h3>
                <p className="text-slate-500 text-sm">La IA está procesando tu texto...</p>
            </div>
         </div>
       )}

      {/* SIDE PANEL SUMMARY (LEFT) */}
      <aside className="w-full md:w-80 bg-slate-900 text-white p-6 flex-shrink-0 flex flex-col justify-between shadow-2xl z-20">
          <div>
              <div className="mb-8">
                  <h2 className="text-xl font-black tracking-tight mb-1">Resumen en Vivo</h2>
                  <p className="text-indigo-400 text-xs">Información del caso</p>
              </div>

              <div className="space-y-6">
                  <div className="group">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Cliente</label>
                      <div className="flex items-center justify-between">
                         <p className="font-bold text-lg leading-tight">{formData.client || '...'}</p>
                         {currentStep > 1 && <button onClick={() => setCurrentStep(1)} className="opacity-0 group-hover:opacity-100 text-[10px] bg-slate-800 px-2 py-1 rounded hover:text-indigo-400">Editar</button>}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{formData.invoiceNumber}</p>
                  </div>

                  <div className="group">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Novedad</label>
                      <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${formData.incidentType === IncidentType.QUALITY ? 'bg-blue-900/50 border-blue-500 text-blue-300' : 'bg-orange-900/50 border-orange-500 text-orange-300'}`}>
                             {formData.incidentType}
                          </span>
                      </div>
                  </div>

                  <div className="group">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Productos ({claimItems.length})</label>
                      {claimItems.length > 0 ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                              {claimItems.map(item => (
                                  <div key={item.id} className="bg-white/10 p-2 rounded border border-white/5 text-xs">
                                      <p className="font-bold truncate">{item.productRef}</p>
                                      <p className="text-slate-400">Lote: {item.batch} | Cant: {item.quantity}</p>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <p className="text-sm italic text-slate-600">Sin productos...</p>
                      )}
                      {currentStep > 2 && <button onClick={() => setCurrentStep(2)} className="mt-2 text-xs text-indigo-400 hover:text-white underline">Corregir Productos</button>}
                  </div>
              </div>
          </div>
          
          <button onClick={onCancel} className="mt-8 w-full py-3 border border-white/10 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white text-xs font-bold transition">
              Cancelar Operación
          </button>
      </aside>

      {/* MAIN CONTENT (RIGHT) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
         {/* Top Nav */}
         <div className="p-6">
             <div className="max-w-3xl mx-auto flex justify-between items-center">
                 <h1 className="text-2xl font-black text-slate-800">Nueva Reclamación</h1>
                 <div className="flex items-center gap-2">
                    {STEPS.map((step) => (
                        <div key={step.id} className={`w-3 h-3 rounded-full transition-all ${step.id === currentStep ? 'bg-indigo-600 scale-125' : step.id < currentStep ? 'bg-indigo-300' : 'bg-slate-200'}`}></div>
                    ))}
                    <span className="ml-2 text-xs font-bold text-slate-400">Paso {currentStep}/4</span>
                 </div>
             </div>
         </div>

         {/* Scrollable Form Area */}
         <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-100 min-h-[500px]">
                
                {currentStep === 1 && (
                    <div className="space-y-6 animate-fadeIn">
                        <h3 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-2">Información del Cliente</h3>
                        <SearchableSelect label="Quién Reporta" options={REPORTERS_LIST.map(r => r.name)} value={formData.reporterName} onChange={handleReporterChange} icon={User} />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Cliente / Razón Social</label>
                                <input type="text" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder-slate-400" placeholder="Ej: Transportes S.A." value={formData.client} onChange={(e) => handleInputChange('client', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Número de Factura</label>
                                <input type="text" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder-slate-400" placeholder="Ej: FE-10293" value={formData.invoiceNumber} onChange={(e) => handleInputChange('invoiceNumber', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Tipo de Novedad</label>
                            <div className="flex gap-4">
                                <label className={`flex-1 border rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition ${formData.incidentType === IncidentType.QUALITY ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-slate-50'}`}>
                                    <input type="radio" name="type" className="hidden" checked={formData.incidentType === IncidentType.QUALITY} onChange={() => handleInputChange('incidentType', IncidentType.QUALITY)} />
                                    <Sparkles size={24} /> <span className="font-bold">Calidad</span>
                                </label>
                                <label className={`flex-1 border rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition ${formData.incidentType === IncidentType.LOGISTICS ? 'bg-orange-900/50 border-orange-500 text-orange-700' : 'hover:bg-slate-50'}`}>
                                    <input type="radio" name="type" className="hidden" checked={formData.incidentType === IncidentType.LOGISTICS} onChange={() => handleInputChange('incidentType', IncidentType.LOGISTICS)} />
                                    <Truck size={24} /> <span className="font-bold">Logística</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-6 animate-fadeIn">
                        <h3 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-2">Productos Afectados</h3>
                        <div className="flex gap-2 mb-4">
                            {[Brand.GULF, Brand.VALVOLINE, Brand.MAQUILA].map(b => (
                                <button key={b} onClick={() => handleInputChange('brand', b)} className={`flex-1 py-2 rounded-lg font-bold text-xs border ${formData.brand === b ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{b}</button>
                            ))}
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            {formData.brand !== Brand.MAQUILA ? (
                                <SearchableSelect label="Referencia" options={formData.brand === Brand.GULF ? GULF_PRODUCTS : VALVOLINE_PRODUCTS} value={tempProductRef} onChange={setTempProductRef} />
                            ) : (
                                <input type="text" className="w-full p-3 border rounded-lg bg-white text-slate-900 placeholder-slate-400" placeholder="Ref. Manual" value={tempProductRef} onChange={e => setTempProductRef(e.target.value)} />
                            )}
                            <div className="flex gap-3">
                                <input type="text" className="flex-1 p-3 border rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400" placeholder="Lote" value={tempBatch} onChange={e => setTempBatch(e.target.value)} />
                                <input type="text" className="flex-1 p-3 border rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400" placeholder="Cantidad" value={tempQuantity} onChange={e => setTempQuantity(e.target.value)} />
                                <button onClick={handleAddItem} className="bg-indigo-600 text-white p-3 rounded-lg"><Plus/></button>
                            </div>
                        </div>
                        
                        {/* List of Added Items */}
                        {claimItems.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase">Items Agregados</h4>
                                {claimItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="text-sm">
                                            <p className="font-bold text-slate-800">{item.productRef}</p>
                                            <p className="text-xs text-slate-500">Lote: {item.batch} • Cant: {item.quantity}</p>
                                        </div>
                                        <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 3 && (
                     <div className="space-y-6 animate-fadeIn">
                        <h3 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-2">Detalles del Caso</h3>
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Solución Esperada</label>
                            <select className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900" value={formData.correctionType} onChange={(e) => handleInputChange('correctionType', e.target.value)}>
                                <option>Pendiente revisión</option>
                                <option>Requiere cambio mano a mano</option>
                                <option>Nota crédito</option>
                                <option>Cliente retiene producto</option>
                                <option>Devolución parcial</option>
                                <option>Otro</option>
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-600 uppercase">Descripción</label>
                                <button onClick={handleEnhanceText} className="text-xs text-indigo-600 font-bold flex items-center gap-1"><Sparkles size={12}/> Mejorar Texto</button>
                            </div>
                            <textarea rows={6} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white text-slate-900 placeholder-slate-400" value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} />
                        </div>
                     </div>
                )}

                {currentStep === 4 && (
                    <div className="space-y-6 animate-fadeIn text-center">
                        <h3 className="text-lg font-black text-slate-800 mb-4">Evidencias</h3>
                        <div className="border-2 border-dashed border-indigo-200 rounded-xl p-10 bg-indigo-50/50 hover:bg-indigo-50 transition relative">
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" multiple onChange={handleFileChange} accept="image/*,video/*,application/pdf" />
                            <Upload size={48} className="mx-auto text-indigo-400 mb-2"/>
                            <p className="font-bold text-indigo-900">Click para subir evidencias</p>
                        </div>
                        {uploadedFiles.length > 0 && (
                            <div className="space-y-2 text-left">
                                {uploadedFiles.map((f, i) => (
                                    <div key={i} className="flex justify-between text-sm p-2 bg-slate-50 border rounded"><span className="truncate">{f.name}</span><button onClick={() => removeFile(i)} className="text-red-500"><Trash2 size={14}/></button></div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
         </div>

         {/* Footer Actions */}
         <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center">
             {currentStep > 1 ? (
                 <button onClick={handleBack} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Atrás</button>
             ) : <div></div>}
             
             {currentStep < 4 ? (
                 <button onClick={handleNext} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition flex items-center gap-2">Siguiente <ChevronRight size={18}/></button>
             ) : (
                 <button onClick={handleSubmit} disabled={uploadedFiles.length === 0} className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50">Enviar <CheckCircle2 size={18}/></button>
             )}
         </div>
      </div>
    </div>
  );
};
