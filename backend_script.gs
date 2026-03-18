
// Sheet Names
const CLAIMS_SHEET = 'Reclamaciones';
const TASKS_SHEET = 'Tareas';
const MITIGATIONS_SHEET = 'Mitigaciones';
const ISHIKAWA_SHEET = 'Ishikawa';
const CHANGE_REQUESTS_SHEET = 'SolicitudesCambio';
const INTEGRANTES_SHEET = 'INTEGRANTES';

// ==========================================
// SETUP & UTILITIES
// ==========================================

function setupSheets() {
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {
    // Added 'Fase_Mitigacion_Cerrada' at index 21 (Column 22)
    [CLAIMS_SHEET]: ['ID_Reclamacion', 'Fecha_Reporte', 'Estado', 'Cliente', 'Nombre_Reporta', 'Email_Reporta', 'Numero_Factura', 'Marca', 'Productos_Afectados_RAW', 'Lotes_RAW', 'Tipo_Incidente', 'Descripcion', 'Tipo_Correccion', 'URL_Carpeta_Drive', 'Fecha_Cierre_Interno', 'Items_Afectados_JSON', 'Archivos_JSON', 'Estado_Plan_Accion', 'Archivado', 'URL_Carpeta_Cliente', 'Ultima_Actualizacion', 'Fase_Mitigacion_Cerrada'],
    [TASKS_SHEET]: ['ID_Tarea', 'ID_Reclamacion', 'Descripcion', 'Asignado_A', 'Estado', 'Notas_Ejecucion', 'Evidencia_JSON', 'Fecha_Creacion', 'Fecha_Completado'],
    [MITIGATIONS_SHEET]: ['ID_Mitigacion', 'ID_Reclamacion', 'Descripcion', 'Asignado_A', 'Estado', 'Notas_Ejecucion', 'Evidencia_JSON', 'Fecha_Creacion', 'Fecha_Completado', 'Fecha_Aprobado'],
    [ISHIKAWA_SHEET]: ['ID_Ishikawa', 'ID_Reclamacion', 'Categoria', 'Observacion', 'Fecha_Creacion'],
    [CHANGE_REQUESTS_SHEET]: ['ID_Solicitud', 'ID_Reclamacion', 'Tipo_Item', 'ID_Item', 'Texto_Solicitud', 'Estado', 'Fecha_Creacion'],
    [INTEGRANTES_SHEET]: ['Name', 'Email']
  };

  Object.keys(sheets).forEach(name => {
    if (!doc.getSheetByName(name)) {
      const sheet = doc.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.setFrozenRows(1);
    }
  });
}

