import {
  KOTRoutingResult,
  KOTPrintJob,
  UnroutableKOTItem,
} from './kotRoutingTypes';
import { renderKOTHtml, RenderKOTHtmlOptions } from './renderKOTHtml';
import {
  DiscoveredPrinter,
  TargetedPrintRequest,
  TargetedPrintResult,
} from '@/types/electronPrinting';

/**
 * Standard delay (in milliseconds) between sequential print jobs to prevent
 * hardware buffer overruns and OS print spool collisions.
 */
export const DEFAULT_DISPATCH_DELAY_MS = 100;

/**
 * Minimal Electron IPC interface required for targeted printing.
 */
export interface ElectronPrintingAPI {
  printTargeted: (request: TargetedPrintRequest) => Promise<TargetedPrintResult>;
  getPrinters?: () => Promise<DiscoveredPrinter[]>;
}

/**
 * Input accepted by the dispatcher. Can be the full result from routeKOT()
 * or an array of KOTPrintJob[].
 */
export type KOTDispatchInput =
  | KOTRoutingResult
  | KOTPrintJob[]
  | {
      jobs: KOTPrintJob[];
      unroutableItems?: UnroutableKOTItem[];
    };

/**
 * Options to configure the dispatch execution.
 */
export interface KOTDispatchOptions {
  /**
   * Pause duration (ms) between consecutive station print jobs.
   * Default: DEFAULT_DISPATCH_DELAY_MS (100ms).
   */
  delayBetweenJobsMs?: number;

  /**
   * Optional Electron IPC client override (useful for testing or dependency injection).
   * Defaults to window.electronAPI when executed in browser/desktop environment.
   */
  electronAPI?: ElectronPrintingAPI;

  /**
   * Options passed to renderKOTHtml (e.g. duplicate ticket override).
   */
  renderOptions?: RenderKOTHtmlOptions;

  /**
   * Optional list of discovered installed printers.
   * If provided, pre-validates device_name against this list.
   */
  installedPrinters?: DiscoveredPrinter[];

  /**
   * Explicit unroutable items to retain if passing raw KOTPrintJob[].
   */
  unroutableItems?: UnroutableKOTItem[];
}

/**
 * Structured error details for a single KOT job failure.
 */
export interface KOTDispatchJobError {
  code:
    | 'EMPTY_DEVICE_NAME'
    | 'INACTIVE_PRINTER'
    | 'PRINTER_NOT_FOUND'
    | 'HTML_RENDER_ERROR'
    | 'ELECTRON_PRINT_FAILED'
    | 'ELECTRON_PRINTING_UNAVAILABLE'
    | 'UNKNOWN_ERROR';
  message: string;
}

/**
 * Result of dispatching an individual station print job.
 */
export interface KOTDispatchJobResult {
  jobId: string;
  printerId: string;
  printerName: string;
  deviceName: string;
  success: boolean;
  error?: KOTDispatchJobError | null;
}

/**
 * Top-level structured result returned by the multi-printer KOT dispatcher.
 *
 * CRITICAL SAFETY CONTRACT:
 * - Does NOT invoke window.print() or any legacy print dialog.
 * - Does NOT silently re-route failed station jobs to arbitrary fallback printers.
 * - Honestly reports individual job successes and failures.
 * - Preserves unroutable items for upstream handling.
 */
export interface KOTDispatchResult {
  /**
   * True only if Electron is available, all jobs succeeded, and 0 items were unroutable.
   */
  success: boolean;

  /**
   * Detailed breakdown for each destination printer job.
   */
  jobs: KOTDispatchJobResult[];

  /**
   * Count of successfully printed printer jobs.
   */
  successfulJobs: number;

  /**
   * Count of failed printer jobs.
   */
  failedJobs: number;

  /**
   * Items that could not be routed to any printer (from Phase 3A routing).
   */
  unroutableItems: UnroutableKOTItem[];

  /**
   * Whether the Electron targeted printing IPC was detected and accessible.
   */
  electronAvailable: boolean;

  /**
   * Top-level error description if any part of the dispatch failed.
   */
  error?: {
    code: string;
    message: string;
  } | null;
}

