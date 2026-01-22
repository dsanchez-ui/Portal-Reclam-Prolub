

export enum AppView {
  LANDING = 'LANDING',
  COMMERCIAL_DASHBOARD = 'COMMERCIAL_DASHBOARD',
  COMMERCIAL_WIZARD = 'COMMERCIAL_WIZARD',
  LAB_DASHBOARD = 'LAB_DASHBOARD', 
  IMPROVEMENT = 'IMPROVEMENT'
}

export enum ClaimStatus {
  PENDING = 'Pendiente',
  ANALYSIS = 'En Análisis',
  ASSIGNED = 'En Plan de Acción',
  FOR_CLOSURE = 'Por Cerrar', 
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
  category: string; 
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
  description: string; 
  assignedTo: string; 
  status: 'Pending' | 'Realized';
  executionEvidence?: EvidenceFile[]; 
  executionNotes?: string; 
  createdAt: string;
  completedAt?: string;
}

export interface MitigationAction {
  id: string;
  description: string;
  assignedTo: string; // Previously 'responsible'
  status: 'Pending' | 'Approved'; // Individual status
  executionNotes?: string;
  executionEvidence?: EvidenceFile[];
  completedAt?: string; // Date of execution
  approvedAt?: string; // Date of approval
  createdAt: string;
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
  
  productRef: string; 
  batch: string;
  affectedItems?: ClaimItem[];

  correctionType: string;
  creditNoteValue?: string; 
  description: string;
  
  // Immediate Mitigation (Client SLA - 5 Days)
  // UPDATED: Now supports multiple independent actions
  mitigationActions?: MitigationAction[];
  
  // Legacy fields kept for temporary compatibility/display logic, but source of truth is mitigationActions
  immediateSolutionStatus?: 'Pending' | 'Approved' | 'Rejected'; 

  status: ClaimStatus;
  
  // Internal Management (Internal SLA - 30 Days)
  ishikawaList?: IshikawaEntry[];
  tasks?: Task[];
  actionPlanStatus?: 'Pending' | 'Approved'; 
  labNotes?: string;
  assignedTo?: string; 
  files?: EvidenceFile[];
  internalCloseDate?: string;
  
  driveFolderUrl?: string;
}

export interface UserUser {
  name: string;
  role: 'Commercial' | 'Lab';
}

export enum InternalRole {
  LAB = 'Laboratorio',
  MAINTENANCE = 'Mantenimiento',
  PRODUCTION = 'Producción',
  LOGISTICS = 'Logística',
  QUALITY_AUX = 'Calidad (Apoyo)',
  AUDIT = 'Auditoría / Cierre', // Formerly HSEQ
  BILLING = 'Facturación',
  SUPPLY = 'Abastecimiento'
}