function getSheetAndData(doc, sheetName) {
  const sheet = doc.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found.`);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return { sheet, data, headers };
}

function findRowIndex(sheet, id, colIndex = 0) {
  const data = sheet.getRange(2, colIndex + 1, sheet.getLastRow(), 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] == id) return i + 2; 
  }
  return -1;
}

function deleteRowsByClaimId(sheet, claimId, colIndex = 1) {
    const data = sheet.getDataRange().getValues();
    const rowsToDelete = [];
    for (let i = data.length - 1; i >= 1; i--) { 
        if (data[i][colIndex] == claimId) {
            rowsToDelete.push(i + 1);
        }
    }
    rowsToDelete.forEach(rowIndex => sheet.deleteRow(rowIndex));
}

function parseJSONSafe(str, fallback = []) {
  if (!str || typeof str !== 'string') return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

function formatDate(date) { 
  if (!date) return ''; 
  if (date instanceof Date) { 
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy"); 
  } 
  return date; 
}

// ==========================================
// HTTP GET REQUEST
// ==========================================

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    setupSheets();

    const { data: claimsData } = getSheetAndData(doc, CLAIMS_SHEET);
    const { data: tasksData } = getSheetAndData(doc, TASKS_SHEET);
    const { data: mitigationsData } = getSheetAndData(doc, MITIGATIONS_SHEET);
    const { data: ishikawaData } = getSheetAndData(doc, ISHIKAWA_SHEET);
    const { data: requestsData } = getSheetAndData(doc, CHANGE_REQUESTS_SHEET);
    const { data: integrantesData } = getSheetAndData(doc, INTEGRANTES_SHEET);
    
    const integrantes = integrantesData.map(row => ({ name: row[0], email: row[1] })).filter(i => i.name && i.email);
    
    const tasksMap = tasksData.reduce((acc, row) => {
      const claimId = row[1];
      if (!acc[claimId]) acc[claimId] = [];
      acc[claimId].push({ id: row[0], description: row[2], assignedTo: row[3], status: row[4], executionNotes: row[5], executionEvidence: parseJSONSafe(row[6]), createdAt: row[7], completedAt: row[8] });
      return acc;
    }, {});

    const mitigationsMap = mitigationsData.reduce((acc, row) => {
      const claimId = row[1];
      if (!acc[claimId]) acc[claimId] = [];
      acc[claimId].push({ id: row[0], description: row[2], assignedTo: row[3], status: row[4], executionNotes: row[5], executionEvidence: parseJSONSafe(row[6]), createdAt: row[7], completedAt: row[8], approvedAt: row[9] });
      return acc;
    }, {});
    
    const ishikawaMap = ishikawaData.reduce((acc, row) => {
      const claimId = row[1];
      if (!acc[claimId]) acc[claimId] = [];
      acc[claimId].push({ id: row[0], category: row[2], observation: row[3], createdAt: row[4] });
      return acc;
    }, {});

    const requestsMap = requestsData.reduce((acc, row) => {
      const claimId = row[1];
      if (!acc[claimId]) acc[claimId] = [];
      // Only include pending requests or needed logic
      acc[claimId].push({ 
          id: row[0], 
          itemType: row[2], 
          itemId: row[3], 
          requestText: row[4], 
          status: row[5], 
          createdAt: row[6] 
      });
      return acc;
    }, {});

    const claims = claimsData.map(row => {
      const id = row[0];
      const allMitigations = mitigationsMap[id] || [];
      const allApproved = allMitigations.length > 0 && allMitigations.every(m => m.status === 'Approved');
      
      return {
        id: id,
        date: formatDate(row[1]),
        status: row[2],
        client: row[3],
        reporterName: row[4],
        reporterEmail: row[5],
        invoiceNumber: row[6],
        brand: row[7],
        productRef: row[8],
        batch: row[9],
        incidentType: row[10],
        description: row[11],
        correctionType: row[12],
        driveFolderUrl: row[13],
        internalCloseDate: formatDate(row[14]),
        affectedItems: parseJSONSafe(row[15]),
        files: parseJSONSafe(row[16]),
        actionPlanStatus: row[17] || 'Pending',
        archived: row[18] === true || row[18] === 'TRUE', 
        driveClientFolderUrl: row[19] || '', 
        lastUpdated: row[20] ? String(row[20]) : '', 
        mitigationPhaseClosed: row[21] === true || row[21] === 'TRUE', // Column V (Index 21)
        tasks: tasksMap[id] || [],
        mitigationActions: allMitigations,
        ishikawaList: ishikawaMap[id] || [],
        changeRequests: requestsMap[id] || [], // Attach requests
        immediateSolutionStatus: allApproved ? 'Approved' : 'Pending',
      };
    });

    return ContentService.createTextOutput(JSON.stringify({ result: 'success', data: claims, integrantes: integrantes })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: e.toString(), stack: e.stack })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// HTTP POST REQUEST
// ==========================================

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
      return ContentService.createTextOutput(JSON.stringify({ 
          result: 'error', 
          message: 'Server is busy. Please try again.' 
      })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    const { action, claimData, rawFiles, id, date, claimId, fileName, base64, reportType, itemData, targetEmail, itemType, pdfBase64, recipientEmails, folderUrl, auditType, requestText, requestId } = data;
    
    setupSheets(); 

    switch(action) {
      case 'create_claim':
        return createClaim(doc, claimData, rawFiles);
      case 'send_notification': 
         return sendNotificationAction(claimData);
      case 'send_assignment_alert':
         return sendAssignmentAlertAction(claimData, itemData, targetEmail, itemType);
      case 'send_audit_alert':
         return sendAuditAlertAction(claimData, auditType);
      case 'send_change_request':
         return sendChangeRequestAction(doc, claimData, itemData, requestText, targetEmail, itemType);
      case 'resolve_change_request':
         return resolveChangeRequestAction(doc, requestId);
      case 'finalize_response': 
         return finalizeResponseAction(doc, claimData, pdfBase64, recipientEmails); // Pass doc
      case 'update_claim':
        return updateClaim(doc, claimData, rawFiles);
      case 'delete_claim':
        return deleteClaim(doc, id);
      case 'delete_task':
        return deleteTask(doc, id);
      case 'delete_mitigation':
        return deleteMitigation(doc, id);
      case 'close_case_definitive':
        return closeCaseDefinitive(doc, id, date);
      case 'archive_claim':
        return archiveClaim(doc, id);
      case 'save_pdf':
        return savePdf(claimId, fileName, base64, reportType, folderUrl);
      default:
        throw new Error("Invalid action specified.");
    }

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: e.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ... (Email Functions) ...
function renderEmailTemplate(data) {
  const { title, titleColor, subTitle, intro, topWidgetHtml, highlightBoxTitle, highlightBoxContent, highlightBoxColor, highlightBoxBorderColor, ctaText, ctaUrl, secondaryLinkUrl, claimData } = data;
  const caseDetailsHtml = `<table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 25px;"><tr><td style="width: 50%; padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px 0 0 8px; vertical-align: top;"><div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">📂 ID Caso / Factura</div><div style="font-size: 14px; color: #0f172a; font-weight: bold;">${claimData.id}</div><div style="font-size: 12px; color: #334155; margin-top: 2px;">${claimData.client}</div><div style="font-size: 11px; color: #64748b; margin-top: 4px;">Factura: ${claimData.invoiceNumber}</div></td><td style="width: 50%; padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: none; border-radius: 0 8px 8px 0; vertical-align: top;"><div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">📦 Producto / Lote</div><div style="font-size: 12px; color: #0f172a; line-height: 1.3;">${claimData.productRef}</div><div style="font-size: 12px; color: #475569; margin-top: 4px;">Lote: ${claimData.batch || 'N/A'}</div></td></tr><tr><td style="height: 8px;"></td></tr><tr><td colspan="2" style="padding: 8px 12px; background-color: #fff; border: 1px dashed #cbd5e1; border-radius: 6px;"><span style="font-size: 11px; color: #64748b;"><strong>Tipo:</strong> ${claimData.incidentType} | <strong>Fecha:</strong> ${claimData.date}</span></td></tr></table>`;
  return `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333; background-color: #ffffff; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);"><div style="text-align: center; margin-bottom: 30px;"><img src="https://drive.google.com/thumbnail?id=18VsOvi3qnV_Wh1xK97WMqpZslWwPvgya&sz=w1000" alt="Prolub Logo" style="height: 45px; margin-bottom: 12px;"><h1 style="color: ${titleColor}; margin: 5px 0 2px 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">${title}</h1><p style="color: #64748b; margin: 0; font-size: 12px; letter-spacing: 1px;">${subTitle}</p></div>${topWidgetHtml ? topWidgetHtml : ''}<p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 25px;">${intro}</p>${caseDetailsHtml}${highlightBoxTitle ? `<div style="margin-bottom: 30px;"><div style="font-size: 11px; font-weight: bold; color: ${highlightBoxBorderColor || '#64748b'}; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">${highlightBoxTitle}</div><div style="background-color: ${highlightBoxColor}; border-left: 4px solid ${highlightBoxBorderColor}; padding: 16px; color: #1e293b; border-radius: 6px; font-size: 14px; line-height: 1.5; font-style: italic;">${highlightBoxContent}</div></div>` : ''}<div style="text-align: center; margin-bottom: 40px; border-top: 1px solid #f1f5f9; paddingTop: 30px;"><a href="${ctaUrl}" style="display: inline-block; background-color: ${titleColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); transition: all 0.2s;">${ctaText}</a></div><div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6;"><strong style="color: #64748b; font-size: 12px;">Prolub S.A.</strong> | Gestión de Calidad & Excelencia Operativa<br>© ${new Date().getFullYear()} Notificación Automática del Sistema</div></div>`;
}

