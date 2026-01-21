
// Remplaza esta URL con la que obtuviste al desplegar tu Google Apps Script
// Esta URL (V3) maneja: Base de Datos (Sheets) + Archivos (Drive) + Correos (Gmail)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzcG2a0la1ld_NOhWrxMecbzkBf8JhWPal1qG27WJ5fguzOxWF38ey3wAhEFKQIVi75kQ/exec'; 

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the Data-URI prefix (e.g. "data:image/jpeg;base64,")
      const result = reader.result as string;
      const base64 = result.split(',')[1]; 
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const saveClaimToSheet = async (claim: any, rawFiles: File[] = []) => {
  if (GOOGLE_SCRIPT_URL.includes('PEGAR_TU_URL_AQUI')) {
    console.warn("Google Sheets URL not configured.");
    return;
  }

  try {
    // Process files to Base64
    const processedRawFiles = [];
    if (rawFiles && rawFiles.length > 0) {
      for (const file of rawFiles) {
        try {
          const base64 = await fileToBase64(file);
          processedRawFiles.push({
            name: file.name,
            type: file.type,
            size: file.size,
            base64: base64
          });
        } catch (e) {
          console.error("Error converting file to base64", file.name, e);
        }
      }
    }

    const payload = {
      action: 'create',
      timestamp: new Date().toISOString(), // Prevent caching
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
      rawFiles: processedRawFiles, // Send actual file data to script
      ishikawaList: claim.ishikawaList,
      tasks: claim.tasks,
      labNotes: claim.labNotes || '', 
      assignedTo: claim.assignedTo || '' 
    };

    // Use cors mode but send as text/plain to avoid preflight issues while allowing response reading
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors', 
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    console.log("Claim save result:", result);
  } catch (error) {
    console.error("Error saving to sheet:", error);
  }
};

export const updateClaimInSheet = async (claim: any, rawFiles: File[] = []) => {
  if (GOOGLE_SCRIPT_URL.includes('PEGAR_TU_URL_AQUI')) {
    return;
  }

  try {
    // Process files to Base64 for Update
    const processedRawFiles = [];
    if (rawFiles && rawFiles.length > 0) {
      for (const file of rawFiles) {
        try {
          const base64 = await fileToBase64(file);
          processedRawFiles.push({
            name: file.name,
            type: file.type,
            size: file.size,
            base64: base64
          });
        } catch (e) {
          console.error("Error converting file to base64 during update", file.name, e);
        }
      }
    }

    const payload = {
      action: 'update',
      timestamp: new Date().toISOString(),
      id: claim.id,
      status: claim.status,
      tasks: claim.tasks, 
      ishikawaList: claim.ishikawaList,
      labNotes: claim.labNotes, 
      assignedTo: claim.assignedTo,
      
      // PERSISTENCIA DE MITIGACIÓN INMEDIATA
      immediateSolution: claim.immediateSolution,
      immediateSolutionResponsible: claim.immediateSolutionResponsible,
      immediateSolutionStatus: claim.immediateSolutionStatus,
      immediateSolutionFeedback: claim.immediateSolutionFeedback,
      immediateSolutionExecutionNotes: claim.immediateSolutionExecutionNotes,
      immediateSolutionExecutionEvidence: claim.immediateSolutionExecutionEvidence,

      rawFiles: processedRawFiles,
      
      // Pass contextual data in case emails need it during update
      client: claim.client,
      reporterEmail: claim.reporterEmail,
      reporterName: claim.reporterName,
      description: claim.description
    };

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("Claim update result:", result);
  } catch (error) {
    console.error("Error updating sheet:", error);
  }
};

export const getClaimsFromSheet = async (): Promise<any[]> => {
  if (GOOGLE_SCRIPT_URL.includes('PEGAR_TU_URL_AQUI')) {
    return [];
  }

  try {
    // Adding a timestamp to prevent caching
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${new Date().getTime()}`);
    const text = await response.text();

    // Check if it's the test message or HTML error
    if (text.includes("API PROLUB ESTÁ EN LÍNEA") || text.startsWith("<!DOCTYPE")) {
        console.warn("⚠️ BACKEND WARNING: The Google Script is currently returning text/html instead of JSON.");
        return [];
    }

    try {
        const json = JSON.parse(text);
        if (json.result === 'success') {
           return json.data;
        } else {
           console.error("Error response from sheet:", json);
           return [];
        }
    } catch(e) {
        console.error("Failed to parse JSON response:", text);
        return [];
    }
  } catch (error) {
    console.error("Network error fetching claims:", error);
    return [];
  }
};
