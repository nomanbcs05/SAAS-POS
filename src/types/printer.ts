export type PrinterType = 'system' | 'usb' | 'network' | 'bluetooth';

export interface TenantPrinter {
  id: string;
  tenant_id: string;
  name: string;
  printer_type: PrinterType;
  device_name?: string | null;
  ip_address?: string | null;
  port?: number | null;
  bluetooth_identifier?: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PrinterCategoryRoute {
  id: string;
  tenant_id: string;
  category_name: string; // Canonical normalized category name (e.g. 'karahi', 'beverages')
  printer_id: string;
  printer?: TenantPrinter;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePrinterInput {
  tenant_id: string;
  name: string;
  printer_type: PrinterType;
  device_name?: string | null;
  ip_address?: string | null;
  port?: number | null;
  bluetooth_identifier?: string | null;
  is_default?: boolean;
  is_active?: boolean;
}

export interface UpdatePrinterInput {
  name?: string;
  printer_type?: PrinterType;
  device_name?: string | null;
  ip_address?: string | null;
  port?: number | null;
  bluetooth_identifier?: string | null;
  is_default?: boolean;
  is_active?: boolean;
}

export interface CreatePrinterRouteInput {
  tenant_id: string;
  category_name: string;
  printer_id: string;
}