function sendEmailWithStandardCC(recipients, subject, htmlBody) {
    const LAB_EMAIL = "liderlaboratorio@gulfcolombia.com";
    const COM_EMAIL = "acomercial@prolub.com.co";
    
    // Check recipients string or array
    let toListStr = Array.isArray(recipients) ? recipients.join(',') : recipients;
    
    // Build CC List - Explicitly add Lab and Commercial if not in TO
    let ccList = [];
    if (!toListStr.includes(LAB_EMAIL)) ccList.push(LAB_EMAIL);
    if (!toListStr.includes(COM_EMAIL)) ccList.push(COM_EMAIL);

    try {
        MailApp.sendEmail({ 
            to: toListStr, 
            cc: ccList.join(','), 
            subject: subject, 
            htmlBody: htmlBody, 
            name: 'Portal de Calidad Prolub'
        });
    } catch (e) {
        console.error("Failed to send email: " + e.toString());
    }
}

// ... Existing email functions ...
function sendCreationEmail(claimData) {
  const labEmail = "liderlaboratorio@gulfcolombia.com";
  const reporterEmail = claimData.reporterEmail;
  let recipients = labEmail;
  if (reporterEmail && reporterEmail.indexOf("@") > -1) { recipients += "," + reporterEmail; }
  const subject = `[NUEVO CASO] ${claimData.id} - ${claimData.client} - ${claimData.incidentType}`;
  const appLink = "https://portal-reclamacion-prolub-302740316698.us-west1.run.app/";
  const driveLink = claimData.driveFolderUrl || "#";
  const progressBarHtml = `<div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 30px; text-align: center; border: 1px solid #e2e8f0;"><h3 style="margin-top: 0; margin-bottom: 15px; color: #64748b; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">Estado del Proceso</h3><div style="display: flex; justify-content: center; align-items: center; gap: 10px;"><span style="font-size: 20px;">📝</span><span style="font-weight: bold; color: #1e3a8a; font-size: 14px;">Reporte Inicial Registrado</span></div></div>`;
  const htmlBody = renderEmailTemplate({ title: "Nueva Solicitud Registrada", titleColor: "#1e3a8a", subTitle: "Sistema de Gestión de Calidad", topWidgetHtml: progressBarHtml, intro: `Hola <strong>${claimData.reporterName}</strong>,<br>Se ha generado exitosamente la solicitud de reclamación. El equipo de Laboratorio procederá con el análisis inicial.`, highlightBoxTitle: "DESCRIPCIÓN DEL REPORTE", highlightBoxContent: claimData.description, highlightBoxColor: "#f1f5f9", highlightBoxBorderColor: "#4f46e5", ctaText: "INGRESAR AL PORTAL", ctaUrl: appLink, secondaryLinkUrl: driveLink, claimData: claimData });
  sendEmailWithStandardCC(recipients, subject, htmlBody);
}

