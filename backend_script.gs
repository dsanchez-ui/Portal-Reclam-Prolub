
// Sheet Names
const CLAIMS_SHEET = 'Reclamaciones';
const TASKS_SHEET = 'Tareas';
const MITIGATIONS_SHEET = 'Mitigaciones';
const ISHIKAWA_SHEET = 'Ishikawa';

// ==========================================
// SETUP & UTILITIES
// ==========================================

function setupSheets() {
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  // Added 'Ultima_Actualizacion' at index 20 (Col 21) for concurrency control
  const sheets = {
    [CLAIMS_SHEET]: ['ID_Reclamacion', 'Fecha_Reporte', 'Estado', 'Cliente', 'Nombre_Reporta', 'Email_Reporta', 'Numero_Factura', 'Marca', 'Productos_Afectados_RAW', 'Lotes_RAW', 'Tipo_Incidente', 'Descripcion', 'Tipo_Correccion', 'URL_Carpeta_Drive', 'Fecha_Cierre_Interno', 'Items_Afectados_JSON', 'Archivos_JSON', 'Estado_Plan_Accion', 'Archivado', 'URL_Carpeta_Cliente', 'Ultima_Actualizacion'],
    [TASKS_SHEET]: ['ID_Tarea', 'ID_Reclamacion', 'Descripcion', 'Asignado_A', 'Estado', 'Notas_Ejecucion', 'Evidencia_JSON', 'Fecha_Creacion', 'Fecha_Completado'],
    [MITIGATIONS_SHEET]: ['ID_Mitigacion', 'ID_Reclamacion', 'Descripcion', 'Asignado_A', 'Estado', 'Notas_Ejecucion', 'Evidencia_JSON', 'Fecha_Creacion', 'Fecha_Completado', 'Fecha_Aprobado'],
    [ISHIKAWA_SHEET]: ['ID_Ishikawa', 'ID_Reclamacion', 'Categoria', 'Observacion', 'Fecha_Creacion']
  };

  Object.keys(sheets).forEach(name => {
    if (!doc.getSheetByName(name)) {
      const sheet = doc.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.setFrozenRows(1);
    } else {
       // Auto-migration: Check if new columns exist
       const sheet = doc.getSheetByName(name);
       const lastCol = sheet.getLastColumn();
       const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
       if (name === CLAIMS_SHEET) {
           if (headers.length < 18) sheet.getRange(1, 18).setValue('Estado_Plan_Accion');
           if (headers.length < 19) sheet.getRange(1, 19).setValue('Archivado');
           if (headers.length < 20) sheet.getRange(1, 20).setValue('URL_Carpeta_Cliente');
           if (headers.length < 21) sheet.getRange(1, 21).setValue('Ultima_Actualizacion');
       }
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
    if (data[i][0] == id) return i + 2; // +2 because of 1-based index and header row
  }
  return -1;
}

function deleteRowsByClaimId(sheet, claimId, colIndex = 1) {
    const data = sheet.getDataRange().getValues();
    const rowsToDelete = [];
    for (let i = data.length - 1; i >= 1; i--) { // Iterate backwards
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
// HTTP GET REQUEST (Read All Data)
// ==========================================

function doGet(e) {
  const lock = LockService.getScriptLock();
  // Wait up to 30 seconds for other processes to finish.
  lock.tryLock(30000);

  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    setupSheets();

    // 1. Read all data from sheets
    const { data: claimsData } = getSheetAndData(doc, CLAIMS_SHEET);
    const { data: tasksData } = getSheetAndData(doc, TASKS_SHEET);
    const { data: mitigationsData } = getSheetAndData(doc, MITIGATIONS_SHEET);
    const { data: ishikawaData } = getSheetAndData(doc, ISHIKAWA_SHEET);
    
    // 2. Create maps for efficient lookup
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

    // 3. Assemble the final claims array
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
        lastUpdated: row[20] ? String(row[20]) : '', // Concurrency Token

        tasks: tasksMap[id] || [],
        mitigationActions: allMitigations,
        ishikawaList: ishikawaMap[id] || [],
        
        immediateSolutionStatus: allApproved ? 'Approved' : 'Pending',
      };
    });

    return ContentService.createTextOutput(JSON.stringify({ result: 'success', data: claims })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: e.toString(), stack: e.stack })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// HTTP POST REQUEST (Create, Update, Delete)
// ==========================================

function doPost(e) {
  const lock = LockService.getScriptLock();
  // Wait up to 30 seconds for lock.
  // This prevents multiple users from writing at the EXACT same millisecond.
  if (!lock.tryLock(30000)) {
      return ContentService.createTextOutput(JSON.stringify({ 
          result: 'error', 
          message: 'Server is busy (Locked). Please try again in a moment.' 
      })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    const { action, claimData, rawFiles, id, date, claimId, fileName, base64, reportType } = data;
    
    setupSheets(); 

    switch(action) {
      case 'create_claim':
        return createClaim(doc, claimData, rawFiles);
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
        return savePdf(claimId, fileName, base64, reportType);
      default:
        throw new Error("Invalid action specified.");
    }

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: e.toString(), stack: e.stack })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// ACTION HANDLERS
// ==========================================

function createClaim(doc, claimData, rawFiles) {
  const claimsSheet = doc.getSheetByName(CLAIMS_SHEET);
  const tasksSheet = doc.getSheetByName(TASKS_SHEET);
  const mitigationsSheet = doc.getSheetByName(MITIGATIONS_SHEET);
  const ishikawaSheet = doc.getSheetByName(ISHIKAWA_SHEET);

  const { driveFolderUrl, driveClientFolderUrl, uploadedFileInfos } = handleFileUploads(claimData.id, claimData.client, rawFiles, null, true);
  
  // Create timestamp
  const timestamp = Date.now().toString();

  claimsSheet.appendRow([
    claimData.id, claimData.date, claimData.status, claimData.client, claimData.reporterName, claimData.reporterEmail, 
    claimData.invoiceNumber, claimData.brand, claimData.productRef, claimData.batch, claimData.incidentType, 
    claimData.description, claimData.correctionType, driveFolderUrl, '', JSON.stringify(claimData.affectedItems || []), 
    JSON.stringify(uploadedFileInfos), claimData.actionPlanStatus || 'Pending', false, driveClientFolderUrl, timestamp
  ]);
  
  (claimData.tasks || []).forEach(t => tasksSheet.appendRow([t.id, claimData.id, t.description, t.assignedTo, t.status, '', '[]', t.createdAt, '']));
  (claimData.mitigationActions || []).forEach(m => mitigationsSheet.appendRow([m.id, claimData.id, m.description, m.assignedTo, m.status, '', '[]', m.createdAt, '', '']));
  (claimData.ishikawaList || []).forEach(i => ishikawaSheet.appendRow([i.id, claimData.id, i.category, i.observation, i.createdAt]));

  // --- SEND EMAIL NOTIFICATION ---
  // This is synchronous, so it will happen before the return, ensuring the user sees the loading screen until email is sent.
  sendCreationEmail(claimData);
  // -------------------------------

  return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'created' })).setMimeType(ContentService.MimeType.JSON);
}

