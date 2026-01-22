

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('Hoja 1') || doc.getSheets()[0]; 
    
    var rows = sheet.getDataRange().getValues();
    var claims = [];

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[0]) continue;
      
      if (row[2] === 'ELIMINADO') continue;

      // --- MAPEO DE COLUMNAS (DO GET) ---
      var mitigationJson = (row.length > 21) ? row[21] : "{}"; 
      var mitigationData = parseJSONSafe(mitigationJson); 

      // NORMALIZACIÓN DE MITIGACIONES (Legacy vs New Array)
      var mitigationActions = [];
      var overallMitigationStatus = "Pending";

      if (mitigationData.actions && Array.isArray(mitigationData.actions)) {
          // New format
          mitigationActions = mitigationData.actions;
          // Calculate overall status based on actions
          if (mitigationActions.length > 0 && mitigationActions.every(function(m){ return m.status === 'Approved'; })) {
              overallMitigationStatus = 'Approved';
          }
      } else if (mitigationData.description) {
          // Legacy format: Convert single object to array item
          mitigationActions.push({
              id: 'legacy_' + row[0],
              description: mitigationData.description,
              assignedTo: mitigationData.responsible || "Sin Asignar",
              status: mitigationData.status === 'Approved' ? 'Approved' : 'Pending',
              executionNotes: mitigationData.notes || "",
              executionEvidence: mitigationData.evidence || [],
              createdAt: row[1], // Use report date as creation
              approvedAt: mitigationData.date || ""
          });
          overallMitigationStatus = mitigationData.status || "Pending";
      }

      var filesJson = (row.length > 22) ? row[22] : "[]";
      var initialFiles = parseJSONSafe(filesJson);

      var claim = {
        id: row[0],
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
        internalCloseDate: formatDate(row[16]),
        assignedTo: row[17],
        ishikawaList: parseJSONSafe(row[18]), 
        tasks: parseJSONSafe(row[19]),
        
        // Mitigation Data (Now Array)
        mitigationActions: mitigationActions,
        immediateSolutionStatus: overallMitigationStatus, // Derived for compatibility
        
        // Action Plan Status persistence
        actionPlanStatus: mitigationData.actionPlanStatus || "Pending",

        files: initialFiles,
        affectedItems: [] 
      };
      
      try {
          if (claim.productRef.startsWith('[')) {
             claim.affectedItems = JSON.parse(claim.productRef);
             claim.productRef = claim.affectedItems.map(function(it) { return it.productRef; }).join(', ');
          }
      } catch(e) {}

      claims.push(claim);
    }
    return ContentService.createTextOutput(JSON.stringify({result: 'success', data: claims})).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({result: 'error', error: e.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('Hoja 1') || doc.getSheets()[0];
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    // ==========================================
    // ACCIÓN PRIORITARIA: CIERRE DEFINITIVO
    // ==========================================
    if (action === 'close_case_definitive') {
       var values = sheet.getDataRange().getValues();
       var rowIndex = -1;
       
       for (var i = 1; i < values.length; i++) {
         if (values[i][0] == data.id) { rowIndex = i + 1; break; }
       }

       if (rowIndex > 0) {
         var closeDate = data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
         sheet.getRange(rowIndex, 3).setValue('Cerrado'); 
         var internalDateCell = sheet.getRange(rowIndex, 17);
         if (!internalDateCell.getValue()) { internalDateCell.setValue(closeDate); }
         sheet.getRange(rowIndex, 21).setValue(closeDate);
         return ContentService.createTextOutput(JSON.stringify({result: 'success', action: 'closed_definitive'})).setMimeType(ContentService.MimeType.JSON);
       } else {
         return ContentService.createTextOutput(JSON.stringify({result: 'error', message: 'ID not found for closure'})).setMimeType(ContentService.MimeType.JSON);
       }
    }

    // --- OTRAS ACCIONES ---

    if (action === 'delete') {
       var values = sheet.getDataRange().getValues();
       var rowIndex = -1;
       for (var i = 1; i < values.length; i++) {
         if (values[i][0] == data.id) { rowIndex = i + 1; break; }
       }
       if (rowIndex > 0) {
         sheet.getRange(rowIndex, 3).setValue('ELIMINADO');
         return ContentService.createTextOutput(JSON.stringify({result: 'success', action: 'deleted'})).setMimeType(ContentService.MimeType.JSON);
       }
       return ContentService.createTextOutput(JSON.stringify({result: 'error', message: 'ID not found'})).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'save_pdf') {
       var rootFolder = DriveApp.getFolderById("1PJBsgGwyR1BLG8X6wutmwvXs0ItYoLl2"); 
       var targetFolder;
       var folders = rootFolder.getFolders();
       while (folders.hasNext()) {
         var f = folders.next();
         if (f.getName().indexOf(data.claimId) === 0) { targetFolder = f; break; }
       }
       if (!targetFolder) {
          targetFolder = rootFolder.createFolder(data.claimId + " - Reportes");
          targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
       }
       var blob = Utilities.newBlob(Utilities.base64Decode(data.base64), 'application/pdf', data.fileName);
       var file = targetFolder.createFile(blob);
       return ContentService.createTextOutput(JSON.stringify({result: 'success', url: file.getUrl()})).setMimeType(ContentService.MimeType.JSON);
    }

    // CREAR / ACTUALIZAR
    var uploadedFileInfos = [];
    var initialEvidenceInfos = [];

    if (data.rawFiles && data.rawFiles.length > 0) {
       var rootFolder = DriveApp.getFolderById("1PJBsgGwyR1BLG8X6wutmwvXs0ItYoLl2");
       var targetFolder;
       var folders = rootFolder.getFolders();
       while (folders.hasNext()) {
         var f = folders.next();
         if (f.getName().indexOf(data.id) === 0) { targetFolder = f; break; }
       }
       if (!targetFolder) { 
          targetFolder = rootFolder.createFolder(data.id + " - " + (data.client || "Caso"));
          targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
       }
       for (var i = 0; i < data.rawFiles.length; i++) {
         var raw = data.rawFiles[i];
         var blob = Utilities.newBlob(Utilities.base64Decode(raw.base64), raw.type, raw.name);
         var file = targetFolder.createFile(blob);
         var fileMeta = { name: raw.name, url: file.getUrl(), type: raw.type, size: raw.size };
         uploadedFileInfos.push(fileMeta);
         if (raw.name.indexOf("EVIDENCIA_MITIGACION") === -1 && raw.name.indexOf("EVIDENCIA_User") === -1 && raw.name.indexOf("EVIDENCIA_Laboratorio") === -1) {
            initialEvidenceInfos.push(fileMeta);
         }
       }
    }

    // Attach evidence to tasks
    if (uploadedFileInfos.length > 0) {
        if (data.tasks) {
            for (var t = 0; t < data.tasks.length; t++) {
                for (var u = 0; u < uploadedFileInfos.length; u++) {
                    if (uploadedFileInfos[u].name.indexOf(data.tasks[t].id) !== -1) {
                        if (!data.tasks[t].executionEvidence) data.tasks[t].executionEvidence = [];
                        data.tasks[t].executionEvidence.push(uploadedFileInfos[u]);
                    }
                }
            }
        }
        // Attach evidence to MITIGATION ACTIONS (New Array Logic)
        if (data.mitigationActions) {
            for (var m = 0; m < data.mitigationActions.length; m++) {
                for (var u = 0; u < uploadedFileInfos.length; u++) {
                    if (uploadedFileInfos[u].name.indexOf(data.mitigationActions[m].id) !== -1) {
                        if (!data.mitigationActions[m].executionEvidence) data.mitigationActions[m].executionEvidence = [];
                        data.mitigationActions[m].executionEvidence.push(uploadedFileInfos[u]);
                    }
                }
            }
        }
    }

    var readableIshikawa = "";
    if (data.ishikawaList) readableIshikawa = data.ishikawaList.map(function(item) { return "• [" + item.category + "]: " + item.observation; }).join("\n");
    
    var readableTasks = "";
    if (data.tasks) {
      readableTasks = data.tasks.map(function(t) {
        var statusIcon = t.status === 'Realized' ? "✅" : "⏳";
        var technicalNote = t.executionNotes ? " -> Nota: " + t.executionNotes : "";
        return statusIcon + " " + t.assignedTo + ": " + t.description + technicalNote;
      }).join("\n----------------\n");
    }
    
    var closingDate = data.internalCloseDate;
    if (!closingDate && (data.status === 'Cerrado' || data.status === 'CLOSED')) {
        closingDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    }

    if (action === 'create') {
      var mitigationData = {
          actions: [], // New claims start with empty actions
          actionPlanStatus: "Pending"
      };
      
      var productRefString = data.productRef;
      if (data.affectedItems && data.affectedItems.length > 0) {
          productRefString = JSON.stringify(data.affectedItems);
      }

      var rowData = [
        data.id, data.date, data.status, data.client, data.reporterName, data.reporterEmail, data.invoiceNumber, data.brand, 
        productRefString, data.batch, data.incidentType, data.description, data.correctionType, 
        targetFolder ? targetFolder.getUrl() : "", 
        readableIshikawa, readableTasks, 
        closingDate || "", // 16 (Q)
        data.assignedTo || '', // 17 (R)
        JSON.stringify(data.ishikawaList || []), // 18 (S)
        JSON.stringify(data.tasks || []), // 19 (T)
        "", // 20 (U) 
        JSON.stringify(mitigationData), // 21 (V)
        JSON.stringify(initialEvidenceInfos) // 22 (W)
      ];
      sheet.appendRow(rowData);
      return ContentService.createTextOutput(JSON.stringify({result: 'success', row: sheet.getLastRow()})).setMimeType(ContentService.MimeType.JSON);
    } 
    
    else if (action === 'update') {
      var values = sheet.getDataRange().getValues();
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] == data.id) { rowIndex = i + 1; break; }
      }

      if (rowIndex > 0) {
        if(data.status) sheet.getRange(rowIndex, 3).setValue(data.status);
        if(closingDate) sheet.getRange(rowIndex, 17).setValue(closingDate);
        if(data.assignedTo !== undefined) sheet.getRange(rowIndex, 18).setValue(data.assignedTo);

        if(data.ishikawaList) {
            sheet.getRange(rowIndex, 15).setValue(readableIshikawa);
            sheet.getRange(rowIndex, 19).setValue(JSON.stringify(data.ishikawaList));
        }

        if(data.tasks) {
            sheet.getRange(rowIndex, 16).setValue(readableTasks);
            sheet.getRange(rowIndex, 20).setValue(JSON.stringify(data.tasks));
        }
        
        var mitigationObj = {
             actions: data.mitigationActions || [],
             actionPlanStatus: data.actionPlanStatus || "Pending" 
        };
        // UPDATE: Write mitigation to col 22 (V)
        sheet.getRange(rowIndex, 22).setValue(JSON.stringify(mitigationObj));
        
        return ContentService.createTextOutput(JSON.stringify({result: 'success', action: 'updated'})).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({result: 'error', message: 'ID not found'})).setMimeType(ContentService.MimeType.JSON);
      }
    }

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({result: 'error', error: e.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function parseJSONSafe(str) { try { return JSON.parse(str); } catch (e) { return []; } }
function formatDate(date) { if (!date) return ''; if (date instanceof Date) { return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy"); } return date; }