function sendAssignmentEmail(claimData, itemData, targetEmail, itemType) {
  if (!targetEmail) return;
  const appLink = "https://portal-reclamacion-prolub-302740316698.us-west1.run.app/";
  const driveLink = claimData.driveFolderUrl || "#";
  const isMitigation = itemType === 'MITIGATION';
  const title = isMitigation ? "URGENTE: MITIGACIÓN ASIGNADA" : "NUEVA TAREA ASIGNADA";
  const titleColor = isMitigation ? "#b91c1c" : "#1e3a8a";
  const subject = `[${isMitigation ? 'URGENTE' : 'TAREA'}] ${title} - Caso ${claimData.id} - ${claimData.client}`;
  let daysElapsed = 0;
  if (claimData.date) {
      const parts = claimData.date.split('/');
      if (parts.length === 3) {
          const reportDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          const now = new Date();
          daysElapsed = Math.floor((now - reportDate) / (1000 * 60 * 60 * 24));
      }
  }
  let timerWidget = isMitigation ? `<div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 12px; margin-bottom: 25px; text-align: center;"><div style="font-size: 11px; font-weight: bold; color: #b91c1c; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">Tiempo Transcurrido (SLA 5 Días)</div><div style="font-size: 28px; font-weight: 900; color: #b91c1c;">${daysElapsed} / 5 Días</div><p style="font-size: 11px; color: #991b1b; margin-top: 5px;">Desde la creación del caso el ${claimData.date}</p></div>` : `<div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 12px; margin-bottom: 25px; text-align: center;"><div style="font-size: 12px; font-weight: bold; color: #1e3a8a;">Plan de Acción Interno</div></div>`;
  const htmlBody = renderEmailTemplate({ title: title, titleColor: titleColor, subTitle: "Gestión de Calidad Prolub S.A.", topWidgetHtml: timerWidget, intro: `Hola <strong>Equipo de ${itemData.assignedTo}</strong>,<br>Se les ha asignado una ${isMitigation ? 'acción de mitigación prioritaria' : 'tarea de plan de acción'} para gestionar el siguiente caso.`, highlightBoxTitle: "INSTRUCCIÓN ASIGNADA", highlightBoxContent: itemData.description, highlightBoxColor: isMitigation ? "#fffbeb" : "#f0f9ff", highlightBoxBorderColor: isMitigation ? "#f59e0b" : "#0ea5e9", ctaText: "EJECUTAR ACCIÓN", ctaUrl: appLink, secondaryLinkUrl: driveLink, claimData: claimData });
  sendEmailWithStandardCC(targetEmail, subject, htmlBody);
}

function sendAuditAlertAction(claimData, auditType) {
    const AUDITOR_EMAIL = "jmorales@prolub.com.co";
    const appLink = "https://portal-reclamacion-prolub-302740316698.us-west1.run.app/";
    
    const isMitigation = auditType === 'MITIGATION_READY';
    const title = isMitigation ? "MITIGACIONES EJECUTADAS - PENDIENTE APROBACIÓN" : "PLAN DE ACCIÓN EJECUTADO - PENDIENTE APROBACIÓN";
    const subject = `[AUDITORÍA] ${isMitigation ? 'Mitigaciones' : 'Plan Acción'} Listos - Caso ${claimData.id} - ${claimData.client}`;
    
    // Generate List HTML
    let itemsHtml = '<ul style="padding-left: 20px; color: #334155; font-size: 13px;">';
    const items = isMitigation ? claimData.mitigationActions : claimData.tasks;
    
    if (items && items.length > 0) {
        items.forEach(item => {
            const statusStyle = item.status === 'Approved' ? 'color: green;' : 'color: orange;';
            const execNote = item.executionNotes ? `<br><em style="color:#64748b; font-size: 12px;">Ejecución: ${item.executionNotes}</em>` : '';
            itemsHtml += `<li style="margin-bottom: 10px;"><strong>${item.assignedTo}:</strong> ${item.description} <span style="${statusStyle}">(${item.status})</span>${execNote}</li>`;
        });
    } else {
        itemsHtml += '<li>No se encontraron ítems.</li>';
    }
    itemsHtml += '</ul>';

    const widget = `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 12px; margin-bottom: 25px; text-align: center;"><div style="font-size: 14px; font-weight: bold; color: #166534;">✅ Ejecución Completada</div><p style="font-size: 12px; color: #15803d; margin-top: 5px;">El equipo operativo ha finalizado sus tareas. Se requiere su revisión.</p></div>`;

    const htmlBody = renderEmailTemplate({
        title: title,
        titleColor: "#166534",
        subTitle: "Auditoría de Calidad Prolub S.A.",
        topWidgetHtml: widget,
        intro: `Hola <strong>Auditoría (jmorales)</strong>,<br>El caso ${claimData.id} tiene ítems ejecutados que requieren su validación y aprobación final para avanzar o cerrar el caso.`,
        highlightBoxTitle: "RESUMEN DE ÍTEMS POR APROBAR",
        highlightBoxContent: itemsHtml, // We inject HTML directly here
        highlightBoxColor: "#ffffff",
        highlightBoxBorderColor: "#166534",
        ctaText: "IR A APROBAR EN EL PORTAL",
        ctaUrl: appLink,
        claimData: claimData
    });
    
    sendEmailWithStandardCC(AUDITOR_EMAIL, subject, htmlBody);
    return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'audit_email_sent' })).setMimeType(ContentService.MimeType.JSON);
}

