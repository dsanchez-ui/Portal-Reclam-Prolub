
import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client using the API key from environment variables.
// Always use the named parameter 'apiKey'.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const enhanceClaimDescription = async (originalText: string): Promise<string> => {
  try {
    // Use 'gemini-3-flash-preview' for basic text transformation tasks as per guidelines.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Actúa como un experto en control de calidad de lubricantes industriales.
        Reescribe el siguiente reporte de problema informal para que sea técnico, profesional y estructurado.
        Mantén la información clave pero mejora la redacción.
        
        Texto original: "${originalText}"
        
        Solo devuelve el texto mejorado, sin introducciones ni explicaciones.
      `,
    });

    // Access .text directly as a property, not a method.
    return response.text || originalText;
  } catch (error) {
    console.error("Error enhancing text with Gemini:", error);
    return originalText; 
  }
};

export const enhanceImmediateSolution = async (originalText: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Actúa como un Ingeniero Líder de Calidad en una planta de lubricantes.
        Propón una "Solución Inmediata de Mitigación" técnica y profesional basada en la siguiente idea informal. 
        La solución debe ser una acción concreta para contener el problema mientras se investiga la causa raíz.
        
        Texto original: "${originalText}"
        
        Devuelve solo la solución mejorada en una oración o párrafo corto, directo y autoritario.
      `,
    });
    return response.text || originalText;
  } catch (error) {
    console.error("Error enhancing immediate solution:", error);
    return originalText;
  }
};

export const enhanceExecutionNote = async (originalText: string): Promise<string> => {
  try {
    // Standardizing on 'gemini-3-flash-preview' for high-performance text enhancement.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Actúa como un jefe de planta o logística industrial.
        Mejora la redacción del siguiente "Reporte de Ejecución de Tarea" para que suene técnico, preciso y formal.
        
        Texto original: "${originalText}"
        
        Devuelve solo el texto mejorado.
      `,
    });

    return response.text || originalText;
  } catch (error) {
    console.error("Error enhancing execution note:", error);
    return originalText;
  }
};

export const enhanceIshikawaObservation = async (originalText: string): Promise<string> => {
  try {
    // Using 'gemini-3-flash-preview' for technical reasoning and cause analysis.
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: `
        Actúa como un Ingeniero de Calidad realizando un análisis de causa raíz (Ishikawa).
        Reescribe la siguiente observación breve para que sea una declaración de causa técnica y precisa.
        
        Texto original: "${originalText}"
        
        Devuelve solo el texto mejorado.
      `
    });
    return response.text || originalText;
  } catch (error) {
    console.error("Error enhancing Ishikawa observation:", error);
    return originalText;
  }
};

export const enhanceTaskInstruction = async (originalText: string): Promise<string> => {
  try {
    // Using 'gemini-3-flash-preview' to generate structured operational directives.
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: `
        Actúa como un Gerente de Operaciones asignando una tarea.
        Convierte la siguiente instrucción simple en una directiva operativa clara, autoritaria y detallada para el personal de planta/logística.
        
        Texto original: "${originalText}"
        
        Devuelve solo el texto mejorado.
      ` 
    });
    return response.text || originalText;
  } catch (error) {
    console.error("Error enhancing task instruction:", error);
    return originalText;
  }
};
