
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

  // Multi-Item State
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  
  // Temporary State for Adding Items
  const [tempProductRef, setTempProductRef] = useState('');
  const [tempBatch, setTempBatch] = useState('');
  const [tempQuantity, setTempQuantity] = useState('');

  // Effect to set email if default name provided
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
      
      // Reset items if brand changes to avoid mixing brands (business rule assumption)
      if (field === 'brand') {
         setClaimItems([]);
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

  // --- ITEM MANAGEMENT ---
  const handleAddItem = () => {
    if (!tempProductRef) {
        alert("Seleccione un producto.");
        return;
    }
    if (!tempBatch) {
        alert("Escriba el lote.");
        return;
    }
    if (!tempQuantity) {
        alert("Indique la cantidad afectada.");
        return;
    }

    const newItem: ClaimItem = {
        id: Date.now().toString(),
        productRef: tempProductRef,
        batch: tempBatch,
        quantity: tempQuantity
    };

    setClaimItems(prev => [...prev, newItem]);
    
    // Clear inputs but keep product might be useful? No, clear all for fresh entry
    setTempProductRef('');
    setTempBatch('');
    setTempQuantity('');
  };

  const handleRemoveItem = (id: string) => {
      setClaimItems(prev => prev.filter(i => i.id !== id));
  };
  // -----------------------

  const handleNext = () => {
    // Critical Validation for Step 2
    if (currentStep === 2) {
      if (claimItems.length === 0) {
        alert("CRÍTICO: Debe agregar al menos un producto a la lista de afectación.");
        return;
      }
    }
    // Validation Step 1
    if (currentStep === 1) {
        if (!formData.reporterName) {
           alert("Por favor seleccione quién reporta el caso.");
           return;
        }
        if (!formData.client || !formData.invoiceNumber) {
            alert("Por favor complete todos los campos del cliente.");
            return;
        }
    }

    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleEnhanceText = async () => {
    if (!formData.description.trim()) return;
    setIsEnhancing(true);
    const enhanced = await enhanceClaimDescription(formData.description);
    setFormData(prev => ({ ...prev, description: enhanced }));
    setIsEnhancing(false);
  };

  const handleSubmit = () => {
    if (uploadedFiles.length === 0) {
        alert("OBLIGATORIO: Debe adjuntar al menos una evidencia (Foto, Video o PDF).");
        return;
    }

    const processedFiles = uploadedFiles.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file) 
    }));

    // Determine legacy single fields for dashboard summary
    const summaryProductRef = claimItems.length === 1 
        ? claimItems[0].productRef 
        : `Múltiples Productos (${claimItems.length})`;
    
    const summaryBatch = claimItems.length === 1
        ? claimItems[0].batch
        : "Varios Lotes";

    onSubmit({
      ...formData,
      productRef: summaryProductRef,
      batch: summaryBatch,
      affectedItems: claimItems, // Pass the full list
      files: processedFiles
    }, uploadedFiles);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-900 to-purple-800 text-white p-6 rounded-b-3xl shadow-lg relative overflow-hidden flex-shrink-0">
        <div className="flex justify-between items-center mb-2 relative z-10">
          <h1 className="text-xl font-bold tracking-tight">Nueva Reclamación</h1>
          <button onClick={onCancel} className="text-white/70 hover:text-white text-sm">Cancelar</button>
        </div>
        <p className="text-indigo-200 text-xs relative z-10">Paso {currentStep} de 4</p>
      </header>

      {/* Progress Bar */}
      <div className="px-6 mt-6 mb-4 flex-shrink-0">
        <div className="flex justify-between items-center relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-0"></div>
          {STEPS.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const StepIcon = step.icon;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'bg-red-600 text-white shadow-md scale-110' : 
                    isCompleted ? 'bg-indigo-900 text-white' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  <StepIcon size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="px-6 flex-grow flex flex-col max-w-lg mx-auto w-full">
        <div className="bg-white rounded-xl shadow-lg p-6 flex-grow flex flex-col">
          
          {/* Step 1: Client */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Datos Iniciales</h3>
              
              <div className="space-y-1">
                <SearchableSelect
                  label="Quién Reporta"
                  options={REPORTERS_LIST.map(r => r.name)}
                  value={formData.reporterName}
                  onChange={handleReporterChange}
                  placeholder="Escriba su nombre..."
                  icon={User}
                />
                
                {formData.reporterEmail && (
                  <p className="text-[10px] text-indigo-500 font-medium pl-1">
                    Se enviará copia a: {formData.reporterEmail}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase">Cliente / Distribuidor</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ej: Transportes S.A."
                  value={formData.client}
                  onChange={(e) => handleInputChange('client', e.target.value)}
                />
                <p className="text-[10px] text-blue-500 font-bold pl-1">
                  Razón Social
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase">Número de Factura</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ej: FE-10293"
                  value={formData.invoiceNumber}
                  onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                />
              </div>

              <div className="pt-2">
                <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Tipo de Novedad</label>
                <div className="grid grid-cols-2 gap-3">
                   <label className={`border rounded-lg p-3 flex items-center justify-center gap-2 cursor-pointer transition ${formData.incidentType === IncidentType.QUALITY ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-slate-50'}`}>
                      <input 
                        type="radio" 
                        name="type" 
                        className="hidden"
                        checked={formData.incidentType === IncidentType.QUALITY} 
                        onChange={() => handleInputChange('incidentType', IncidentType.QUALITY)}
                      />
                      <Sparkles size={16} /> Calidad
                   </label>
                   <label className={`border rounded-lg p-3 flex items-center justify-center gap-2 cursor-pointer transition ${formData.incidentType === IncidentType.LOGISTICS ? 'bg-orange-50 border-orange-500 text-orange-700' : 'hover:bg-slate-50'}`}>
                      <input 
                        type="radio" 
                        name="type" 
                        className="hidden"
                        checked={formData.incidentType === IncidentType.LOGISTICS} 
                        onChange={() => handleInputChange('incidentType', IncidentType.LOGISTICS)}
                      />
                      <Truck size={16} /> Logística
                   </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Product & Items */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <h3 className="text-lg font-bold text-slate-800">Selección de Productos</h3>

              {/* Brand Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">1. Seleccione Marca</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 cursor-pointer transition text-center ${formData.brand === Brand.GULF ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500' : 'hover:bg-slate-50'}`}>
                     <input type="radio" name="brand" className="hidden" checked={formData.brand === Brand.GULF} onChange={() => handleInputChange('brand', Brand.GULF)} />
                     <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                     <span className="font-bold text-xs text-slate-700">Gulf</span>
                  </label>
                  <label className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 cursor-pointer transition text-center ${formData.brand === Brand.VALVOLINE ? 'bg-red-50 border-red-600 ring-1 ring-red-600' : 'hover:bg-slate-50'}`}>
                     <input type="radio" name="brand" className="hidden" checked={formData.brand === Brand.VALVOLINE} onChange={() => handleInputChange('brand', Brand.VALVOLINE)} />
                     <div className="w-3 h-3 rounded-full bg-red-600"></div>
                     <span className="font-bold text-xs text-slate-700">Valvoline</span>
                  </label>
                  <label className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 cursor-pointer transition text-center ${formData.brand === Brand.MAQUILA ? 'bg-slate-100 border-slate-400 ring-1 ring-slate-400' : 'hover:bg-slate-50'}`}>
                     <input type="radio" name="brand" className="hidden" checked={formData.brand === Brand.MAQUILA} onChange={() => handleInputChange('brand', Brand.MAQUILA)} />
                     <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                     <span className="font-bold text-xs text-slate-700">Otro</span>
                  </label>
                </div>
              </div>

              {/* Add Item Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase flex items-center gap-2 border-b border-indigo-100 pb-2">
                      <Plus size={14} /> Agregar Producto a la Reclamación
                  </h4>
                  
                  {/* Product Search */}
                  <div>
                    {formData.brand === Brand.GULF && (
                        <SearchableSelect
                        label="Referencia"
                        options={GULF_PRODUCTS}
                        value={tempProductRef}
                        onChange={setTempProductRef}
                        placeholder="Buscar referencia..."
                        />
                    )}
                    {formData.brand === Brand.VALVOLINE && (
                        <SearchableSelect
                        label="Referencia"
                        options={VALVOLINE_PRODUCTS}
                        value={tempProductRef}
                        onChange={setTempProductRef}
                        placeholder="Buscar referencia..."
                        />
                    )}
                    {formData.brand === Brand.MAQUILA && (
                        <>
                        <label className="text-xs font-bold text-slate-600 uppercase">Referencia</label>
                        <input 
                            type="text"
                            placeholder="Escriba la referencia manual"
                            className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            value={tempProductRef}
                            onChange={(e) => setTempProductRef(e.target.value)}
                        />
                        </>
                    )}
                  </div>

                  {/* Batch and Quantity Row */}
                  <div className="flex gap-3">
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Lote (Batch)</label>
                          <input 
                              type="text" 
                              placeholder="Ej: L-204"
                              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-mono text-sm"
                              value={tempBatch}
                              onChange={(e) => setTempBatch(e.target.value)}
                          />
                      </div>
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Cant. Afectada</label>
                          <input 
                              type="text" 
                              placeholder="Ej: 3 Baldes"
                              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-sm"
                              value={tempQuantity}
                              onChange={(e) => setTempQuantity(e.target.value)}
                          />
                      </div>
                  </div>

                  <button 
                    onClick={handleAddItem}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition flex justify-center items-center gap-2 shadow-sm"
                  >
                      <Plus size={16} /> Agregar a la Lista
                  </button>
              </div>

              {/* Items Summary List */}
              <div className="space-y-2">
                 <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                    Resumen de Afectación
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">{claimItems.length} ítems</span>
                 </h4>
                 
                 {claimItems.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                        <Layers size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No ha agregado productos aún.</p>
                    </div>
                 ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {claimItems.map((item) => (
                            <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-start shadow-sm animate-fadeIn">
                                <div className="flex-1 min-w-0 mr-2">
                                    <p className="text-sm font-bold text-slate-800 truncate">{item.productRef}</p>
                                    <div className="flex gap-3 text-xs text-slate-500 mt-1">
                                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Lote: <strong className="text-slate-700">{item.batch}</strong></span>
                                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Cant: <strong className="text-slate-700">{item.quantity}</strong></span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="text-slate-400 hover:text-red-500 p-1"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                 )}
              </div>

            </div>
          )}

          {/* Step 3: Details */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <h3 className="text-lg font-bold text-slate-800">Detalle & IA</h3>

              {/* Possible Solution Section */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Posible solución</label>
                <select 
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                  value={formData.correctionType}
                  onChange={(e) => handleInputChange('correctionType', e.target.value)}
                >
                  <option>Pendiente revisión</option>
                  <option>Requiere cambio mano a mano</option>
                  <option>Nota crédito</option>
                  <option>Cliente retiene producto</option>
                  <option>Devolución parcial</option>
                  <option>Otro</option>
                </select>
                
                {/* Conditional Field: Credit Note Value */}
                {formData.correctionType === 'Nota crédito' && (
                  <div className="animate-fadeIn mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <label className="text-[10px] font-bold text-green-700 uppercase block mb-1">Valor nota crédito (Antes de IVA)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 text-green-600" size={14} />
                      <input 
                        type="number"
                        placeholder="Monto aproximado"
                        className="w-full pl-8 pr-3 py-2 border border-green-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                        value={formData.creditNoteValue}
                        onChange={(e) => handleInputChange('creditNoteValue', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Conditional Instruction: Other */}
                {formData.correctionType === 'Otro' && (
                  <div className="animate-fadeIn mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 flex gap-2 items-start">
                    <Info className="text-amber-600 shrink-0 mt-0.5" size={14} />
                    <p className="text-[10px] text-amber-800 font-medium leading-tight">
                      Por favor especifique detalladamente en la <strong>descripción</strong> cuál es la solución esperada para este caso.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-600 uppercase">Descripción</label>
                  <button 
                    onClick={handleEnhanceText}
                    disabled={isEnhancing || !formData.description}
                    className="flex items-center gap-1.5 text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition disabled:opacity-50 border border-indigo-100 font-bold"
                  >
                    {isEnhancing ? (
                      <span className="animate-pulse">Mejorando...</span>
                    ) : (
                      <>
                        <Sparkles size={12} /> Mejorar con IA
                      </>
                    )}
                  </button>
                </div>
                <textarea 
                  rows={6}
                  placeholder="Describe el problema y la solución esperada aquí..."
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm leading-relaxed"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 4: Evidence */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fadeIn text-center">
              <h3 className="text-lg font-bold text-slate-800">Evidencias</h3>
              <p className="text-sm text-slate-500 -mt-4">Fotos, Videos o PDF</p>

              <div className="border-2 border-dashed border-indigo-200 rounded-xl p-8 bg-indigo-50/30 flex flex-col items-center justify-center group hover:border-indigo-400 hover:bg-indigo-50/50 transition cursor-pointer relative h-40">
                {/* Visual Feedback on Hover/Focus handled by group-hover */}
                <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
                    multiple 
                    accept="image/*,video/*,application/pdf" 
                    onChange={handleFileChange}
                />
                
                <div className="bg-white p-3 rounded-full shadow-sm mb-2 group-hover:scale-110 transition">
                  <Upload size={24} className="text-indigo-600" />
                </div>
                <h4 className="font-medium text-indigo-900 text-sm">Subir Archivos</h4>
                <p className="text-[10px] text-indigo-400 mt-1">Soporta: .JPG, .PNG, .MP4, .PDF</p>
              </div>

              {/* Show selected files */}
              {uploadedFiles.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 divide-y max-h-40 overflow-y-auto">
                    {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="p-3 flex items-center gap-3 text-left">
                            <div className="bg-slate-100 p-2 rounded">
                                {file.type.includes('image') ? <ImageIcon size={16} className="text-blue-500"/> : 
                                 file.type.includes('pdf') ? <FileText size={16} className="text-red-500"/> :
                                 <File size={16} className="text-slate-500"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                                <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 p-1">
                                <div className="text-[10px] font-bold text-red-500 border border-red-200 px-2 py-0.5 rounded hover:bg-red-50">Borrar</div>
                            </button>
                        </div>
                    ))}
                </div>
              )}

              {uploadedFiles.length === 0 && (
                 <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700 font-bold text-left">Es OBLIGATORIO adjuntar evidencia para continuar.</p>
                 </div>
              )}

              <div className="flex items-start gap-3 text-left bg-blue-50 p-4 rounded-lg border border-blue-100 mt-2">
                <CheckCircle2 size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-blue-900">Validación Final</p>
                  <p className="text-xs text-blue-700/80">
                    Al enviar, se notificará al equipo de HSEQ y se enviará una copia a <strong>{formData.reporterEmail || 'su correo'}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="mt-4 mb-2 flex gap-3 pt-2">
          {currentStep > 1 && (
            <button 
              onClick={handleBack}
              className="flex-1 py-3.5 px-6 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2"
            >
              <ChevronLeft size={18} /> Atrás
            </button>
          )}
          
          {currentStep < 4 ? (
            <button 
              onClick={handleNext}
              className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-900 to-indigo-800 text-white font-bold hover:shadow-lg hover:to-indigo-700 transition flex items-center justify-center gap-2"
            >
              Siguiente <ChevronRight size={18} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={uploadedFiles.length === 0}
              className="flex-1 py-3.5 px-6 rounded-xl bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold hover:bg-red-700 shadow-red-200 shadow-lg transition flex items-center justify-center gap-2"
            >
              Enviar Reclamación <CheckCircle2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