function sendChangeRequestAction(doc, claimData, itemData, requestText, targetEmail, itemType) {
    if (!targetEmail) return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'No target email' })).setMimeType(ContentService.MimeType.JSON);
    
    const appLink = "https://portal-reclamacion-prolub-302740316698.us-west1.run.app/";
    const driveLink = claimData.driveFolderUrl || "#";
    
    // Determine friendly name for Item Type
    let friendlyItemType = "";
    if (itemType === 'MITIGATION') friendlyItemType = "Tarea de Mitigación Inmediata";
    else if (itemType === 'TASK') friendlyItemType = "Tarea de Plan de Acción";
    else if (itemType === 'ISHIKAWA') friendlyItemType = "Análisis Causa Raíz";
    else friendlyItemType = itemType;

    const title = "SOLICITUD DE CAMBIO (AUDITORÍA)";
    const subject = `[CAMBIO REQUERIDO] ${friendlyItemType} - Caso ${claimData.id} - ${claimData.client}`;
    
    // Construct Description based on Type
    let originalDesc = "";
    let assignedArea = "";
    
    if (itemType === 'ISHIKAWA') {
        originalDesc = `${itemData.category}: ${itemData.observation}`;
        assignedArea = "Laboratorio";
    } else {
        originalDesc = itemData.description;
        assignedArea = itemData.assignedTo;
    }

    // --- SAVE TO SHEET START ---
    const sheet = doc.getSheetByName(CHANGE_REQUESTS_SHEET);
    const requestId = Date.now().toString();
    const createdAt = new Date().toISOString();
    // ['ID_Solicitud', 'ID_Reclamacion', 'Tipo_Item', 'ID_Item', 'Texto_Solicitud', 'Estado', 'Fecha_Creacion']
    sheet.appendRow([requestId, claimData.id, friendlyItemType, itemData.id, requestText, 'Pending', createdAt]);
    // --- SAVE TO SHEET END ---

    const widget = `<div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 15px; border-radius: 12px; margin-bottom: 25px; text-align: center;"><div style="font-size: 14px; font-weight: bold; color: #c2410c;">⚠️ Corrección Solicitada</div><p style="font-size: 12px; color: #9a3412; margin-top: 5px;">Auditoría ha revisado el caso y requiere ajustes en un ítem.</p></div>`;

    const contentHtml = `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 5px;">Tipo de Ítem:</div>
            <div style="font-size: 13px; color: #0f172a; margin-bottom: 10px;">${friendlyItemType}</div>
            
            <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 5px;">Ítem Original:</div>
            <div style="background-color: #f1f5f9; padding: 10px; border-radius: 6px; font-style: italic; color: #334155; font-size: 13px;">"${originalDesc}"</div>
        </div>
        <div style="margin-bottom: 10px;">
            <div style="font-size: 11px; font-weight: bold; color: #c2410c; text-transform: uppercase; margin-bottom: 5px;">Solicitud de Cambio:</div>
            <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 15px; color: #c2410c; border-radius: 6px; font-size: 14px; font-weight: bold;">${requestText}</div>
        </div>
    `;

    const htmlBody = renderEmailTemplate({
        title: title,
        titleColor: "#c2410c",
        subTitle: "Auditoría de Calidad Prolub S.A.",
        topWidgetHtml: widget,
        intro: `Hola <strong>${assignedArea}</strong>,<br>Se requiere que realice modificaciones o correcciones en el siguiente ítem del caso ${claimData.id}.`,
        highlightBoxTitle: "DETALLE DE LA SOLICITUD",
        highlightBoxContent: contentHtml, // Injected directly as HTML string
        highlightBoxColor: "#ffffff",
        highlightBoxBorderColor: "#fff", // Handled inside contentHtml
        ctaText: "GESTIONAR CAMBIO",
        ctaUrl: appLink,
        secondaryLinkUrl: driveLink,
        claimData: claimData
    });

    sendEmailWithStandardCC(targetEmail, subject, htmlBody);
    return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'change_request_sent' })).setMimeType(ContentService.MimeType.JSON);
}

function resolveChangeRequestAction(doc, requestId) {
    const sheet = doc.getSheetByName(CHANGE_REQUESTS_SHEET);
    const rowIndex = findRowIndex(sheet, requestId, 0);
    
    if (rowIndex !== -1) {
        // Update Status (Column 6 / Index 5) to 'Resolved'
        sheet.getRange(rowIndex, 6).setValue('Resolved');
        return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'resolved' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'Request ID not found' })).setMimeType(ContentService.MimeType.JSON);
}

