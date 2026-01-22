
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
      action: 'create_claim',
      claimData: claim,
      rawFiles: processedRawFiles
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
      action: 'update_claim',
      claimData: claim,
      rawFiles: processedRawFiles
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
    // Add a timestamp to bypass any caching
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${new Date().getTime()}`);
    if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const text = await response.text();
    // Basic check for HTML error pages from Apps Script
    if (text.trim().startsWith("<!DOCTYPE")) {
        console.error("Received an HTML error page from Google Apps Script.");
        return [];
    }
    const json = JSON.parse(text);
    return json.result === 'success' ? json.data : [];
  } catch (error) {
    console.error("Critical error fetching claims:", error);
    return [];
  }
};