/**
 * Helper to pause execution for a given duration.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes dispatch input into jobs array and unroutable items array.
 */
function extractJobsAndUnroutable(
  input: KOTDispatchInput,
  options?: KOTDispatchOptions
): { jobs: KOTPrintJob[]; unroutableItems: UnroutableKOTItem[] } {
  if (Array.isArray(input)) {
    return {
      jobs: input,
      unroutableItems: options?.unroutableItems || [],
    };
  }

  if ('status' in input && 'jobs' in input && 'unroutableItems' in input) {
    // KOTRoutingResult
    return {
      jobs: input.jobs || [],
      unroutableItems: input.unroutableItems || [],
    };
  }

  if ('jobs' in input) {
    return {
      jobs: input.jobs || [],
      unroutableItems: input.unroutableItems || options?.unroutableItems || [],
    };
  }

  return {
    jobs: [],
    unroutableItems: options?.unroutableItems || [],
  };
}

/**
 * Dispatches KOT print jobs sequentially to their targeted station printers via Electron IPC.
 *
 * Pure Orchestration:
 * 1. Checks Electron printing capability.
 * 2. Pre-validates printer device name and status.
 * 3. Renders isolated station HTML via renderKOTHtml().
 * 4. Invokes window.electronAPI.printTargeted() sequentially with a configured inter-job delay.
 * 5. Isolates failures: a failure on one printer does NOT abort remaining station jobs.
 * 6. Returns complete structured diagnostic information without modifying legacy state.
 */
