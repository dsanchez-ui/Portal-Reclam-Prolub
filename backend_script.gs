
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
  const sheets = {
    [CLAIMS_SHEET]: ['ID_Reclamacion', 'Fecha_Reporte', 'Estado', 'Cliente', 'Nombre_Reporta', 'Email_Reporta', 'Numero_Factura', 'Marca', 'Productos_Afectados_RAW', 'Lotes_RAW', 'Tipo_Incidente', 'Descripcion', 'Tipo_Correccion', 'URL_Carpeta_Drive', 'Fecha_Cierre_Interno', 'Items_Afectados_JSON', 'Archivos_JSON'],
    [TASKS_SHEET]: ['ID_Tarea', 'ID_Reclamacion', 'Descripcion', 'Asignado_A', 'Estado', 'Notas_Ejecucion', 'Evidencia_JSON', 'Fecha_Creacion', 'Fecha_Completado'],
    [MITIGATIONS_SHEET]: ['ID_Mitigacion', 'ID_Reclamacion', 'Descripcion', 'Asignado_A', 'Estado', 'Notas_Ejecucion', 'Evidencia_JSON', 'Fecha_Creacion', 'Fecha_Completado', 'Fecha_Aprobado'],
    [ISHIKAWA_SHEET]: ['ID_Ishikawa', 'ID_Reclamacion', 'Categoria', 'Observacion', 'Fecha_Creacion']
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
  lock.tryLock(20000);

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

        tasks: tasksMap[id] || [],
        mitigationActions: allMitigations,
        ishikawaList: ishikawaMap[id] || [],
        
        // Derived/Legacy fields for frontend compatibility
        immediateSolutionStatus: allApproved ? 'Approved' : 'Pending',
        actionPlanStatus: "Pending" // This needs a proper storage if required, for now default
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
  lock.tryLock(30000);
  
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    const { action, claimData, rawFiles, id, date, claimId, fileName, base64 } = data;
    
    setupSheets(); // Ensure sheets exist before any operation

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
      case 'save_pdf':
        return savePdf(claimId, fileName, base64);
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

  // Handle file uploads and get Drive folder URL
  const { driveFolderUrl, uploadedFileInfos } = handleFileUploads(claimData.id, claimData.client, rawFiles);

  // Main Claim Row
  claimsSheet.appendRow([
    claimData.id, claimData.date, claimData.status, claimData.client, claimData.reporterName, claimData.reporterEmail, 
    claimData.invoiceNumber, claimData.brand, claimData.productRef, claimData.batch, claimData.incidentType, 
    claimData.description, claimData.correctionType, driveFolderUrl, '', JSON.stringify(claimData.affectedItems || []), JSON.stringify(uploadedFileInfos)
  ]);
  
  // Child Rows
  (claimData.tasks || []).forEach(t => tasksSheet.appendRow([t.id, claimData.id, t.description, t.assignedTo, t.status, '', '[]', t.createdAt, '']));
  (claimData.mitigationActions || []).forEach(m => mitigationsSheet.appendRow([m.id, claimData.id, m.description, m.assignedTo, m.status, '', '[]', m.createdAt, '', '']));
  (claimData.ishikawaList || []).forEach(i => ishikawaSheet.appendRow([i.id, claimData.id, i.category, i.observation, i.createdAt]));

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

  // Handle file uploads (adds new files to existing folder)
  const existingFolderUrl = claimsSheet.getRange(rowIndex, 14).getValue();
  const { uploadedFileInfos } = handleFileUploads(claimId, claimData.client, rawFiles, existingFolderUrl);

  // Merge new file info with existing
  const existingFiles = parseJSONSafe(claimsSheet.getRange(rowIndex, 17).getValue());
  const allFiles = [...existingFiles, ...uploadedFileInfos];

  // Update Main Claim Row
  claimsSheet.getRange(rowIndex, 1, 1, 17).setValues([[
    claimId, claimData.date, claimData.status, claimData.client, claimData.reporterName, claimData.reporterEmail, 
    claimData.invoiceNumber, claimData.brand, claimData.productRef, claimData.batch, claimData.incidentType, 
    claimData.description, claimData.correctionType, existingFolderUrl, claimData.internalCloseDate || '', JSON.stringify(claimData.affectedItems || []), JSON.stringify(allFiles)
  ]]);

  // Delete and re-add child records to ensure sync
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

function deleteTask(doc, taskId) {
    const tasksSheet = doc.getSheetByName(TASKS_SHEET);
    const rowIndex = findRowIndex(tasksSheet, taskId, 0); // ID is in column 0
    if (rowIndex !== -1) {
        tasksSheet.deleteRow(rowIndex);
        return ContentService.createTextOutput(JSON.stringify({ result: 'success', action: 'task_deleted' })).setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error(`Task ID ${taskId} not found for deletion.`);
}

function deleteMitigation(doc, mitigationId) {
    const mitigationsSheet = doc.getSheetByName(MITIGATIONS_SHEET);
    const rowIndex = findRowIndex(mitigationsSheet, mitigationId, 0); // ID is in column 0
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
      claimsSheet.getRange(rowIndex, 3).setValue('Cerrado'); // Status column
      claimsSheet.getRange(rowIndex, 15).setValue(closeDate); // Internal Close Date column
      return ContentService.createTextOutput(JSON.stringify({ result: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error("ID not found for closure.");
}

function savePdf(claimId, fileName, base64) {
    const rootFolder = DriveApp.getFolderById("1PJBsgGwyR1BLG8X6wutmwvXs0ItYoLl2"); // Main Drive Folder ID
    const folders = rootFolder.getFoldersByName(`${claimId}*`); // Find folder starting with claim ID
    let targetFolder;

    if (folders.hasNext()) {
        targetFolder = folders.next();
    } else {
        throw new Error(`Drive folder for claim ${claimId} not found.`);
    }

    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', fileName);
    const file = targetFolder.createFile(blob);
    return ContentService.createTextOutput(JSON.stringify({ result: 'success', url: file.getUrl() })).setMimeType(ContentService.MimeType.JSON);
}

function handleFileUploads(claimId, clientName, rawFiles, existingFolderUrl = null) {
  const uploadedFileInfos = [];
  let driveFolderUrl = existingFolderUrl;
  
  if (rawFiles && rawFiles.length > 0) {
    const rootFolder = DriveApp.getFolderById("1PJBsgGwyR1BLG8X6wutmwvXs0ItYoLl2");
    let targetFolder;

    if (driveFolderUrl) {
      targetFolder = DriveApp.getFolderById(driveFolderUrl.split('/').pop());
    } else {
      targetFolder = rootFolder.createFolder(`${claimId} - ${clientName || "Caso"}`);
      targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      driveFolderUrl = targetFolder.getUrl();
    }

    rawFiles.forEach(raw => {
      const blob = Utilities.newBlob(Utilities.base64Decode(raw.base64), raw.type, raw.name);
      const file = targetFolder.createFile(blob);
      uploadedFileInfos.push({ name: raw.name, url: file.getUrl(), type: raw.type, size: raw.size });
    });
  }
  return { driveFolderUrl, uploadedFileInfos };
}

function getEvidenceFor(itemId, allFiles) {
  return allFiles.filter(f => f.name.includes(itemId));
}