function updateClaim(doc, claimData, rawFiles) {
  const claimsSheet = doc.getSheetByName(CLAIMS_SHEET);
  const tasksSheet = doc.getSheetByName(TASKS_SHEET);
  const mitigationsSheet = doc.getSheetByName(MITIGATIONS_SHEET);
  const ishikawaSheet = doc.getSheetByName(ISHIKAWA_SHEET);
  
  const claimId = claimData.id;
  const rowIndex = findRowIndex(claimsSheet, claimId);
  if (rowIndex === -1) throw new Error(`Claim ID ${claimId} not found for update.`);

  // --- OPTIMISTIC LOCKING CHECK ---
  const currentTimestamp = String(claimsSheet.getRange(rowIndex, 21).getValue());
  const clientTimestamp = claimData.lastUpdated ? String(claimData.lastUpdated) : '';
  
  // If the sheet has a timestamp and the client sent one, and they don't match...
  if (currentTimestamp && clientTimestamp && currentTimestamp !== clientTimestamp) {
      return ContentService.createTextOutput(JSON.stringify({ 
          result: 'error', 
          code: 'STALE_DATA',
          message: 'Los datos han cambiado desde que los abrió. Por favor actualice la página para ver los cambios recientes.' 
      })).setMimeType(ContentService.MimeType.JSON);
  }
  // --------------------------------

  const existingFolderUrl = claimsSheet.getRange(rowIndex, 14).getValue();
  const existingClientUrl = claimsSheet.getRange(rowIndex, 20).getValue(); 

  const { driveFolderUrl, driveClientFolderUrl, uploadedFileInfos } = handleFileUploads(claimId, claimData.client, rawFiles, existingFolderUrl, false);

  const existingFiles = parseJSONSafe(claimsSheet.getRange(rowIndex, 17).getValue());
  const allFiles = [...existingFiles, ...uploadedFileInfos];

  const currentArchived = claimsSheet.getRange(rowIndex, 19).getValue();
  const newArchived = claimData.archived !== undefined ? claimData.archived : currentArchived;
  const finalClientUrl = existingClientUrl || driveClientFolderUrl;
  
  // New Timestamp for this update
  const newTimestamp = Date.now().toString();

  // Update Main Claim Row (21 cols)
  claimsSheet.getRange(rowIndex, 1, 1, 21).setValues([[
    claimId, claimData.date, claimData.status, claimData.client, claimData.reporterName, claimData.reporterEmail, 
    claimData.invoiceNumber, claimData.brand, claimData.productRef, claimData.batch, claimData.incidentType, 
    claimData.description, claimData.correctionType, existingFolderUrl, claimData.internalCloseDate || '', 
    JSON.stringify(claimData.affectedItems || []), JSON.stringify(allFiles), claimData.actionPlanStatus || 'Pending', newArchived, finalClientUrl, newTimestamp
  ]]);

  deleteRowsByClaimId(tasksSheet, claimId);
  (claimData.tasks || []).forEach(t => {
      const evidence = getEvidenceFor(t.id, allFiles);
      tasksSheet.appendRow([t.id, claimId, t.description, t.assignedTo, t.status, t.executionNotes || '', JSON.stringify(evidence), t.createdAt, t.completedAt || '']);
  });
  
  deleteRowsByClaimId(mitigationsSheet, claimId);
  (claimData.mitigationActions || []).forEach(m => {
      const evidence = getEvidenceFor(m.id, allFiles);
      mitigationsSheet.appendRow([m.id, claimId, m.description, m.assignedTo, m.status, m.executionNotes || '', JSON.stringify(evidence), m.createdAt, m.completedAt || '', m.approvedAt || '']);
  });

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

function archiveClaim(doc, claimId) {
    const claimsSheet = doc.getSheetByName(CLAIMS_SHEET);
    const rowIndex = findRowIndex(claimsSheet, claimId);
    if (rowIndex > -1) {
      claimsSheet.getRange(rowIndex, 19).setValue(true); // Set Archived to TRUE
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error("ID not found for archiving.");
}

function deleteTask(doc, taskId) {
    const tasksSheet = doc.getSheetByName(TASKS_SHEET);
    const rowIndex = findRowIndex(tasksSheet, taskId, 0); 
    if (rowIndex !== -1) {
        tasksSheet.deleteRow(rowIndex);
        return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'task_deleted' })).setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error(`Task ID ${taskId} not found for deletion.`);
}

