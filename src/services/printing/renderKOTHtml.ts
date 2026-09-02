import { KOTPrintJob, RoutedKOTItem, PrintableKOTItem } from './kotRoutingTypes';

/**
 * Escapes unsafe characters for safe embedding in HTML.
 * Prevents any XSS or markup injection from user/product/customer input.
 */
export function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) {
    return '';
  }
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats a table identifier into standard POS uppercase display.
 */
function formatTableDisplay(tableId: string | number | null | undefined): string {
  if (!tableId) return '';
  const str = String(tableId).trim();
  if (
    str.toUpperCase().startsWith('T') ||
    str.toUpperCase().startsWith('O') ||
    str.toUpperCase().startsWith('V')
  ) {
    return str.toUpperCase();
  }
  return `TABLE ${str}`;
}

/**
 * Formats a date into standard POS timestamp: "YYYY-MM-DD HH:mm".
 */
function formatTimestamp(dateVal: Date | string | undefined): string {
  try {
    const d = dateVal ? (dateVal instanceof Date ? dateVal : new Date(dateVal)) : new Date();
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 16).replace('T', ' ');
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return '';
  }
}

/**
 * Extracts a display name from a printable item.
 */
function getItemName(item: PrintableKOTItem): string {
  return (
    item.product?.name ||
    item.product_name ||
    item.name ||
    'Item'
  );
}

/**
 * Formats quantity as integer or 2 decimal places.
 */
function formatQuantity(qty: number | undefined): string {
  const q = qty ?? 1;
  return q % 1 === 0 ? String(q) : q.toFixed(2);
}

export interface RenderKOTHtmlOptions {
  /** Explicit override to mark ticket as duplicate */
  isDuplicate?: boolean;
}

/**
 * Pure, self-contained HTML renderer for a targeted KOT print job.
 *
 * Characteristics:
 * - Standalone HTML string with complete print-safe inline CSS.
 * - Suitable for Electron offscreen printing and 80mm thermal receipt hardware.
 * - Zero external stylesheets, remote fonts, or network URLs.
 * - Strict HTML escaping on all dynamic data.
 * - Renders ONLY the items assigned to this specific printer job.
 * - Fully reproduces the operational visual hierarchy of KOT.tsx.
 */
