/**
 * Represents a physical or virtual printer discovered from the operating system.
 */
export interface DiscoveredPrinter {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

/**
 * Structured request for printing to a specific targeted printer queue.
 */
export interface TargetedPrintRequest {
  deviceName: string;
  html: string;
  jobId: string;
}

/**
 * Structured error details for a targeted print failure.
 */
export interface TargetedPrintError {
  code: string;
  message: string;
}

/**
 * Structured result returned by the Electron targeted printing IPC.
 */
export interface TargetedPrintResult {
  success: boolean;
  jobId: string;
  printerName: string;
  error: TargetedPrintError | null;
}