function sendCompletionEmail(claimData, recipients, pdfUrl) {
  const subject = `[RESPUESTA FINALIZADA] Caso ${claimData.id} - ${claimData.client}`;
  const driveClientLink = claimData.driveClientFolderUrl || claimData.driveFolderUrl || "#";
  const successWidget = `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 12px; margin-bottom: 25px; text-align: center;"><div style="font-size: 16px; font-weight: bold; color: #166534;">✅ Acciones de Mitigación Aprobadas</div><p style="font-size: 12px; color: #15803d; margin-top: 5px;">El informe preliminar para el cliente ha sido generado.</p></div>`;
  const htmlBody = renderEmailTemplate({ title: "Fase de Respuesta Finalizada", titleColor: "#166534", subTitle: "Auditoría de Calidad Prolub S.A.", topWidgetHtml: successWidget, intro: `Hola <strong>Equipo</strong>,<br>Se informa que todas las acciones de mitigación para el caso han sido ejecutadas y aprobadas satisfactoriamente.`, highlightBoxTitle: "RESUMEN DEL PROBLEMA", highlightBoxContent: claimData.description, highlightBoxColor: "#f0fdf4", highlightBoxBorderColor: "#22c55e", ctaText: "DESCARGAR INFORME CLIENTE", ctaUrl: pdfUrl, secondaryLinkUrl: driveClientLink, claimData: claimData });
  const recipientString = Array.isArray(recipients) ? recipients.join(',') : recipients;
  sendEmailWithStandardCC(recipientString, subject, htmlBody);
}

// ... (Rest of functions) ...

function finalizeResponseAction(doc, claimData, pdfBase64, recipientEmails) {
    const fileName = `Reporte_Respuesta_${claimData.id}.pdf`;
    const savedPdfUrl = internalSavePdf(claimData.id, fileName, pdfBase64, 'CLIENT', claimData.driveFolderUrl);
    
    // UPDATE SHEET TO MARK MITIGATION CLOSED
    const claimsSheet = doc.getSheetByName(CLAIMS_SHEET);
    const rowIndex = findRowIndex(claimsSheet, claimData.id);
    if (rowIndex !== -1) {
        claimsSheet.getRange(rowIndex, 22).setValue(true); // Column 22 is Fase_Mitigacion_Cerrada
    }

    sendCompletionEmail(claimData, recipientEmails, savedPdfUrl);
    return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'response_finalized' })).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// IMPROVED DRIVE SAVING LOGIC
// ==========================================

function internalSavePdf(claimId, fileName, base64, reportType, folderUrl) {
    let targetFolder;

    // 1. Try to get folder by URL if provided (Most Robust)
    if (folderUrl) {
        try {
            const folderId = folderUrl.split('/').pop();
            targetFolder = DriveApp.getFolderById(folderId);
        } catch (e) {
            console.warn("Could not find folder by URL, falling back to search.", e);
        }
    }

    // 2. Fallback: Search by Name Pattern
    if (!targetFolder) {
        const rootFolder = DriveApp.getFolderById("1PJBsgGwyR1BLG8X6wutmwvXs0ItYoLl2"); 
        const folders = rootFolder.getFoldersByName(`${claimId}*`); 
        if (folders.hasNext()) {
            targetFolder = folders.next();
        } else {
            throw new Error(`Drive folder for claim ${claimId} not found.`);
        }
    }
    
    // 3. Define Subfolders (Get or Create)
    const internalFolder = getOrCreateSubfolder(targetFolder, "GESTION_INTERNA");
    
    // For Client Reports: We need ACCESO_CLIENTE. For Final Reports: Just Internal.
    let clientFolder = null;
    if (reportType === 'CLIENT') {
        clientFolder = getOrCreateSubfolder(targetFolder, "ACCESO_CLIENTE");
        clientFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    // 4. Create the File (Always in Internal first)
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', fileName);
    const internalFile = internalFolder.createFile(blob);
    
    // 5. If Client Report, COPY to Client Folder (so it exists in both)
    if (reportType === 'CLIENT' && clientFolder) {
        const clientFile = internalFile.makeCopy(fileName, clientFolder);
        // Return the Client URL for public access/email
        return clientFile.getUrl();
    }

    // Return Internal URL for Final Reports
    return internalFile.getUrl();
}

function getOrCreateSubfolder(parentFolder, name) {
    const folders = parentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
        return folders.next();
    } else {
        return parentFolder.createFolder(name);
    }
}

function savePdf(claimId, fileName, base64, reportType, folderUrl) {
    const url = internalSavePdf(claimId, fileName, base64, reportType, folderUrl);
    return ContentService.createTextOutput(JSON.stringify({ result: 'success', url: url })).setMimeType(ContentService.MimeType.JSON);
}