export async function dispatchKOTPrintJobs(
  input: KOTDispatchInput,
  options?: KOTDispatchOptions
): Promise<KOTDispatchResult> {
  const { jobs, unroutableItems } = extractJobsAndUnroutable(input, options);
  const delayMs = options?.delayBetweenJobsMs ?? DEFAULT_DISPATCH_DELAY_MS;

  // Resolve Electron IPC API: prefer injected option, then window.electronAPI
  const api: ElectronPrintingAPI | undefined =
    options?.electronAPI ??
    (typeof window !== 'undefined' ? (window.electronAPI as ElectronPrintingAPI) : undefined);

  const isElectronAvailable = Boolean(api && typeof api.printTargeted === 'function');

  // If Electron printing is unavailable, immediately return structured failure
  if (!isElectronAvailable) {
    const failedJobResults: KOTDispatchJobResult[] = jobs.map((job) => ({
      jobId: job.jobId,
      printerId: job.printerId,
      printerName: job.printer?.name || 'Station',
      deviceName: job.printer?.device_name || '',
      success: false,
      error: {
        code: 'ELECTRON_PRINTING_UNAVAILABLE',
        message: 'Electron targeted printing API is unavailable in this environment.',
      },
    }));

    return {
      success: false,
      jobs: failedJobResults,
      successfulJobs: 0,
      failedJobs: failedJobResults.length,
      unroutableItems,
      electronAvailable: false,
      error: {
        code: 'ELECTRON_PRINTING_UNAVAILABLE',
        message: 'Electron targeted printing API is unavailable in this environment.',
      },
    };
  }

  // Handle empty job list
  if (jobs.length === 0) {
    return {
      success: unroutableItems.length === 0,
      jobs: [],
      successfulJobs: 0,
      failedJobs: 0,
      unroutableItems,
      electronAvailable: true,
      error:
        unroutableItems.length > 0
          ? {
              code: 'UNROUTABLE_ITEMS_EXIST',
              message: `${unroutableItems.length} item(s) could not be routed to any printer.`,
            }
          : null,
    };
  }

  const jobResults: KOTDispatchJobResult[] = [];

  // Sequential processing loop
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const printer = job.printer;
    const printerName = printer?.name || 'Station';
    const rawDeviceName = printer?.device_name;
    const trimmedDeviceName = typeof rawDeviceName === 'string' ? rawDeviceName.trim() : '';

    // 1. Validation: Printer must be active
    if (printer && printer.is_active === false) {
      jobResults.push({
        jobId: job.jobId,
        printerId: job.printerId,
        printerName,
        deviceName: trimmedDeviceName,
        success: false,
        error: {
          code: 'INACTIVE_PRINTER',
          message: `Target printer "${printerName}" is marked inactive.`,
        },
      });
      continue;
    }

    // 2. Validation: Device name must not be empty
    if (!trimmedDeviceName) {
      jobResults.push({
        jobId: job.jobId,
        printerId: job.printerId,
        printerName,
        deviceName: '',
        success: false,
        error: {
          code: 'EMPTY_DEVICE_NAME',
          message: `Target printer "${printerName}" does not have a configured device_name.`,
        },
      });
      continue;
    }

    // 3. Optional validation against installed OS printers
    if (options?.installedPrinters && options.installedPrinters.length > 0) {
      const match = options.installedPrinters.find(
        (p) =>
          p.name.toLowerCase() === trimmedDeviceName.toLowerCase() ||
          (p.displayName && p.displayName.toLowerCase() === trimmedDeviceName.toLowerCase())
      );
      if (!match) {
        jobResults.push({
          jobId: job.jobId,
          printerId: job.printerId,
          printerName,
          deviceName: trimmedDeviceName,
          success: false,
          error: {
            code: 'PRINTER_NOT_FOUND',
            message: `Printer "${trimmedDeviceName}" was not found in installed operating system printers.`,
          },
        });
        continue;
      }
    }

    // 4. Render HTML for this isolated job
    let html: string;
    try {
      html = renderKOTHtml(job, options?.renderOptions);
    } catch (err: unknown) {
      const renderError = err as Error;
      jobResults.push({
        jobId: job.jobId,
        printerId: job.printerId,
        printerName,
        deviceName: trimmedDeviceName,
        success: false,
        error: {
          code: 'HTML_RENDER_ERROR',
          message: renderError?.message || 'Failed to render isolated KOT HTML.',
        },
      });
      continue;
    }

    // 5. Targeted print dispatch via Electron IPC
    try {
      const ipcResult: TargetedPrintResult = await api!.printTargeted({
        jobId: job.jobId,
        deviceName: trimmedDeviceName,
        html,
      });

      if (ipcResult.success) {
        jobResults.push({
          jobId: job.jobId,
          printerId: job.printerId,
          printerName: job.printer?.name || ipcResult.printerName,
          deviceName: ipcResult.printerName || trimmedDeviceName,
          success: true,
          error: null,
        });
      } else {
        jobResults.push({
          jobId: job.jobId,
          printerId: job.printerId,
          printerName: job.printer?.name || ipcResult.printerName || trimmedDeviceName,
          deviceName: ipcResult.printerName || trimmedDeviceName,
          success: false,
          error: {
            code: (ipcResult.error?.code as KOTDispatchJobError['code']) || 'ELECTRON_PRINT_FAILED',
            message: ipcResult.error?.message || 'Electron print targeted execution failed.',
          },
        });
      }
    } catch (ipcErr: unknown) {
      const err = ipcErr as Error;
      jobResults.push({
        jobId: job.jobId,
        printerId: job.printerId,
        printerName,
        deviceName: trimmedDeviceName,
        success: false,
        error: {
          code: 'ELECTRON_PRINT_FAILED',
          message: err?.message || 'Exception occurred during Electron targeted print IPC invocation.',
        },
      });
    }

    // 6. Sequential dispatch delay between jobs
    if (i < jobs.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const successfulJobs = jobResults.filter((j) => j.success).length;
  const failedJobs = jobResults.filter((j) => !j.success).length;
  const overallSuccess = failedJobs === 0 && unroutableItems.length === 0;

  let topError: { code: string; message: string } | null = null;
  if (failedJobs > 0) {
    topError = {
      code: 'SOME_JOBS_FAILED',
      message: `${failedJobs} of ${jobResults.length} KOT station print job(s) failed.`,
    };
  } else if (unroutableItems.length > 0) {
    topError = {
      code: 'UNROUTABLE_ITEMS_EXIST',
      message: `${unroutableItems.length} item(s) could not be routed to any printer.`,
    };
  }

  return {
    success: overallSuccess,
    jobs: jobResults,
    successfulJobs,
    failedJobs,
    unroutableItems,
    electronAvailable: true,
    error: topError,
  };
}
