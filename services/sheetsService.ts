
// Remplaza esta URL con la que obtuviste al desplegar tu Google Apps Script
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEIHRHNgJbxvLx0n_kfBjUQXCxU1O4d1o4Twr1XhEXD_vyimTh3T5dYyrE2Gy0LYbq/exec'; 

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1]; 
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const saveClaimToSheet = async (claim: any, rawFiles: File[] = []): Promise<{success: boolean, driveFolderUrl?: string, driveClientFolderUrl?: string}> => {
  try {
    const processedRawFiles = [];
    if (rawFiles && rawFiles.length > 0) {
      for (const file of rawFiles) {
        const base64 = await fileToBase64(file);
        processedRawFiles.push({ name: file.name, type: file.type, size: file.size, base64: base64 });
      }
    }

    const payload = {
      action: 'create_claim',
      claimData: claim,
      rawFiles: processedRawFiles
    };

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    
    const json = await response.json();
    if (json.result === 'success') {
        return { 
            success: true, 
            driveFolderUrl: json.driveFolderUrl,
            driveClientFolderUrl: json.driveClientFolderUrl 
        };
    }
    return { success: false };
  } catch (error) { 
    console.error("Error saving to sheet:", error); 
    return { success: false };
  }
};

export const sendClaimNotification = async (claim: any) => {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ 
        action: 'send_notification', 
        claimData: claim 
      })
    });
    return true;
  } catch (error) {
    console.error("Error sending notification:", error);
    return false;
  }
};

// Deprecated in favor of generic sendAssignmentAlert but kept for compatibility
export const sendMitigationAlert = async (claim: any, mitigation: any) => {
  return sendAssignmentAlert(claim, mitigation, 'MITIGATION');
};

export const AREA_EMAILS: Record<string, string> = {
  'Logística': 'logistica@gulfcolombia.com',
  'Abastecimiento': 'liderabastecimiento@prolub.com.co',
  'Mantenimiento': 'mantenimiento@prolub.com.co',
  'Producción': 'amoyano@gulfcolombia.com',
  'Facturación': 'facturacion@prolub.com.co',
  // Mapping both role names to be safe
  'Calidad': 'liderlaboratorio@gulfcolombia.com', 
  'Calidad (Apoyo)': 'liderlaboratorio@gulfcolombia.com',
  'Laboratorio': 'liderlaboratorio@gulfcolombia.com'
};

export const sendAssignmentAlert = async (claim: any, item: any, type: 'MITIGATION' | 'TASK') => {
  try {
    const targetEmail = AREA_EMAILS[item.assignedTo];
    
    if (!targetEmail) {
        console.warn(`No email mapped for area: ${item.assignedTo}`);
        return false;
    }

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ 
        action: 'send_assignment_alert', 
        claimData: claim,
        itemData: item,
        targetEmail: targetEmail,
        itemType: type
      })
    });
    return true;
  } catch (error) {
    console.error("Error sending assignment alert:", error);
    return false;
  }
};

export const sendAuditAlert = async (claim: any, auditType: 'MITIGATION_READY' | 'PLAN_READY') => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'send_audit_alert', 
                claimData: claim,
                auditType: auditType
            })
        });
        return true;
    } catch (error) {
        console.error("Error sending audit alert:", error);
        return false;
    }
};

export const sendChangeRequest = async (claim: any, item: any, requestText: string, type: 'MITIGATION' | 'TASK' | 'ISHIKAWA') => {
    try {
        // Determine target email
        let targetEmail = '';
        if (type === 'ISHIKAWA') {
            targetEmail = AREA_EMAILS['Laboratorio'];
        } else {
            targetEmail = AREA_EMAILS[item.assignedTo];
        }

        if (!targetEmail) {
            console.error("Target email not found for assignment");
            return false;
        }

        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'send_change_request', 
                claimData: claim,
                itemData: item,
                targetEmail: targetEmail,
                itemType: type,
                requestText: requestText
            })
        });
        return true;
    } catch (error) {
        console.error("Error sending change request:", error);
        return false;
    }
};

export const resolveChangeRequest = async (requestId: string) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'resolve_change_request', 
                requestId: requestId
            })
        });
        return true;
    } catch (error) {
        console.error("Error resolving change request:", error);
        return false;
    }
};

export const finalizeClaimResponse = async (claim: any, pdfBase64: string, recipientEmails: string[]) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'finalize_response', 
                claimData: claim,
                pdfBase64: pdfBase64,
                recipientEmails: recipientEmails
            })
        });
        return true;
    } catch (error) { 
        console.error("Error finalizing response:", error);
        return false;
    }
};

export const updateClaimInSheet = async (claim: any, rawFiles: File[] = []): Promise<{success: boolean, error?: string}> => {
  try {
    const processedRawFiles = [];
    if (rawFiles && rawFiles.length > 0) {
      for (const file of rawFiles) {
        const base64 = await fileToBase64(file);
        processedRawFiles.push({ name: file.name, type: file.type, size: file.size, base64: base64 });
      }
    }

    const payload = {
      action: 'update_claim',
      claimData: claim,
      rawFiles: processedRawFiles
    };

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    if (json.result === 'error') {
        if (json.code === 'STALE_DATA') {
            return { success: false, error: 'STALE_DATA' };
        }
        return { success: false, error: json.message || 'Unknown error' };
    }
    return { success: true };

  } catch (error) { 
      console.error("Error updating sheet:", error);
      return { success: false, error: String(error) };
  }
};

export const closeClaimSimple = async (id: string, closeDate: string) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'close_case_definitive', 
                id: id,
                date: closeDate
            })
        });
        return true;
    } catch (error) { 
        console.error("Error closing claim:", error);
        return false;
    }
};

export const archiveClaimInSheet = async (id: string) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'archive_claim', 
                id: id
            })
        });
        return true;
    } catch (error) { 
        console.error("Error archiving claim:", error);
        return false;
    }
};

export const deleteClaimFromSheet = async (id: string) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'delete_claim', id: id })
        });
    } catch (error) { console.error("Error deleting claim:", error); }
};

export const deleteTaskFromSheet = async (taskId: string) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'delete_task', id: taskId })
        });
    } catch (error) { console.error("Error deleting task:", error); }
};

export const deleteMitigationFromSheet = async (mitigationId: string) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'delete_mitigation', id: mitigationId })
        });
    } catch (error) { console.error("Error deleting mitigation:", error); }
};

export const uploadPdfToDrive = async (claimId: string, fileName: string, base64Data: string, reportType: 'CLIENT' | 'FINAL', folderUrl?: string) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'save_pdf', 
                claimId: claimId,
                fileName: fileName,
                base64: base64Data,
                reportType: reportType,
                folderUrl: folderUrl
            })
        });
        return true;
    } catch (error) { 
        console.error("Error uploading PDF:", error);
        return false;
    }
};

export const getClaimsFromSheet = async (): Promise<{claims: any[], integrantes: {name: string, email: string}[]}> => {
  try {
    // Add a timestamp to bypass any caching
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${new Date().getTime()}`);
    if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const text = await response.text();
    // Basic check for HTML error pages from Apps Script
    if (text.trim().startsWith("<!DOCTYPE")) {
        console.error("Received an HTML error page from Google Apps Script.");
        return { claims: [], integrantes: [] };
    }
    const json = JSON.parse(text);
    return json.result === 'success' ? { claims: json.data || [], integrantes: json.integrantes || [] } : { claims: [], integrantes: [] };
  } catch (error) {
    console.error("Critical error fetching claims:", error);
    return { claims: [], integrantes: [] };
  }
};
