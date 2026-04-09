import { Invoice } from '../types';
import { formatCurrency } from './utils';

export const getInvoiceHTML = (invoice: Invoice, business: any) => {
  const theme = business?.invoice_theme || 'gst';
  const themeColor = business?.invoice_theme_color || '#4f46e5';

  const renderSignature = () => {
    if (!business?.esign_url) return '';
    try {
      const data = JSON.parse(business.esign_url);
      if (data.text) {
        return `<div style="font-family: '${data.font || 'Dancing Script'}', cursive; font-size: 32px; color: ${themeColor}; margin-bottom: 8px; line-height: 1;">${data.text}</div>`;
      }
    } catch (e) {
      if (business.esign_url.startsWith('http')) {
        return `<img src="${business.esign_url}" style="height: 50px; margin-bottom: 8px;" />`;
      }
    }
    return '';
  };

  if (theme === 'thermal') {
    return `
      <div style="font-family: 'Courier New', Courier, monospace; width: 280px; padding: 15px; background: white; color: black; font-size: 11px; line-height: 1.4; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 10px;">
          <p style="font-weight: 900; font-size: 14px; margin: 0; text-transform: uppercase;">${business?.business_name}</p>
          <p style="margin: 2px 0;">${business?.address}</p>
          ${business?.gstin ? `<p style="margin: 2px 0;">GSTIN: ${business.gstin}</p>` : ''}
          <p style="margin: 2px 0;">Contact: ${business?.phone}</p>
        </div>
        
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 10px; text-align: center;">
          <p style="font-weight: bold; margin: 0; letter-spacing: 2px;">TAX INVOICE</p>
        </div>
        
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between;">
          <div>
            <p style="margin: 2px 0;">No: ${invoice.invoice_number}</p>
            <p style="margin: 2px 0;">Date: ${new Date(invoice.created_at).toLocaleDateString()}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 2px 0;">Time: ${new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <div style="margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px;">
          <p style="margin: 2px 0; font-weight: bold;">Customer: ${invoice.customer_name}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th style="text-align: left; padding: 4px 0;">Item</th>
              <th style="text-align: center; padding: 4px 0;">Qty</th>
              <th style="text-align: right; padding: 4px 0;">Price</th>
              <th style="text-align: right; padding: 4px 0;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items?.map(item => `
              <tr>
                <td style="padding: 4px 0; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name || item.product_name}</td>
                <td style="text-align: center; padding: 4px 0;">${item.quantity}</td>
                <td style="text-align: right; padding: 4px 0;">${item.price.toFixed(0)}</td>
                <td style="text-align: right; padding: 4px 0;">${item.total.toFixed(0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="border-top: 1px dashed #000; padding-top: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Subtotal:</span>
            <span>${formatCurrency(invoice.subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Tax:</span>
            <span>${formatCurrency(invoice.tax_amount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 8px; border-top: 1px solid #000; padding-top: 8px;">
            <span style="font-weight: 900; font-size: 14px;">GRAND TOTAL:</span>
            <span style="font-weight: 900; font-size: 14px;">${formatCurrency(invoice.total_amount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px;">
            <span>Paid Amount:</span>
            <span>${formatCurrency(invoice.amount_paid || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px; font-size: 10px; font-weight: bold;">
            <span>Balance Due:</span>
            <span>${formatCurrency(Math.max(0, invoice.total_amount - (invoice.amount_paid || 0)))}</span>
          </div>
        </div>
        
        <div style="margin-top: 20px; text-align: center; font-size: 10px;">
          <p style="margin: 0; font-weight: bold;">THANK YOU FOR YOUR BUSINESS!</p>
          <p style="margin: 4px 0;">${business?.invoice_terms || 'No Return, No Exchange'}</p>
          <p style="margin: 10px 0 0 0; font-style: italic;">Powered by BizManager Pro</p>
        </div>
      </div>
    `;
  }

  if (theme === 'modern') {
    return `
      <div style="font-family: 'Inter', sans-serif; width: 794px; min-height: 1123px; padding: 60px; background: white; color: #1e293b; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 80px;">
          <div>
            ${business?.logo_url ? `<img src="${business.logo_url}" style="height: 80px; margin-bottom: 30px; object-fit: contain;" />` : '<div style="height: 60px; width: 60px; background: #0f172a; border-radius: 12px; margin-bottom: 30px;"></div>'}
            <h1 style="font-size: 48px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em;">INVOICE</h1>
            <div style="margin-top: 10px; display: flex; gap: 20px;">
              <p style="color: #64748b; font-size: 14px;">Number: <span style="color: #0f172a; font-weight: 700;">#${invoice.invoice_number}</span></p>
              <p style="color: #64748b; font-size: 14px;">Date: <span style="color: #0f172a; font-weight: 700;">${new Date(invoice.created_at).toLocaleDateString()}</span></p>
            </div>
          </div>
          <div style="text-align: right; max-width: 300px;">
            <p style="font-weight: 900; font-size: 20px; color: #0f172a; margin: 0 0 10px 0;">${business?.business_name}</p>
            <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0;">${business?.address}</p>
            <p style="font-size: 14px; color: #64748b; margin: 5px 0 0 0;">${business?.phone}</p>
            ${business?.gstin ? `<p style="font-size: 14px; color: #64748b; margin: 5px 0 0 0;">GSTIN: ${business.gstin}</p>` : ''}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-bottom: 60px;">
          <div>
            <h3 style="font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 15px;">Billed To</h3>
            <p style="font-size: 20px; font-weight: 900; color: #0f172a; margin: 0 0 5px 0;">${invoice.customer_name}</p>
            <p style="font-size: 15px; color: #64748b; margin: 0;">${invoice.customer_phone || ''}</p>
            <p style="font-size: 15px; color: #64748b; margin: 5px 0 0 0; line-height: 1.5;">${invoice.customer_address || ''}</p>
          </div>
          <div style="text-align: right;">
            <h3 style="font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 15px;">Payment Details</h3>
            <p style="font-size: 15px; color: #64748b; margin: 5px 0;">Method: <span style="color: #0f172a; font-weight: 700;">${invoice.payment_mode?.toUpperCase() || 'N/A'}</span></p>
            <p style="font-size: 15px; color: #64748b; margin: 5px 0;">Status: <span style="color: ${invoice.payment_status === 'paid' ? '#059669' : '#e11d48'}; font-weight: 700;">${invoice.payment_status?.toUpperCase() || 'N/A'}</span></p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 60px;">
          <thead>
            <tr style="border-bottom: 2px solid #0f172a;">
              <th style="text-align: left; padding: 20px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Description</th>
              <th style="text-align: center; padding: 20px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Qty</th>
              <th style="text-align: right; padding: 20px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Rate</th>
              <th style="text-align: right; padding: 20px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items?.map(item => `
              <tr style="border-bottom: 1px solid #f1f5f9; page-break-inside: avoid;">
                <td style="padding: 25px 0;">
                  <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0;">${item.name || item.product_name}</p>
                  ${item.tax_percentage > 0 ? `<p style="font-size: 12px; color: #94a3b8; margin: 5px 0 0 0;">Tax: ${item.tax_percentage}%</p>` : ''}
                </td>
                <td style="text-align: center; padding: 25px 0; font-size: 16px; color: #475569;">${item.quantity}</td>
                <td style="text-align: right; padding: 25px 0; font-size: 16px; color: #475569;">${item.price.toFixed(2)}</td>
                <td style="text-align: right; padding: 25px 0; font-size: 16px; font-weight: 800; color: #0f172a;">${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 80px;">
          <div style="width: 320px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px; color: #64748b;">
              <span>Subtotal</span>
              <span style="color: #0f172a; font-weight: 600;">${formatCurrency(invoice.subtotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 15px; color: #64748b;">
              <span>Tax Amount</span>
              <span style="color: #0f172a; font-weight: 600;">${formatCurrency(invoice.tax_amount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #0f172a; padding-top: 25px;">
              <span style="font-weight: 800; font-size: 18px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Total Amount</span>
              <span style="font-size: 32px; font-weight: 900; color: #0f172a;">${formatCurrency(invoice.total_amount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 15px; font-size: 15px; color: #64748b;">
              <span>Paid Amount</span>
              <span style="color: #059669; font-weight: 600;">${formatCurrency(invoice.amount_paid || 0)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 15px; color: #64748b;">
              <span>Balance Due</span>
              <span style="color: #e11d48; font-weight: 800;">${formatCurrency(Math.max(0, invoice.total_amount - (invoice.amount_paid || 0)))}</span>
            </div>
          </div>
        </div>

        <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #f1f5f9; padding-top: 40px;">
          <div style="max-width: 400px;">
            <h4 style="font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">Notes & Terms</h4>
            <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0;">${business?.invoice_terms || 'Thank you for your business. Please pay within 15 days.'}</p>
            ${business?.instagram_id ? `
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 20px; color: #0f172a; font-weight: 700; font-size: 14px;">
                <span>Follow us: @${business.instagram_id}</span>
              </div>
            ` : ''}
          </div>
          <div style="text-align: right;">
            ${renderSignature()}
            <div style="height: 2px; width: 150px; background: #0f172a; margin: 10px 0 10px auto;"></div>
            <p style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.1em; margin: 0;">Authorized Signatory</p>
          </div>
        </div>
      </div>
    `;
  }

  // Default GST Theme (Tally Style)
  return `
    <div style="font-family: 'Inter', sans-serif; width: 794px; min-height: 1123px; padding: 40px; background: white; color: #000; box-sizing: border-box; border: 1px solid #000;">
      <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px; margin-bottom: 0;">
        <h1 style="font-size: 20px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 2px;">Tax Invoice</h1>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000;">
        <div style="padding: 15px; border-right: 1px solid #000;">
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
            ${business?.logo_url ? `<img src="${business.logo_url}" style="height: 50px;" />` : ''}
            <h2 style="font-size: 18px; font-weight: 900; margin: 0;">${business?.business_name}</h2>
          </div>
          <p style="font-size: 12px; margin: 2px 0; line-height: 1.4;">${business?.address}</p>
          <p style="font-size: 12px; margin: 5px 0;"><b>GSTIN/UIN:</b> ${business?.gstin || 'N/A'}</p>
          <p style="font-size: 12px; margin: 2px 0;"><b>State Name:</b> ${business?.address?.split(',').pop()?.trim() || 'N/A'}</p>
          <p style="font-size: 12px; margin: 2px 0;"><b>Contact:</b> ${business?.phone}</p>
        </div>
        <div style="display: grid; grid-template-rows: 1fr 1fr;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000;">
            <div style="padding: 10px; border-right: 1px solid #000;">
              <p style="font-size: 10px; margin: 0; color: #666;">Invoice No.</p>
              <p style="font-size: 12px; font-weight: 900; margin: 2px 0;">${invoice.invoice_number}</p>
            </div>
            <div style="padding: 10px;">
              <p style="font-size: 10px; margin: 0; color: #666;">Dated</p>
              <p style="font-size: 12px; font-weight: 900; margin: 2px 0;">${new Date(invoice.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr;">
            <div style="padding: 10px; border-right: 1px solid #000;">
              <p style="font-size: 10px; margin: 0; color: #666;">Payment Mode</p>
              <p style="font-size: 12px; font-weight: 900; margin: 2px 0; text-transform: uppercase;">${invoice.payment_mode}</p>
            </div>
            <div style="padding: 10px;">
              <p style="font-size: 10px; margin: 0; color: #666;">Other Reference(s)</p>
              <p style="font-size: 12px; font-weight: 900; margin: 2px 0;">N/A</p>
            </div>
          </div>
        </div>
      </div>

      <div style="padding: 15px; border-bottom: 1px solid #000;">
        <p style="font-size: 10px; margin: 0; color: #666;">Buyer (Bill to)</p>
        <p style="font-size: 14px; font-weight: 900; margin: 5px 0;">${invoice.customer_name}</p>
        <p style="font-size: 12px; margin: 2px 0; line-height: 1.4;">${invoice.customer_address || 'N/A'}</p>
        <p style="font-size: 12px; margin: 5px 0;"><b>GSTIN/UIN:</b> ${invoice.customer_gstin || 'N/A'}</p>
        <p style="font-size: 12px; margin: 2px 0;"><b>Contact:</b> ${invoice.customer_phone || 'N/A'}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; border-bottom: 1px solid #000;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: center; width: 40px;">Sl No.</th>
            <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: left;">Description of Goods</th>
            <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: center; width: 80px;">HSN/SAC</th>
            <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: center; width: 60px;">Quantity</th>
            <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: center; width: 80px;">Rate</th>
            <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: center; width: 40px;">per</th>
            <th style="padding: 8px; font-size: 11px; text-align: right; width: 100px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items?.map((item, i) => `
            <tr style="page-break-inside: avoid;">
              <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; text-align: center; vertical-align: top;">${i + 1}</td>
              <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; vertical-align: top;">
                <p style="font-weight: 700; margin: 0;">${item.name || item.product_name}</p>
              </td>
              <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; text-align: center; vertical-align: top;">N/A</td>
              <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; text-align: center; vertical-align: top;"><b>${item.quantity} Nos</b></td>
              <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; text-align: right; vertical-align: top;">${item.price.toFixed(2)}</td>
              <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; text-align: center; vertical-align: top;">Nos</td>
              <td style="padding: 8px; font-size: 12px; text-align: right; font-weight: 900; vertical-align: top;">${item.total.toFixed(2)}</td>
            </tr>
          `).join('')}
          <!-- Filler rows to maintain height like Tally -->
          ${Array(Math.max(0, 5 - (invoice.items?.length || 0))).fill(0).map(() => `
            <tr>
              <td style="border-right: 1px solid #000; padding: 15px;"></td>
              <td style="border-right: 1px solid #000; padding: 15px;"></td>
              <td style="border-right: 1px solid #000; padding: 15px;"></td>
              <td style="border-right: 1px solid #000; padding: 15px;"></td>
              <td style="border-right: 1px solid #000; padding: 15px;"></td>
              <td style="border-right: 1px solid #000; padding: 15px;"></td>
              <td style="padding: 15px;"></td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top: 1px solid #000;">
            <td colspan="3" style="border-right: 1px solid #000; padding: 8px; text-align: right; font-size: 11px; font-weight: 900;">Total</td>
            <td style="border-right: 1px solid #000; padding: 8px; text-align: center; font-size: 11px; font-weight: 900;">${invoice.items?.reduce((acc, item) => acc + item.quantity, 0)} Nos</td>
            <td style="border-right: 1px solid #000;"></td>
            <td style="border-right: 1px solid #000;"></td>
            <td style="padding: 8px; text-align: right; font-size: 12px; font-weight: 900;">${formatCurrency(invoice.total_amount)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; border-bottom: 1px solid #000;">
        <div style="padding: 15px; border-right: 1px solid #000;">
          <p style="font-size: 11px; margin: 0 0 10px 0;">Amount Chargeable (in words)</p>
          <p style="font-size: 12px; font-weight: 900; margin: 0;">INR ${invoice.total_amount.toLocaleString('en-IN')} Only</p>
          
          <div style="margin-top: 20px;">
            <p style="font-size: 10px; font-weight: 700; text-decoration: underline; margin-bottom: 5px;">Declaration:</p>
            <p style="font-size: 10px; line-height: 1.4; margin: 0;">${business?.invoice_terms || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}</p>
          </div>
        </div>
        <div style="padding: 15px; text-align: right;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
            <span>Subtotal:</span>
            <span>${formatCurrency(invoice.subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 12px;">
            <span>Tax:</span>
            <span>${formatCurrency(invoice.tax_amount)}</span>
          </div>
          <div style="border-top: 1px solid #000; padding-top: 10px;">
            <p style="font-size: 10px; margin: 0; color: #666;">Total Amount</p>
            <p style="font-size: 24px; font-weight: 900; margin: 0;">${formatCurrency(invoice.total_amount)}</p>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px;">
            <span>Paid Amount:</span>
            <span style="font-weight: 700;">${formatCurrency(invoice.amount_paid || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px;">
            <span>Balance Due:</span>
            <span style="font-weight: 900; color: #e11d48;">${formatCurrency(Math.max(0, invoice.total_amount - (invoice.amount_paid || 0)))}</span>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr;">
        <div style="padding: 15px; border-right: 1px solid #000;">
          ${business?.instagram_id ? `
            <p style="font-size: 10px; color: #666; margin-bottom: 5px;">Follow Us</p>
            <p style="font-size: 14px; font-weight: 900; margin: 0;">@${business.instagram_id}</p>
          ` : ''}
        </div>
        <div style="padding: 15px; text-align: right;">
          <p style="font-size: 11px; margin: 0 0 40px 0;">for <b>${business?.business_name}</b></p>
          ${renderSignature()}
          <p style="font-size: 11px; font-weight: 900; margin: 0; text-transform: uppercase;">Authorised Signatory</p>
        </div>
      </div>
      
      <div style="text-align: center; padding: 10px; border-top: 1px solid #000; font-size: 10px; color: #666;">
        SUBJECT TO LOCAL JURISDICTION
      </div>
    </div>
  `;
};
