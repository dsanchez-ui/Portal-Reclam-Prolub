
export enum AppView {
  LANDING = 'LANDING',
  COMMERCIAL_DASHBOARD = 'COMMERCIAL_DASHBOARD',
  COMMERCIAL_WIZARD = 'COMMERCIAL_WIZARD',
  LAB_DASHBOARD = 'LAB_DASHBOARD', // Reused for Internal Management Portal
  IMPROVEMENT = 'IMPROVEMENT'
}

export enum ClaimStatus {
  PENDING = 'Pendiente',
  ANALYSIS = 'En Análisis',
  ASSIGNED = 'En Plan de Acción',
  FOR_CLOSURE = 'Por Cerrar', // Ready for HSEQ review
  CLOSED = 'Cerrado'
}

export enum Brand {
  GULF = 'Gulf',
  VALVOLINE = 'Valvoline',
  MAQUILA = 'Maquila'
}

export enum IncidentType {
  QUALITY = 'Calidad',
  LOGISTICS = 'Logística'
}

export interface IshikawaEntry {
  id: string;
  category: string; // Maquinaria, Mano de Obra, etc.
  observation: string;
  createdAt: string;
}

export interface EvidenceFile {
  name: string;
  type: string;
  url: string;
  size: number;
}

export interface Task {
  id: string;
  description: string; // Instruction from Mayerly
  assignedTo: string; // Manuel, Andrea, Germán, Internal
  status: 'Pending' | 'Realized';
  executionEvidence?: EvidenceFile[]; // Array of files uploaded by execution team
  executionNotes?: string; // New field for technical report
  createdAt: string;
  completedAt?: string;
}

export interface ClaimItem {
  id: string;
  productRef: string;
  batch: string;
  quantity: string;
}

export interface Claim {
  id: string;
  date: string;
  reporterName: string;
  reporterEmail?: string;
  client: string;
  denouncer?: string;
  invoiceNumber: string;
  incidentType: IncidentType;
  brand: Brand;
  
  // Legacy single fields (kept for display summaries)
  productRef: string; 
  batch: string;
  
  // New Multi-Item field
  affectedItems?: ClaimItem[];

  correctionType: string;
  creditNoteValue?: string; // Nuevo campo para nota crédito
  description: string;
  
  // Mitigación Inmediata
  immediateSolution?: string; 
  immediateSolutionResponsible?: string; 
  immediateSolutionStatus?: 'Pending' | 'Approved' | 'Rejected'; 
  immediateSolutionFeedback?: string; 
  immediateSolutionExecutionNotes?: string; // Reporte de Andrea/Manuel
  immediateSolutionExecutionEvidence?: EvidenceFile[]; // Fotos/Videos de Andrea/Manuel
  
  status: ClaimStatus;
  
  // Internal Management Fields
  ishikawaList?: IshikawaEntry[];
  tasks?: Task[];
  labNotes?: string;
  assignedTo?: string; 
  files?: EvidenceFile[];
}

export interface UserUser {
  name: string;
  role: 'Commercial' | 'Lab';
}

export enum InternalRole {
  LAB = 'Laboratorio (Mayerly)',
  MAINTENANCE = 'Mantenimiento (Manuel)',
  PRODUCTION = 'Producción (Andrea)',
  LOGISTICS = 'Logística (Germán/Javier)',
  QUALITY_AUX = 'Calidad (Interno)',
  HSEQ = 'HSEQ (Jenny)',
  BILLING = 'Facturación',
  SUPPLY = 'Abastecimiento'
}
