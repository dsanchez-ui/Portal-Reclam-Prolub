

// Remplaza esta URL con la que obtuviste al desplegar tu Google Apps Script
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz6A4fiCK1iE1HTOgqHhWEWihPdZ5Yb7Dmm7C5SzZNpNTXLRx1N1NtW_DCQfJatW-Pj/exec'; 

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

export const saveClaimToSheet = async (claim: any, rawFiles: File[] = []) => {
  try {
    const processedRawFiles = [];
    if (rawFiles && rawFiles.length > 0) {
      for (const file of rawFiles) {
        const base64 = await fileToBase64(file);
        processedRawFiles.push({ name: file.name, type: file.type, size: file.size, base64: base64 });
      }
    }

    const payload = {
      action: 'create',
      timestamp: new Date().toISOString(),
      id: claim.id,
      date: claim.date,
      status: claim.status,
      client: claim.client,
      reporterName: claim.reporterName,
      reporterEmail: claim.reporterEmail,
      invoiceNumber: claim.invoiceNumber,
      brand: claim.brand,
      productRef: claim.productRef,
      batch: claim.batch,
      incidentType: claim.incidentType,
      description: claim.description,
      correctionType: claim.correctionType,
      files: claim.files, 
      rawFiles: processedRawFiles,
      ishikawaList: claim.ishikawaList,
      tasks: claim.tasks,
      mitigationActions: [], // New claims start empty
      labNotes: claim.labNotes || '', 
      assignedTo: claim.assignedTo || '' 
    };

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  } catch (error) { console.error("Error saving to sheet:", error); }
};

export const updateClaimInSheet = async (claim: any, rawFiles: File[] = []) => {
  try {
    const processedRawFiles = [];
    if (rawFiles && rawFiles.length > 0) {
      for (const file of rawFiles) {
        const base64 = await fileToBase64(file);
        processedRawFiles.push({ name: file.name, type: file.type, size: file.size, base64: base64 });
      }
    }

    const payload = {
      action: 'update',
      timestamp: new Date().toISOString(),
      id: claim.id,
      status: claim.status,
      internalCloseDate: claim.internalCloseDate, 
      tasks: claim.tasks, 
      ishikawaList: claim.ishikawaList,
      labNotes: claim.labNotes, 
      assignedTo: claim.assignedTo,
      
      // Send the Array of Actions
      mitigationActions: claim.mitigationActions || [],
      
      actionPlanStatus: claim.actionPlanStatus, 
      rawFiles: processedRawFiles,
      client: claim.client,
      reporterEmail: claim.reporterEmail,
      reporterName: claim.reporterName,
      description: claim.description
    };

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  } catch (error) { console.error("Error updating sheet:", error); }
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

export const deleteClaimFromSheet = async (id: string) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'delete', id: id })
        });
    } catch (error) { console.error("Error deleting claim:", error); }
};

export const uploadPdfToDrive = async (claimId: string, fileName: string, base64Data: string) => {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                action: 'save_pdf', 
                claimId: claimId,
                fileName: fileName,
                base64: base64Data
            })
        });
        return true;
    } catch (error) { 
        console.error("Error uploading PDF:", error);
        return false;
    }
};

export const getClaimsFromSheet = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${new Date().getTime()}`);
    const text = await response.text();
    if (text.startsWith("<!DOCTYPE")) return [];
    const json = JSON.parse(text);
    return json.result === 'success' ? json.data : [];
  } catch (error) {
    console.error("Network error fetching claims:", error);
    return [];
  }
};