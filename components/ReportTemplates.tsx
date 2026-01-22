
import React from 'react';
import { Claim, EvidenceFile } from '../types';
import { FileText, Download, ExternalLink, Image as ImageIcon } from 'lucide-react';

interface ReportProps {
  claim: Claim;
}

const categorizeFiles = (files: EvidenceFile[] | undefined) => {
    const images: EvidenceFile[] = [];
    const docs: EvidenceFile[] = [];
    files?.forEach(f => {
        if (f.type && f.type.startsWith('image/')) images.push(f);
        else docs.push(f);
    });
    return { images, docs };
};

export const ClientReportTemplate: React.FC<ReportProps> = ({ claim }) => {
  // Combine Initial Files and Mitigation Evidence
  const allFiles = [...(claim.files || []), ...(claim.immediateSolutionExecutionEvidence || [])];
  const { images, docs } = categorizeFiles(allFiles);
  
  // Display up to 6 images in the report grid
  const displayImages = images.slice(0, 6);

  return (
    <div className="w-[210mm] bg-white text-black font-sans text-xs p-8 flex flex-col relative shadow-none" style={{ minHeight: '297mm' }}>
      {/* HEADER */}
      <div className="border-2 border-black mb-6">
        <div className="flex border-b border-black">
           <div className="w-40 border-r border-black flex items-center justify-center p-2">
              <img src="https://i.ibb.co/0RTvYnq6/Logo-Prolub-principal-3.png" alt="Prolub" className="h-10 object-contain" crossOrigin="anonymous" />
           </div>
           <div className="flex-1 flex flex-col text-center justify-center">
              <div className="border-b border-black font-bold p-1 text-sm text-black">PROLUB S.A.</div>
              <div className="p-1 font-bold text-sm text-black">RESPUESTA A RECLAMACIONES</div>
           </div>
           <div className="w-32 border-l border-black flex flex-col text-center text-[10px] justify-center">
              <div className="border-b border-black p-1 bg-slate-100 font-bold text-black">CÓDIGO: LAB-F-11</div>
              <div className="p-1 text-black">VERSIÓN: 2</div>
           </div>
        </div>
      </div>

      {/* 1. INFORMACIÓN DEL CLIENTE */}
      <div className="mb-6 border border-black">
        <div className="bg-orange-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">1. Información del Cliente</div>
        <div className="grid grid-cols-[120px_1fr] border-b border-black">
           <div className="bg-slate-50 p-1 border-r border-black font-bold text-black">Cliente:</div>
           <div className="p-1 font-medium text-black">{claim.client}</div>
        </div>
        <div className="grid grid-cols-[120px_1fr] border-b border-black">
           <div className="bg-slate-50 p-1 border-r border-black font-bold text-black">Contacto:</div>
           <div className="p-1 text-black">{claim.reporterName}</div>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
           <div className="bg-slate-50 p-1 border-r border-black font-bold text-black">Asunto:</div>
           <div className="p-1 text-black">Respuesta a Solicitud {claim.id}</div>
        </div>
      </div>

      {/* 2. INFORMACIÓN DEL RECLAMO */}
      <div className="mb-6 border border-black">
        <div className="bg-orange-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">2. Información del reclamo</div>
        <div className="grid grid-cols-[120px_1fr] border-b border-black">
           <div className="bg-slate-50 p-1 border-r border-black font-bold text-black">Fecha Reporte:</div>
           <div className="p-1 text-black">{claim.date}</div>
        </div>
        <div className="border-b-0">
            <div className="bg-slate-50 p-1 border-b border-black font-bold text-center text-[10px] uppercase text-black">Productos Relacionados</div>
            {claim.affectedItems && claim.affectedItems.length > 0 ? (
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-200 text-[9px] text-black font-bold">
                            <th className="p-1 border-r border-black border-b border-black w-1/2">Producto / Referencia</th>
                            <th className="p-1 border-r border-black border-b border-black w-1/4">Lote</th>
                            <th className="p-1 border-b border-black w-1/4">Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {claim.affectedItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-200 last:border-0">
                                <td className="p-1 border-r border-black border-b border-black text-black break-words whitespace-normal align-top">{item.productRef}</td>
                                <td className="p-1 border-r border-black border-b border-black text-black break-words whitespace-normal align-top">{item.batch}</td>
                                <td className="p-1 border-b border-black text-black break-words whitespace-normal align-top">{item.quantity}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="p-2 text-xs text-black">
                    <p className="mb-1"><span className="font-bold">Ref:</span> {claim.productRef}</p>
                    <p><span className="font-bold">Lote:</span> {claim.batch}</p>
                </div>
            )}
        </div>
      </div>

      {/* 3. DESCRIPCIÓN */}
      <div className="mb-6 border border-black">
         <div className="bg-orange-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">3. Descripción del Reclamo (Suministrado por el cliente)</div>
         <div className="p-4 italic text-justify leading-relaxed min-h-[4rem] text-black">
            "{claim.description}"
         </div>
      </div>

      {/* 4. PLAN DE ACCIÓN */}
      <div className="mb-6 border border-black break-inside-avoid">
         <div className="bg-orange-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">4. Plan de Acción y Solución</div>
         <div className="p-4 space-y-4">
             <div>
                <strong className="block mb-2 underline uppercase text-[10px] text-black">Acción Inmediata Tomada:</strong>
                <p className="text-sm mb-2 text-black">{claim.immediateSolution || 'En proceso de gestión.'}</p>
                {claim.immediateSolutionExecutionNotes && (
                    <div className="mt-3 text-xs bg-slate-50 p-3 border border-slate-300 rounded text-black">
                        <strong>Nota de Ejecución:</strong> {claim.immediateSolutionExecutionNotes}
                    </div>
                )}
             </div>
         </div>
      </div>

      {/* 5. EVIDENCIAS */}
      <div className="mb-6 border border-black break-inside-avoid">
         <div className="bg-slate-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">Evidencias Fotográficas y Documentales</div>
         
         <div className="p-4">
             {displayImages.length > 0 ? (
                 <div className="grid grid-cols-2 gap-4 mb-4">
                     {displayImages.map((img, idx) => (
                        <div key={idx} className="flex flex-col border border-slate-200 p-1">
                            <div className="h-40 w-full bg-slate-50 flex items-center justify-center overflow-hidden mb-1 relative">
                                <img 
                                    src={img.url} 
                                    className="max-w-full max-h-full object-contain" 
                                    alt={`Evidencia ${idx + 1}`}
                                    crossOrigin="anonymous" 
                                />
                            </div>
                            <span className="text-[9px] text-center text-slate-500 truncate px-1">{img.name}</span>
                        </div>
                     ))}
                 </div>
             ) : (
                 <div className="text-center py-4 text-slate-400 italic mb-2">No hay imágenes disponibles.</div>
             )}

             {docs.length > 0 && (
                 <div className="border-t border-slate-200 pt-3">
                     <p className="font-bold underline text-[10px] mb-2 uppercase text-black">Documentos de Soporte Adjuntos:</p>
                     <ul className="list-disc pl-5 space-y-1">
                         {docs.map((doc, idx) => (
                             <li key={idx} className="text-[10px] text-slate-700">
                                 <span className="font-medium">{doc.name}</span> <span className="text-slate-400 italic">(Disponible en Portal Digital)</span>
                             </li>
                         ))}
                     </ul>
                 </div>
             )}
         </div>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-300 text-[9px] text-center text-slate-500">
         <p>Este documento es generado automáticamente por el Portal de Calidad Prolub.</p>
         <p>{new Date().toLocaleDateString()} - Página 1 de 1</p>
      </div>
    </div>
  );
};

export const FinalReportTemplate: React.FC<ReportProps> = ({ claim }) => {
  const allFiles = [...(claim.files || []), ...(claim.immediateSolutionExecutionEvidence || [])];
  const { images } = categorizeFiles(allFiles);

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-black font-sans text-xs p-12 flex flex-col">
       
       <div className="flex justify-between items-center border-b-2 border-indigo-900 pb-4 mb-8">
          <img src="https://i.ibb.co/0RTvYnq6/Logo-Prolub-principal-3.png" alt="Prolub" className="h-12 object-contain" crossOrigin="anonymous" />
          <div className="text-right">
             <h1 className="text-xl font-bold text-indigo-900">INFORME TÉCNICO DE CIERRE</h1>
             <p className="font-mono text-slate-500">CASO #{claim.id}</p>
          </div>
       </div>

       <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-slate-50 p-4 rounded border border-slate-200">
             <h3 className="font-bold text-indigo-700 border-b border-slate-300 pb-2 mb-2 uppercase">Información General</h3>
             <div className="space-y-1">
                <p><span className="font-bold">Cliente:</span> {claim.client}</p>
                <p><span className="font-bold">Fecha Apertura:</span> {claim.date}</p>
                <p><span className="font-bold">Tipo:</span> {claim.incidentType}</p>
                <p><span className="font-bold">Factura:</span> {claim.invoiceNumber}</p>
             </div>
          </div>
          <div className="bg-slate-50 p-4 rounded border border-slate-200">
             <h3 className="font-bold text-indigo-700 border-b border-slate-300 pb-2 mb-2 uppercase">Producto Afectado</h3>
             <div className="space-y-1">
                {claim.affectedItems && claim.affectedItems.length > 0 ? (
                    claim.affectedItems.map((i, idx) => (
                        <div key={idx} className="border-b border-slate-200 pb-1 mb-1 last:border-0">
                            <p><span className="font-bold">Ref:</span> {i.productRef}</p>
                            <p className="text-[10px]"><span className="font-bold">Lote:</span> {i.batch} | <span className="font-bold">Cant:</span> {i.quantity}</p>
                        </div>
                    ))
                ) : (
                    <>
                        <p><span className="font-bold">Marca:</span> {claim.brand}</p>
                        <p><span className="font-bold">Referencia:</span> {claim.productRef}</p>
                        <p><span className="font-bold">Lote (Batch):</span> {claim.batch}</p>
                    </>
                )}
             </div>
          </div>
       </div>

       <div className="mb-6">
          <h3 className="font-bold text-white bg-indigo-900 p-2 mb-2 uppercase text-[10px]">1. Descripción del Problema</h3>
          <div className="p-4 border border-indigo-100 rounded bg-indigo-50/30 italic text-justify">
             "{claim.description}"
          </div>
       </div>

       <div className="mb-6">
          <h3 className="font-bold text-white bg-indigo-900 p-2 mb-2 uppercase text-[10px]">2. Acción de Mitigación Inmediata</h3>
          <div className="p-4 border border-slate-200 rounded mb-2">
             <p className="font-bold text-sm">{claim.immediateSolution}</p>
             <p className="text-[10px] text-slate-500 mt-2">Responsable: {claim.immediateSolutionResponsible}</p>
          </div>
          {claim.immediateSolutionExecutionNotes && (
             <div className="ml-4 p-3 bg-green-50 border-l-4 border-green-500 text-xs">
                <strong>Ejecución:</strong> {claim.immediateSolutionExecutionNotes}
             </div>
          )}
       </div>

       <div className="mb-6">
          <h3 className="font-bold text-white bg-indigo-900 p-2 mb-2 uppercase text-[10px]">3. Análisis de Causa Raíz (Ishikawa)</h3>
          <ul className="list-disc pl-5 space-y-1">
             {claim.ishikawaList?.map((item, idx) => (
                <li key={idx}>
                   <span className="font-bold text-indigo-700">{item.category}:</span> {item.observation}
                </li>
             ))}
          </ul>
       </div>

       <div className="mb-6">
          <h3 className="font-bold text-white bg-indigo-900 p-2 mb-2 uppercase text-[10px]">4. Plan de Acción Ejecutado</h3>
          <table className="w-full text-left border-collapse border border-slate-200">
             <thead>
                <tr className="bg-slate-100 text-slate-600 border-b border-slate-300 text-[10px]">
                   <th className="p-2 border-r">Área</th>
                   <th className="p-2 border-r">Tarea</th>
                   <th className="p-2 border-r">Resultado</th>
                   <th className="p-2">Estado</th>
                </tr>
             </thead>
             <tbody>
                {claim.tasks?.map((task, idx) => (
                   <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 font-bold text-[10px] border-r">{task.assignedTo}</td>
                      <td className="p-2 border-r">{task.description}</td>
                      <td className="p-2 italic text-slate-600 border-r">{task.executionNotes}</td>
                      <td className="p-2 font-bold text-green-600">{task.status === 'Realized' ? 'CERRADO' : 'PENDIENTE'}</td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>

       {/* Evidence Section for Final Report */}
       {images.length > 0 && (
           <div className="mb-8 break-inside-avoid">
               <h3 className="font-bold text-white bg-indigo-900 p-2 mb-2 uppercase text-[10px]">5. Evidencia del Caso</h3>
               <div className="grid grid-cols-4 gap-4">
                   {images.slice(0, 4).map((f, i) => (
                       <div key={i} className="flex flex-col border border-slate-200 p-1">
                           <div className="h-24 bg-slate-50 flex items-center justify-center overflow-hidden mb-1 relative">
                               <img 
                                   src={f.url} 
                                   className="max-w-full max-h-full object-contain" 
                                   alt={f.name} 
                                   crossOrigin="anonymous"
                               />
                           </div>
                           <span className="text-[9px] text-center text-slate-500 truncate">{f.name}</span>
                       </div>
                   ))}
               </div>
           </div>
       )}

       <div className="mt-auto border-t-2 border-indigo-900 pt-8 flex justify-between items-end">
          <div className="flex flex-col gap-8">
             <div>
                <div className="h-px bg-black w-48 mb-1"></div>
                <p className="font-bold">Aprobado Por</p>
                <p className="text-[10px] text-slate-500">Gerencia / Auditoría de Calidad</p>
             </div>
          </div>
          <div className="text-right text-[10px] text-slate-400">
             <p className="font-bold text-indigo-900">PROLUB S.A.</p>
             <p>Documento Confidencial</p>
             <p>Generado el {new Date().toLocaleString()}</p>
          </div>
       </div>

    </div>
  );
};
