export interface ImageMetadata {
  uploadedAt: string
  modifiedAt: string
  uploadedBy: string
}

// Redefining WidthMeasurement to represent fixed points (T, M, B)
export interface WidthMeasurement {
  T: number; // Top width measurement
  M: number; // Middle width measurement
  B: number; // Bottom width measurement
}

// Redefining HeightMeasurement to represent fixed points (L, C, R)
export interface HeightMeasurement {
  L: number; // Left height measurement
  C: number; // Center height measurement
  R: number; // Right height measurement
}

export type Point = { x: number; y: number };

export interface WindowBounds {
  tl: Point; // top-left
  tr: Point; // top-right
  bl: Point; // bottom-left
  br: Point; // bottom-right
}

// WizardMeasurements now uses the fixed width and height structures
export interface WizardMeasurements {
  widths: WidthMeasurement; // Now an object with T, M, B
  heights: HeightMeasurement; // Now an object with L, C, R
  // diagonals: DiagonalMeasurement[]; // Removed
}

export interface UploadedFile {
  id: string; // Unique ID for the file (e.g., UUID)
  name: string; // Original file name
  type: string; // MIME type
  data: string; // Base64 data URL (client-side only)
  path?: string; // Supabase storage path (for persistence)
}

export interface WindowItem {
  id: string
  lineNumber: number
  location: string
  width: number
  height: number
  depth: number
  notes: string
  image: string | null
  annotations: string | null
  isExpanded: boolean
  imageMetadata?: ImageMetadata
  wizardImage: string | null
  wizardMeasurements: WizardMeasurements | null
  wizardWindowBounds: WindowBounds | null; // Separate property
  image_path?: string | null;
  annotations_path?: string | null;
  wizard_image_path?: string | null;
  wizard_data_path?: string | null;
  project_id?: string | null;
  isImageDirty?: boolean; // New: Flag to indicate if image data has changed
  isAnnotationsDirty?: boolean; // New: Flag to indicate if annotation data has changed
  
  // New fields for signature and file uploads
  signature?: string | null; // Base64 data of the signature
  signature_path?: string | null; // Supabase storage path for signature
  isSignatureDirty?: boolean; // Flag to indicate if signature has changed

  uploadedFiles?: UploadedFile[]; // Array of files with base64 data (client-side)
  uploaded_files_paths?: { id: string; name: string; path: string; }[]; // Array of file paths (for persistence)
  isFilesDirty?: boolean; // Flag to indicate if uploaded files have changed

  [key: string]: any // For dynamic fields
}

export type GlobalFormData = Record<string, any> & { // New type for global form data
  installerSignature?: string | null;
  customerSignature?: string | null;
};