function createClaim(doc, claimData, rawFiles) {
  const claimsSheet = doc.getSheetByName(CLAIMS_SHEET);
  const tasksSheet = doc.getSheetByName(TASKS_SHEET);
  const mitigationsSheet = doc.getSheetByName(MITIGATIONS_SHEET);
  const ishikawaSheet = doc.getSheetByName(ISHIKAWA_SHEET);
  const { driveFolderUrl, driveClientFolderUrl, uploadedFileInfos } = handleFileUploads(claimData.id, claimData.client, rawFiles, null, true);
  const timestamp = Date.now().toString();
  // Added false for mitigationPhaseClosed at index 21 (Column 22)
  claimsSheet.appendRow([claimData.id, claimData.date, claimData.status, claimData.client, claimData.reporterName, claimData.reporterEmail, claimData.invoiceNumber, claimData.brand, claimData.productRef, claimData.batch, claimData.incidentType, claimData.description, claimData.correctionType, driveFolderUrl, '', JSON.stringify(claimData.affectedItems || []), JSON.stringify(uploadedFileInfos), claimData.actionPlanStatus || 'Pending', false, driveClientFolderUrl, timestamp, false]);
  (claimData.tasks || []).forEach(t => tasksSheet.appendRow([t.id, claimData.id, t.description, t.assignedTo, t.status, '', '[]', t.createdAt, '']));
  (claimData.mitigationActions || []).forEach(m => mitigationsSheet.appendRow([m.id, claimData.id, m.description, m.assignedTo, m.status, '', '[]', m.createdAt, '', '']));
  (claimData.ishikawaList || []).forEach(i => ishikawaSheet.appendRow([i.id, claimData.id, i.category, i.observation, i.createdAt]));
  return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'created', driveFolderUrl: driveFolderUrl, driveClientFolderUrl: driveClientFolderUrl })).setMimeType(ContentService.MimeType.JSON);
}

function sendNotificationAction(claimData) { sendCreationEmail(claimData); return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'email_sent' })).setMimeType(ContentService.MimeType.JSON); }
function sendAssignmentAlertAction(claimData, itemData, targetEmail, itemType) { sendAssignmentEmail(claimData, itemData, targetEmail, itemType); return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'alert_sent' })).setMimeType(ContentService.MimeType.JSON); }

function updateClaim(doc, claimData, rawFiles) {
  const claimsSheet = doc.getSheetByName(CLAIMS_SHEET);
  const tasksSheet = doc.getSheetByName(TASKS_SHEET);
  const mitigationsSheet = doc.getSheetByName(MITIGATIONS_SHEET);
  const ishikawaSheet = doc.getSheetByName(ISHIKAWA_SHEET);
  const claimId = claimData.id;
  const rowIndex = findRowIndex(claimsSheet, claimId);
  if (rowIndex === -1) throw new Error(`Claim ID ${claimId} not found for update.`);
  const currentTimestamp = String(claimsSheet.getRange(rowIndex, 21).getValue());
  const clientTimestamp = claimData.lastUpdated ? String(claimData.lastUpdated) : '';
  if (currentTimestamp && clientTimestamp && currentTimestamp !== clientTimestamp) { return ContentService.createTextOutput(JSON.stringify({ result: 'error', code: 'STALE_DATA', message: 'Los datos han cambiado desde que los abrió.' })).setMimeType(ContentService.MimeType.JSON); }
  const existingFolderUrl = claimsSheet.getRange(rowIndex, 14).getValue();
  const existingClientUrl = claimsSheet.getRange(rowIndex, 20).getValue(); 
  const existingMitigationClosed = claimsSheet.getRange(rowIndex, 22).getValue(); // Read existing value (Index 22 is Column V)
  
  const { driveFolderUrl, driveClientFolderUrl, uploadedFileInfos } = handleFileUploads(claimId, claimData.client, rawFiles, existingFolderUrl, false);
  const existingFiles = parseJSONSafe(claimsSheet.getRange(rowIndex, 17).getValue());
  const allFiles = [...existingFiles, ...uploadedFileInfos];
  const currentArchived = claimsSheet.getRange(rowIndex, 19).getValue();
  const newArchived = claimData.archived !== undefined ? claimData.archived : currentArchived;
  const finalClientUrl = existingClientUrl || driveClientFolderUrl;
  const newTimestamp = Date.now().toString();
  
  // Write 22 columns (Index 1 to 22) - Ensure existingMitigationClosed is preserved
  claimsSheet.getRange(rowIndex, 1, 1, 22).setValues([[claimId, claimData.date, claimData.status, claimData.client, claimData.reporterName, claimData.reporterEmail, claimData.invoiceNumber, claimData.brand, claimData.productRef, claimData.batch, claimData.incidentType, claimData.description, claimData.correctionType, existingFolderUrl, claimData.internalCloseDate || '', JSON.stringify(claimData.affectedItems || []), JSON.stringify(allFiles), claimData.actionPlanStatus || 'Pending', newArchived, finalClientUrl, newTimestamp, existingMitigationClosed]]);
  
  deleteRowsByClaimId(tasksSheet, claimId);
  (claimData.tasks || []).forEach(t => { const evidence = getEvidenceFor(t.id, allFiles); tasksSheet.appendRow([t.id, claimId, t.description, t.assignedTo, t.status, t.executionNotes || '', JSON.stringify(evidence), t.createdAt, t.completedAt || '']); });
  deleteRowsByClaimId(mitigationsSheet, claimId);
  (claimData.mitigationActions || []).forEach(m => { const evidence = getEvidenceFor(m.id, allFiles); mitigationsSheet.appendRow([m.id, claimId, m.description, m.assignedTo, m.status, m.executionNotes || '', JSON.stringify(evidence), m.createdAt, m.completedAt || '', m.approvedAt || '']); });
  deleteRowsByClaimId(ishikawaSheet, claimId);
  (claimData.ishikawaList || []).forEach(i => ishikawaSheet.appendRow([i.id, claimId, i.category, i.observation, i.createdAt]));
  return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'updated' })).setMimeType(ContentService.MimeType.JSON);
}

