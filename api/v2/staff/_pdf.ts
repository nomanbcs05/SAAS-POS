import { supabaseServer } from './_db';

export interface VoucherPDFData {
  voucher_no: string;
  restaurant_name: string;
  employee_name: string;
  employee_role: string;
  cnic?: string;
  bank_account?: string;
  month: string;
  base_salary: number;
  present_days: number;
  absent_days: number;
  bonus: number;
  advances: number;
  deductions: number;
  net_salary: number;
  created_at: string;
}

/**
 * Generates an HTML/SVG printable voucher document and saves it to Vercel Blob
 * (or Supabase Storage as fallback) and returns the public URL.
 */
export async function generateAndUploadVoucherPDF(data: VoucherPDFData, restaurantId: string): Promise<string> {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Salary Voucher - ${data.voucher_no}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px;
      color: #1e293b;
      background: #ffffff;
    }
    .voucher-card {
      max-width: 600px;
      margin: 0 auto;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .restaurant-title {
      font-size: 24px;
      font-weight: 800;
      text-transform: uppercase;
      margin: 0 0 4px 0;
      color: #0f172a;
    }
    .voucher-tag {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
      font-size: 13px;
    }
    .label {
      color: #64748b;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .value {
      font-weight: 700;
      color: #0f172a;
    }
    .table-section {
      margin: 20px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background: #f8fafc;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid #cbd5e1;
      font-size: 11px;
      text-transform: uppercase;
      color: #475569;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .text-right {
      text-align: right;
    }
    .net-salary-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
    }
    .net-salary-label {
      font-size: 14px;
      font-weight: 700;
      color: #166534;
      text-transform: uppercase;
    }
    .net-salary-value {
      font-size: 22px;
      font-weight: 900;
      color: #15803d;
    }
    .signatures {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      padding-top: 8px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="voucher-card">
    <div class="header">
      <h1 class="restaurant-title">${data.restaurant_name}</h1>
      <span class="voucher-tag">Official Salary Payment Voucher</span>
    </div>

    <div class="grid">
      <div>
        <div class="label">Voucher No</div>
        <div class="value">${data.voucher_no}</div>
      </div>
      <div style="text-align: right;">
        <div class="label">Payroll Month</div>
        <div class="value">${data.month}</div>
      </div>
      <div>
        <div class="label">Employee Name</div>
        <div class="value">${data.employee_name}</div>
      </div>
      <div style="text-align: right;">
        <div class="label">Designation / Role</div>
        <div class="value" style="text-transform: capitalize;">${data.employee_role}</div>
      </div>
      ${data.cnic ? `<div><div class="label">CNIC / ID</div><div class="value">${data.cnic}</div></div>` : ''}
      ${data.bank_account ? `<div style="text-align: right;"><div class="label">Bank Account</div><div class="value">${data.bank_account}</div></div>` : ''}
    </div>

    <div class="table-section">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Details</th>
            <th class="text-right">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Base Salary</strong></td>
            <td class="text-right">-</td>
            <td class="text-right">Rs ${Number(data.base_salary).toLocaleString()}</td>
          </tr>
          <tr>
            <td>Attendance Calculation</td>
            <td class="text-right">${data.present_days} Present / ${data.absent_days} Absent</td>
            <td class="text-right">-</td>
          </tr>
          <tr>
            <td>Bonus / Incentives</td>
            <td class="text-right">Addition</td>
            <td class="text-right">+ Rs ${Number(data.bonus || 0).toLocaleString()}</td>
          </tr>
          <tr>
            <td>Salary Advances Deducted</td>
            <td class="text-right">Advance recovery</td>
            <td class="text-right" style="color: #b91c1c;">- Rs ${Number(data.advances || 0).toLocaleString()}</td>
          </tr>
          <tr>
            <td>Absent / Other Deductions</td>
            <td class="text-right">Deduction</td>
            <td class="text-right" style="color: #b91c1c;">- Rs ${Number(data.deductions || 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="net-salary-box">
      <span class="net-salary-label">Net Payable Salary</span>
      <span class="net-salary-value">Rs ${Number(data.net_salary).toLocaleString()}</span>
    </div>

    <div class="signatures">
      <div>
        <div style="height: 35px;"></div>
        <div class="sig-line">Employee Signature</div>
      </div>
      <div>
        <div style="height: 35px;"></div>
        <div class="sig-line">Authorized Manager Signature</div>
      </div>
    </div>

    <div class="footer">
      Generated automatically by GenX Cloud POS System on ${new Date().toLocaleDateString('en-PK')}
    </div>
  </div>
</body>
</html>
  `;

  const fileName = `vouchers/${restaurantId}/${data.month}/${data.voucher_no}.html`;

  // 1. Try Vercel Blob if @vercel/blob token is provided in environment
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob');
      const blob = await put(fileName, Buffer.from(htmlContent, 'utf-8'), {
        access: 'public',
        contentType: 'text/html',
      });
      return blob.url;
    }
  } catch (blobErr) {
    console.warn('[PDF/Blob] Vercel Blob upload skipped or failed, falling back to Supabase storage:', blobErr);
  }

  // 2. Fallback to Supabase Storage bucket ('salary_vouchers')
  try {
    const { data: uploadData, error: uploadErr } = await supabaseServer.storage
      .from('salary_vouchers')
      .upload(fileName, Buffer.from(htmlContent, 'utf-8'), {
        contentType: 'text/html',
        upsert: true,
      });

    if (!uploadErr && uploadData) {
      const { data: publicUrlData } = supabaseServer.storage
        .from('salary_vouchers')
        .getPublicUrl(fileName);

      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (storageErr) {
    console.warn('[PDF/Storage] Supabase storage upload fallback:', storageErr);
  }

  // 3. Fallback to self-contained Base64 Data URI if storage services are unreachable
  const base64Html = Buffer.from(htmlContent).toString('base64');
  return `data:text/html;base64,${base64Html}`;
}