export function renderKOTHtml(
  job: KOTPrintJob,
  options?: RenderKOTHtmlOptions
): string {
  if (!job || !job.items || job.items.length === 0) {
    throw new Error('Cannot render KOT HTML for an empty print job.');
  }

  const { orderContext, printer } = job;
  const isDuplicate = options?.isDuplicate ?? orderContext.isDuplicate ?? false;
  const isRevision =
    orderContext.isRevision === true ||
    (orderContext.revisionNumber !== undefined && orderContext.revisionNumber > 1);
  const revisionNum = orderContext.revisionNumber ?? 2;

  const orderNum = orderContext.orderNumber || '00';
  const orderTypeDisplay = (orderContext.orderType || 'dine_in').replace(/_/g, ' ').toUpperCase();
  const tableDisplay = formatTableDisplay(orderContext.tableId);
  const timeDisplay = formatTimestamp(orderContext.createdAt);
  const serverClean = orderContext.serverName
    ? orderContext.serverName.replace(/^\[.*?\]\s*/, '')
    : null;
  const customerName = orderContext.customer?.name || null;
  const riderName =
    orderContext.orderType === 'delivery' && orderContext.rider?.name
      ? orderContext.rider.name
      : null;
  const printerName = printer.name || 'Station';

  // Render individual item rows
  const itemRowsHtml = job.items
    .map((routedItem: RoutedKOTItem, idx: number) => {
      const it = routedItem.item;
      const qtyStr = formatQuantity(it.quantity);
      const nameStr = escapeHtml(getItemName(it));
      const measureLabel = it.qtyMeasureLabel
        ? `<div class="measure-label">(${escapeHtml(it.qtyMeasureLabel)})</div>`
        : '';
      const notes = it.notes || it.specialInstructions
        ? `<div class="item-notes">* ${escapeHtml(it.notes || it.specialInstructions)}</div>`
        : '';

      return `
        <tr class="item-row" key="item-${idx}">
          <td class="qty-col">${qtyStr}</td>
          <td class="name-col">
            <div class="item-name">${nameStr}</div>
            ${measureLabel}
            ${notes}
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KOT-${escapeHtml(orderNum)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: monospace, "Courier New", Courier, monospace;
      font-size: 14px;
      line-height: 1.25;
    }
    .receipt-container {
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 14px 10px;
      background: #ffffff;
      color: #000000;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    
    /* Duplicate Badge */
    .duplicate-badge {
      display: inline-block;
      border: 4px solid #000000;
      font-weight: 900;
      font-size: 18px;
      padding: 3px 12px;
      margin-bottom: 8px;
      transform: rotate(-2deg);
    }

    /* Main Header Box */
    .header-box {
      border: 4px solid #000000;
      padding: 6px 8px;
      display: inline-block;
      font-weight: 900;
      font-size: 20px;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin: 0 auto 6px auto;
    }

    .station-badge {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
      margin-bottom: 8px;
    }

    /* Meta Banner */
    .meta-section {
      border-bottom: 4px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .order-type-badge {
      display: inline-block;
      border: 2px solid #000000;
      padding: 2px 6px;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .order-type-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4px;
    }
    .order-number-title {
      font-size: 18px;
      font-weight: 900;
    }

    /* Table Box */
    .table-box {
      background: #000000;
      color: #ffffff;
      text-align: center;
      padding: 6px 10px;
      border-radius: 4px;
      font-weight: 900;
      font-size: 24px;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 6px;
      margin-bottom: 6px;
    }

    .meta-details {
      margin-top: 8px;
      font-size: 14px;
      font-weight: 800;
    }
    .meta-line {
      margin: 2px 0;
    }

    /* Revision Separator */
    .revision-separator {
      margin: 10px 0;
      text-align: center;
    }
    .dashed-line {
      border-top: 4px dashed #000000;
      margin: 4px 0;
    }
    .revision-sep-text {
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 4px 0;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-weight: 900;
      margin-top: 4px;
    }
    .table-head {
      border-bottom: 2px solid #000000;
      font-size: 16px;
      font-weight: 900;
    }
    .table-head th {
      padding: 4px 0;
      text-align: left;
    }
    .qty-col {
      width: 48px;
      vertical-align: top;
      font-size: 20px;
      font-weight: 900;
      padding: 6px 6px 6px 0;
      line-height: 1.15;
    }
    .name-col {
      vertical-align: top;
      padding: 6px 0;
    }
    .item-row {
      border-bottom: 1px solid rgba(0, 0, 0, 0.25);
    }
    .item-name {
      font-size: 20px;
      font-weight: 900;
      line-height: 1.15;
    }
    .measure-label {
      font-size: 13px;
      font-weight: 800;
      font-style: italic;
      margin-top: 2px;
    }
    .item-notes {
      font-size: 12px;
      font-weight: 700;
      font-style: italic;
      margin-top: 2px;
    }

    /* Footer */
    .bottom-divider {
      border-top: 4px solid #000000;
      margin: 14px 0 8px 0;
    }
    .footer-text {
      font-weight: 900;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 4px 0;
    }
    .footer-station {
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      margin: 2px 0;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    ${
      isDuplicate
        ? `<div class="text-center">
             <div class="duplicate-badge">*** DUPLICATE ***</div>
           </div>`
        : ''
    }

    <!-- Main Header Box -->
    <div class="text-center">
      <div class="header-box">
        ${
          isRevision
            ? `KOT REVISION #${escapeHtml(revisionNum)}`
            : 'KITCHEN TICKET'
        }
      </div>
      <div class="station-badge">
        STATION: ${escapeHtml(printerName)}
      </div>
    </div>

    <!-- Meta Banner -->
    <div class="meta-section">
      <div class="order-type-row">
        <span class="order-number-title">ORDER #${escapeHtml(orderNum)}</span>
        <span class="order-type-badge">${escapeHtml(orderTypeDisplay)}</span>
      </div>

      ${
        tableDisplay
          ? `<div class="table-box">${escapeHtml(tableDisplay)}</div>`
          : ''
      }

      <div class="meta-details">
        ${timeDisplay ? `<div class="meta-line">Time: ${escapeHtml(timeDisplay)}</div>` : ''}
        ${serverClean ? `<div class="meta-line">Server: ${escapeHtml(serverClean)}</div>` : ''}
        ${customerName ? `<div class="meta-line">Customer: ${escapeHtml(customerName)}</div>` : ''}
        ${riderName ? `<div class="meta-line">Rider: ${escapeHtml(riderName)}</div>` : ''}
        ${
          orderContext.notes
            ? `<div class="meta-line">Note: ${escapeHtml(orderContext.notes)}</div>`
            : ''
        }
      </div>
    </div>

    <!-- Revision Separator (If Revision) -->
    ${
      isRevision
        ? `<div class="revision-separator">
             <div class="dashed-line"></div>
             <div class="revision-sep-text">── ADD ITEMS BELOW ──</div>
             <div class="dashed-line"></div>
           </div>`
        : ''
    }

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr class="table-head">
          <th style="width: 48px;">Qty</th>
          <th>Item</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
      </tbody>
    </table>

    <!-- Bottom Divider -->
    <div class="bottom-divider"></div>

    <!-- Footer Copy Notice -->
    <div class="text-center">
      <div class="footer-text">
        ${
          isRevision
            ? `*** KOT EDIT #${escapeHtml(revisionNum)} COPY ***`
            : '*** KITCHEN COPY ***'
        }
      </div>
      <div class="footer-station">
        *** ${escapeHtml(printerName)} ***
      </div>
    </div>
  </div>
</body>
</html>`;
}