function deleteMitigation(doc, mitigationId) {
    const mitigationsSheet = doc.getSheetByName(MITIGATIONS_SHEET);
    const rowIndex = findRowIndex(mitigationsSheet, mitigationId, 0);
    if (rowIndex !== -1) {
        mitigationsSheet.deleteRow(rowIndex);
        return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'mitigation_deleted' })).setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error(`Mitigation ID ${mitigationId} not found for deletion.`);
}

function closeCaseDefinitive(doc, id, date) {
    const claimsSheet = doc.getSheetByName(CLAIMS_SHEET);
    const rowIndex = findRowIndex(claimsSheet, id);
    if (rowIndex > -1) {
      const closeDate = date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
      claimsSheet.getRange(rowIndex, 3).setValue('Cerrado'); 
      claimsSheet.getRange(rowIndex, 15).setValue(closeDate);
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error("ID not found for closure.");
}

function savePdf(claimId, fileName, base64, reportType) {
    const rootFolder = DriveApp.getFolderById("1PJBsgGwyR1BLG8X6wutmwvXs0ItYoLl2"); 
    const folders = rootFolder.getFoldersByName(`${claimId}*`); 
    let targetFolder;

    if (folders.hasNext()) {
        targetFolder = folders.next();
    } else {
        throw new Error(`Drive folder for claim ${claimId} not found.`);
    }
    
    // Determine Destination Folder based on reportType
    // CLIENT -> ACCESO_CLIENTE
    // FINAL / Default -> GESTION_INTERNA
    let subfolderName = "GESTION_INTERNA";
    if (reportType === 'CLIENT') {
        subfolderName = "ACCESO_CLIENTE";
    }

    const subfolders = targetFolder.getFoldersByName(subfolderName);
    if (subfolders.hasNext()) {
        targetFolder = subfolders.next();
    } else {
        // Fallback or create if missing (should exist by flow)
        targetFolder = targetFolder.createFolder(subfolderName);
        if (reportType === 'CLIENT') {
             targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        }
    }

    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', fileName);
    const file = targetFolder.createFile(blob);
    return ContentService.createTextOutput(JSON.stringify({ result: 'success', url: file.getUrl() })).setMimeType(ContentService.MimeType.JSON);
}

function handleFileUploads(claimId, clientName, rawFiles, existingFolderUrl = null, isInitialCreation = false) {
  const uploadedFileInfos = [];
  let driveFolderUrl = existingFolderUrl;
  let driveClientFolderUrl = '';
  
  if (rawFiles && rawFiles.length > 0) {
    const rootFolder = DriveApp.getFolderById("1PJBsgGwyR1BLG8X6wutmwvXs0ItYoLl2");
    let targetFolder;

    // 1. Resolve Root Case Folder
    if (driveFolderUrl) {
      targetFolder = DriveApp.getFolderById(driveFolderUrl.split('/').pop());
    } else {
      targetFolder = rootFolder.createFolder(`${claimId} - ${clientName || "Caso"}`);
      // Admin access to root
      driveFolderUrl = targetFolder.getUrl();
    }

    // 2. Resolve Subfolders (Client & Internal)
    let clientFolder, internalFolder;
    
    const clientFolders = targetFolder.getFoldersByName("ACCESO_CLIENTE");
    if (clientFolders.hasNext()) {
        clientFolder = clientFolders.next();
    } else {
        clientFolder = targetFolder.createFolder("ACCESO_CLIENTE");
        clientFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    driveClientFolderUrl = clientFolder.getUrl();

    const internalFolders = targetFolder.getFoldersByName("GESTION_INTERNA");
    if (internalFolders.hasNext()) {
        internalFolder = internalFolders.next();
    } else {
        internalFolder = targetFolder.createFolder("GESTION_INTERNA");
    }

    // 3. Process Files
    rawFiles.forEach(raw => {
      const blob = Utilities.newBlob(Utilities.base64Decode(raw.base64), raw.type, raw.name);
      
      // Determine destination
      // Rule 1: All files go to GESTION_INTERNA
      // Rule 2: Files go to ACCESO_CLIENTE IF: 
      //         a) It is initial creation
      //         b) Filename contains "MITIGACION" (Immediate Action evidence)
      
      const fileInInternal = internalFolder.createFile(blob);
      uploadedFileInfos.push({ name: raw.name, url: fileInInternal.getUrl(), type: raw.type, size: raw.size });

      const isMitigation = raw.name.toUpperCase().includes("MITIGACION");
      
      if (isInitialCreation || isMitigation) {
          // Copy to client folder
          fileInInternal.makeCopy(raw.name, clientFolder);
      }
    });
  } else {
      // Logic to retrieve existing Client URL if no files uploaded but folder exists
      if (existingFolderUrl) {
          const targetFolder = DriveApp.getFolderById(existingFolderUrl.split('/').pop());
          const clientFolders = targetFolder.getFoldersByName("ACCESO_CLIENTE");
          if (clientFolders.hasNext()) {
              driveClientFolderUrl = clientFolders.next().getUrl();
          }
      }
  }
  
  return { driveFolderUrl, driveClientFolderUrl, uploadedFileInfos };
}

function getEvidenceFor(itemId, allFiles) {
  return allFiles.filter(f => f.name.includes(itemId));
}

function sendCreationEmail(claimData) {
  const labEmail = "liderlaboratorio@gulfcolombia.com";
  const reporterEmail = claimData.reporterEmail;
  
  let recipients = labEmail;
  if (reporterEmail && reporterEmail.indexOf("@") > -1) {
    recipients += "," + reporterEmail;
  }

  const subject = `[Confirmación] Reclamación Recibida - Caso ${claimData.id}`;
  
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; color: #333;">
      <h2 style="color: #2e3b55; border-bottom: 2px solid #2e3b55; padding-bottom: 10px;">Confirmación de Nuevo Caso</h2>
      <p>Hola <strong>${claimData.reporterName}</strong>,</p>
      <p>Se ha registrado exitosamente su reporte en el sistema de gestión de calidad. El equipo de laboratorio ha sido notificado.</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>ID del Caso:</strong> ${claimData.id}</p>
        <p style="margin: 5px 0;"><strong>Cliente:</strong> ${claimData.client}</p>
        <p style="margin: 5px 0;"><strong>Fecha Reporte:</strong> ${claimData.date}</p>
        <p style="margin: 5px 0;"><strong>Tipo:</strong> ${claimData.incidentType}</p>
        <p style="margin: 5px 0;"><strong>Factura:</strong> ${claimData.invoiceNumber}</p>
      </div>

      <h3 style="color: #2e3b55;">Detalle del Producto</h3>
      <p><strong>Referencia(s):</strong> ${claimData.productRef}</p>
      <p><strong>Lote(s):</strong> ${claimData.batch}</p>

      <h3 style="color: #2e3b55;">Descripción del Problema</h3>
      <div style="border-left: 4px solid #2e3b55; padding-left: 10px; color: #555;">
        <p>${claimData.description}</p>
      </div>

      <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #888;">Portal de Calidad Prolub S.A.<br>Este es un mensaje automático, por favor no responder.</p>
    </div>
  `;

  try {
    MailApp.sendEmail({
      to: recipients,
      subject: subject,
      htmlBody: htmlBody,
      name: 'Portal de Calidad Prolub',
      replyTo: labEmail
    });
  } catch (e) {
    console.error("Failed to send email: " + e.toString());
  }
}
