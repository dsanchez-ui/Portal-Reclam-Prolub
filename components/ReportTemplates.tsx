
import React from 'react';
import { Claim, EvidenceFile } from '../types';
import { FileText, Download, ExternalLink, Image as ImageIcon, FolderOpen } from 'lucide-react';

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
  // FILTERING FOR CLIENT: 
  // 1. Initial Files (claim.files)
  // 2. Mitigation Evidence (claim.mitigationActions)
  // 3. EXCLUDE Task Evidence
  
  const mitigationEvidence = claim.mitigationActions?.flatMap(m => m.executionEvidence || []) || [];
  const clientVisibleFiles = [...(claim.files || []), ...mitigationEvidence];
  const { images, docs } = categorizeFiles(clientVisibleFiles);
  
  const clientDriveLink = claim.driveClientFolderUrl || claim.driveFolderUrl;

  return (
    <div className="bg-white text-black font-sans text-xs">
      
      {/* PAGE 1: INFO & ACTIONS */}
      <div className="w-[210mm] min-h-[297mm] p-8 flex flex-col relative shadow-none">
          {/* HEADER */}
          <div className="border-2 border-black mb-4">
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
          <div className="mb-4 border border-black">
            <div className="bg-orange-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">1. Información del Cliente</div>
            <div className="grid grid-cols-[100px_1fr] border-b border-black">
              <div className="bg-slate-50 p-1 border-r border-black font-bold text-black text-[10px]">Cliente:</div>
              <div className="p-1 font-medium text-black text-[10px]">{claim.client}</div>
            </div>
            <div className="grid grid-cols-[100px_1fr] border-b border-black">
              <div className="bg-slate-50 p-1 border-r border-black font-bold text-black text-[10px]">Contacto:</div>
              <div className="p-1 text-black text-[10px]">{claim.reporterName}</div>
            </div>
            <div className="grid grid-cols-[100px_1fr]">
              <div className="bg-slate-50 p-1 border-r border-black font-bold text-black text-[10px]">Asunto:</div>
              <div className="p-1 text-black text-[10px]">Respuesta a Solicitud {claim.id}</div>
            </div>
          </div>

          {/* 2. INFORMACIÓN DEL RECLAMO */}
          <div className="mb-4 border border-black">
            <div className="bg-orange-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">2. Información del reclamo</div>
            <div className="grid grid-cols-[100px_1fr] border-b border-black">
              <div className="bg-slate-50 p-1 border-r border-black font-bold text-black text-[10px]">Fecha Reporte:</div>
              <div className="p-1 text-black text-[10px]">{claim.date}</div>
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
                                    <td className="p-1 border-r border-black border-b border-black text-black text-[9px] break-words whitespace-normal align-top">{item.productRef}</td>
                                    <td className="p-1 border-r border-black border-b border-black text-black text-[9px] break-words whitespace-normal align-top">{item.batch}</td>
                                    <td className="p-1 border-b border-black text-black text-[9px] break-words whitespace-normal align-top">{item.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-2 text-[9px] text-black">
                        <p className="mb-1"><span className="font-bold">Ref:</span> {claim.productRef}</p>
                        <p><span className="font-bold">Lote:</span> {claim.batch}</p>
                    </div>
                )}
            </div>
          </div>

          {/* 3. DESCRIPCIÓN */}
          <div className="mb-4 border border-black">
            <div className="bg-orange-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">3. Descripción del Reclamo (Suministrado por el cliente)</div>
            <div className="p-2 italic text-justify leading-relaxed min-h-[3rem] text-black text-[10px]">
                "{claim.description}"
            </div>
          </div>

          {/* 4. PLAN DE ACCIÓN */}
          <div className="mb-4 border border-black flex-1">
            <div className="bg-orange-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">4. Plan de Acción y Solución</div>
            <div className="p-2 space-y-2">
                <div>
                    <strong className="block mb-1 underline uppercase text-[10px] text-black">Acción(es) Inmediata(s) Tomada(s):</strong>
                    {claim.mitigationActions && claim.mitigationActions.length > 0 ? (
                        claim.mitigationActions.map((action, idx) => (
                            <div key={idx} className="mb-2 pl-2">
                                <p className="text-[10px] mb-0.5 text-black font-medium">{idx + 1}. {action.description}</p>
                                {action.executionNotes && (
                                    <div className="text-[9px] text-slate-600 bg-slate-50 p-1 rounded italic">
                                        Nota: {action.executionNotes}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-[10px] mb-1 text-black">{'En proceso de gestión.'}</p>
                    )}
                </div>
            </div>
          </div>

          {/* FOOTER PAGE 1 */}
          <div className="mt-auto pt-2 border-t border-slate-300 text-[9px] text-center text-slate-500">
            <p>Este documento es generado automáticamente por el Portal de Calidad Prolub.</p>
            <p>{new Date().toLocaleDateString()} - Página 1 de 2</p>
          </div>
      </div>

      {/* PAGE 2: EVIDENCES */}
      <div className="w-[210mm] min-h-[297mm] p-8 flex flex-col relative shadow-none break-before-page">
          {/* HEADER PAGE 2 (Simplified) */}
          <div className="border-2 border-black mb-4">
            <div className="flex border-b border-black">
              <div className="flex-1 flex flex-col text-center justify-center">
                  <div className="border-b border-black font-bold p-1 text-sm text-black">PROLUB S.A.</div>
                  <div className="p-1 font-bold text-sm text-black">ANEXOS Y EVIDENCIAS - CASO {claim.id}</div>
              </div>
            </div>
          </div>

          {/* 5. EVIDENCIAS Y DOCUMENTACIÓN */}
          <div className="mb-2 border border-black flex-1">
            <div className="bg-slate-200 font-bold p-1 border-b border-black text-center uppercase text-[10px] text-black">5. Evidencias y Documentación</div>
            
            <div className="p-4">
                <div className="mb-6">
                    <p className="text-[10px] font-bold text-black mb-3 underline">Archivos Adjuntos al Caso:</p>
                    {clientVisibleFiles.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1">
                            {clientVisibleFiles.map((file, idx) => (
                                <li key={idx} className="text-[10px] text-slate-700 break-all">
                                    {file.name}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-[10px] text-slate-400 italic">No se han registrado archivos digitales.</p>
                    )}
                </div>

                <div className="pt-4 border-t border-slate-300">
                    <p className="font-bold text-xs text-black mb-2">Enlace de Acceso a Carpeta Drive:</p>
                    {clientDriveLink ? (
                        <p className="text-xs text-slate-700 break-all select-all">
                            {clientDriveLink}
                        </p>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Enlace no disponible</p>
                    )}
                </div>
            </div>
          </div>

          {/* FOOTER PAGE 2 */}
          <div className="mt-auto pt-2 border-t border-slate-300 text-[9px] text-center text-slate-500">
            <p>Este documento es generado automáticamente por el Portal de Calidad Prolub.</p>
            <p>{new Date().toLocaleDateString()} - Página 2 de 2</p>
          </div>
      </div>

    </div>
  );
};

export const FinalReportTemplate: React.FC<ReportProps> = ({ claim }) => {
  // Internal report shows ALL files
  const mitigationEvidence = claim.mitigationActions?.flatMap(m => m.executionEvidence || []) || [];
  const taskEvidence = claim.tasks?.flatMap(t => t.executionEvidence || []) || [];
  const allFiles = [...(claim.files || []), ...mitigationEvidence, ...taskEvidence];

  return (
    <div className="bg-white text-black font-sans text-xs">
        {/* PAGE 1 */}
        <div className="w-[210mm] min-h-[297mm] p-12 flex flex-col relative">
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
                {claim.mitigationActions && claim.mitigationActions.length > 0 ? (
                    <div className="space-y-2">
                        {claim.mitigationActions.map((action, idx) => (
                            <div key={idx} className="p-2 border border-slate-200 rounded">
                                <p className="font-bold text-sm mb-1">{action.description}</p>
                                <div className="flex justify-between text-[10px] text-slate-500">
                                    <span>Responsable: {action.assignedTo}</span>
                                    <span>Estado: {action.status === 'Approved' ? 'APROBADO' : 'PENDIENTE'}</span>
                                </div>
                                {action.executionNotes && (
                                    <div className="mt-1 p-1 bg-green-50 border-l-2 border-green-500 text-[10px]">
                                        <strong>Ejecución:</strong> {action.executionNotes}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 border border-slate-200 rounded mb-2">
                        <p className="italic text-slate-500">No hay acciones de mitigación inmediata definidas.</p>
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
                        <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 text-[10px]">
                            <th className="p-2 border-r">Área</th>
                            <th className="p-2 border-r">Tarea</th>
                            <th className="p-2 border-r">Resultado</th>
                            <th className="p-2">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {claim.tasks?.map((task, idx) => (
                            <tr key={idx} className="border-b border-slate-200">
                                <td className="p-2 font-bold text-[10px] border-r text-slate-800">{task.assignedTo}</td>
                                <td className="p-2 border-r text-slate-800">{task.description}</td>
                                <td className="p-2 italic text-slate-600 border-r">{task.executionNotes}</td>
                                <td className="p-2 font-bold text-green-600">{task.status === 'Realized' ? 'CERRADO' : 'PENDIENTE'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer Page 1 */}
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

        {/* PAGE 2: EVIDENCE */}
        <div className="w-[210mm] min-h-[297mm] p-12 flex flex-col relative break-before-page">
             <div className="flex justify-between items-center border-b-2 border-indigo-900 pb-4 mb-8">
                <div className="text-right w-full">
                    <h1 className="text-lg font-bold text-indigo-900 uppercase">Anexos y Evidencias</h1>
                    <p className="font-mono text-slate-500">CASO #{claim.id} - Pág 2</p>
                </div>
            </div>

            <div className="mb-8 flex-1">
                <h3 className="font-bold text-white bg-indigo-900 p-2 mb-4 uppercase text-[10px]">5. Evidencia Completa del Caso</h3>
                
                <div className="p-6 border border-slate-200 rounded-xl bg-slate-50">
                    <p className="font-bold text-[10px] text-slate-800 mb-4 underline">Listado de Archivos Digitales:</p>
                    
                    <ul className="grid grid-cols-1 gap-y-2 mb-8">
                        {allFiles.map((f, i) => (
                            <li key={i} className="text-[10px] text-slate-700 flex items-center gap-2 break-all">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0"></span>
                                {f.name}
                            </li>
                        ))}
                    </ul>
                    
                    <div className="pt-6 border-t border-slate-200">
                        <p className="font-bold text-xs text-indigo-900 mb-2">Enlace a Carpeta Maestra (Drive):</p>
                        {claim.driveFolderUrl ? (
                            <p className="text-xs text-slate-700 break-all select-all">
                                {claim.driveFolderUrl}
                            </p>
                        ) : (
                            <p className="text-slate-400 italic text-xs">No disponible</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Page 2 */}
            <div className="mt-auto border-t border-slate-200 pt-4 text-center text-[9px] text-slate-400">
                PROLUB S.A. - Anexo de Evidencias
            </div>
        </div>
    </div>
  );
};