function deleteClaim(doc, claimId) {
  const claimsSheet = doc.getSheetByName(CLAIMS_SHEET);
  const rowIndex = findRowIndex(claimsSheet, claimId);
  if (rowIndex !== -1) {
    claimsSheet.deleteRow(rowIndex);
    deleteRowsByClaimId(doc.getSheetByName(TASKS_SHEET), claimId);
    deleteRowsByClaimId(doc.getSheetByName(MITIGATIONS_SHEET), claimId);
    deleteRowsByClaimId(doc.getSheetByName(ISHIKAWA_SHEET), claimId);
  }
  return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'deleted' })).setMimeType(ContentService.MimeType.JSON);
}

function archiveClaim(doc, claimId) { const claimsSheet = doc.getSheetByName(CLAIMS_SHEET); const rowIndex = findRowIndex(claimsSheet, claimId); if (rowIndex > -1) { claimsSheet.getRange(rowIndex, 19).setValue(true); return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON); } throw new Error("ID not found for archiving."); }
function deleteTask(doc, taskId) { const tasksSheet = doc.getSheetByName(TASKS_SHEET); const rowIndex = findRowIndex(tasksSheet, taskId, 0); if (rowIndex !== -1) { tasksSheet.deleteRow(rowIndex); return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'task_deleted' })).setMimeType(ContentService.MimeType.JSON); } throw new Error(`Task ID ${taskId} not found for deletion.`); }
function deleteMitigation(doc, mitigationId) { const mitigationsSheet = doc.getSheetByName(MITIGATIONS_SHEET); const rowIndex = findRowIndex(mitigationsSheet, mitigationId, 0); if (rowIndex !== -1) { mitigationsSheet.deleteRow(rowIndex); return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'mitigation_deleted' })).setMimeType(ContentService.MimeType.JSON); } throw new Error(`Mitigation ID ${mitigationId} not found for deletion.`); }
function closeCaseDefinitive(doc, id, date) { const claimsSheet = doc.getSheetByName(CLAIMS_SHEET); const rowIndex = findRowIndex(claimsSheet, id); if (rowIndex > -1) { const closeDate = date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy"); claimsSheet.getRange(rowIndex, 3).setValue('Cerrado'); claimsSheet.getRange(rowIndex, 15).setValue(closeDate); return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON); } throw new Error("ID not found for closure."); }

function handleFileUploads(claimId, clientName, rawFiles, existingFolderUrl = null, isInitialCreation = false) {
  const uploadedFileInfos = [];
  let driveFolderUrl = existingFolderUrl;
  let driveClientFolderUrl = '';
  
  if (rawFiles && rawFiles.length > 0) {
    const rootFolder = DriveApp.getFolderById("1PJBsgGwyR1BLG8X6wutmwvXs0ItYoLl2");
    let targetFolder;
    if (driveFolderUrl) {
      targetFolder = DriveApp.getFolderById(driveFolderUrl.split('/').pop());
    } else {
      targetFolder = rootFolder.createFolder(`${claimId} - ${clientName || "Caso"}`);
      driveFolderUrl = targetFolder.getUrl();
    }
    const clientFolder = getOrCreateSubfolder(targetFolder, "ACCESO_CLIENTE");
    clientFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    driveClientFolderUrl = clientFolder.getUrl();
    const internalFolder = getOrCreateSubfolder(targetFolder, "GESTION_INTERNA");

    rawFiles.forEach(raw => {
      const blob = Utilities.newBlob(Utilities.base64Decode(raw.base64), raw.type, raw.name);
      const fileInInternal = internalFolder.createFile(blob);
      uploadedFileInfos.push({ name: raw.name, url: fileInInternal.getUrl(), type: raw.type, size: raw.size });
      const isMitigation = raw.name.toUpperCase().includes("MITIGACION");
      if (isInitialCreation || isMitigation) { fileInInternal.makeCopy(raw.name, clientFolder); }
    });
  } else {
      if (existingFolderUrl) {
          const targetFolder = DriveApp.getFolderById(existingFolderUrl.split('/').pop());
          const clientFolders = targetFolder.getFoldersByName("ACCESO_CLIENTE");
          if (clientFolders.hasNext()) { driveClientFolderUrl = clientFolders.next().getUrl(); }
      }
  }
  return { driveFolderUrl, driveClientFolderUrl, uploadedFileInfos };
}

function getEvidenceFor(itemId, allFiles) { return allFiles.filter(f => f.name.includes(itemId)); }
