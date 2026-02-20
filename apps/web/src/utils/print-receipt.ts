export interface ReceiptItem {
  name: string;
  sku: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
  cardLast4?: string | null;
  cardType?: string | null;
}

export interface ReceiptData {
  receiptNumber: string;
  saleDate: Date | string;
  locationName?: string | null;
  employeeName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeGiven: number;
  notes?: string | null;
}

export function formatPaymentMethod(method: string): string {
  return method
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString();
}

function buildReceiptHtml(data: ReceiptData): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:2px 0">
          ${item.name}${item.variantName ? ` (${item.variantName})` : ""}
          <br><span style="font-size:11px;color:#666">${item.sku} x${item.quantity} @ $${item.unitPrice.toFixed(2)}</span>
        </td>
        <td style="padding:2px 0;text-align:right;white-space:nowrap">$${item.totalPrice.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const paymentRows = data.payments
    .map((p) => {
      const label = formatPaymentMethod(p.method);
      const detail = p.cardLast4 ? ` ****${p.cardLast4}` : "";
      return `
      <div style="display:flex;justify-content:space-between">
        <span>${label}${detail}</span>
        <span>$${p.amount.toFixed(2)}</span>
      </div>`;
    })
    .join("");

  const customerSection = data.customerName
    ? `
      <div style="border-top:1px dashed #999;margin:8px 0;padding-top:8px">
        <div><strong>Customer:</strong> ${data.customerName}</div>
        ${data.customerEmail ? `<div>${data.customerEmail}</div>` : ""}
        ${data.customerPhone ? `<div>${data.customerPhone}</div>` : ""}
      </div>`
    : "";

  const discountRow =
    data.discountAmount > 0
      ? `<div style="display:flex;justify-content:space-between;color:#c00">
          <span>Discount</span>
          <span>-$${data.discountAmount.toFixed(2)}</span>
        </div>`
      : "";

  const changeRow =
    data.changeGiven > 0
      ? `<div style="display:flex;justify-content:space-between">
          <span>Change</span>
          <span>$${data.changeGiven.toFixed(2)}</span>
        </div>`
      : "";

  const notesSection = data.notes
    ? `
      <div style="border-top:1px dashed #999;margin:8px 0;padding-top:8px;font-size:12px">
        <strong>Notes:</strong> ${data.notes}
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${data.receiptNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #000;
      background: #fff;
    }
    .receipt {
      max-width: 320px;
      margin: 0 auto;
      padding: 16px 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body { padding: 0; }
      .receipt { padding: 8px 4px; }
    }
  </style>
</head>
<body>
<div class="receipt">
  <div style="text-align:center;margin-bottom:8px">
    ${data.locationName ? `<div style="font-size:16px;font-weight:bold">${data.locationName}</div>` : ""}
    <div style="font-size:18px;font-weight:bold;margin:4px 0">RECEIPT</div>
  </div>

  <div style="border-top:1px dashed #999;margin:8px 0;padding-top:8px">
    <div style="display:flex;justify-content:space-between">
      <span>Receipt #:</span>
      <span>${data.receiptNumber}</span>
    </div>
    <div style="display:flex;justify-content:space-between">
      <span>Date:</span>
      <span>${formatDate(data.saleDate)}</span>
    </div>
    ${data.employeeName ? `<div style="display:flex;justify-content:space-between"><span>Cashier:</span><span>${data.employeeName}</span></div>` : ""}
  </div>

  ${customerSection}

  <div style="border-top:1px dashed #999;margin:8px 0;padding-top:8px">
    <table>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <div style="border-top:1px dashed #999;margin:8px 0;padding-top:8px">
    <div style="display:flex;justify-content:space-between">
      <span>Subtotal</span>
      <span>$${data.subtotal.toFixed(2)}</span>
    </div>
    ${discountRow}
    <div style="display:flex;justify-content:space-between">
      <span>Tax</span>
      <span>$${data.taxAmount.toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;border-top:1px dashed #999;margin-top:4px;padding-top:4px">
      <span>TOTAL</span>
      <span>$${data.totalAmount.toFixed(2)}</span>
    </div>
  </div>

  <div style="border-top:1px dashed #999;margin:8px 0;padding-top:8px">
    ${paymentRows}
    ${changeRow}
  </div>

  ${notesSection}

  <div style="border-top:1px dashed #999;margin:12px 0 0;padding-top:8px;text-align:center">
    <div style="font-size:14px;font-weight:bold">Thank You!</div>
    <div style="font-size:11px;color:#666;margin-top:4px">Please keep this receipt for your records.</div>
  </div>
</div>
</body>
</html>`;
}

export function printReceipt(data: ReceiptData): void {
  const win = window.open("", "_blank", "width=420,height=700");
  if (!win) {
    return;
  }

  win.document.write(buildReceiptHtml(data));
  win.document.close();

  win.addEventListener("load", () => {
    win.print();
  });

  win.addEventListener("afterprint", () => {
    win.close();
  });
}
