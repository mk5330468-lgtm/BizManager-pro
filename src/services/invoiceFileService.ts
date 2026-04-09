import { Invoice } from '../types';
import { supabaseService } from './supabaseService';
import { generateInvoicePDF, generateInvoicePNG } from '../lib/pdf';

export const invoiceFileService = {
  async generateAndUploadFiles(invoice: Invoice, businessId: string | number) {
    try {
      // 1. Generate PDF Blob
      console.log('Generating PDF for invoice:', invoice.invoice_number);
      const pdfBlob = await generateInvoicePDF(invoice, 'blob') as Blob;
      console.log('PDF generated, size:', pdfBlob.size);
      
      if (pdfBlob.size < 1000) {
        console.warn('Generated PDF seems too small, might be blank:', pdfBlob.size);
      }

      // 2. Generate PNG Blob
      const business = await supabaseService.getBusiness();
      const pngBlob = await generateInvoicePNG(invoice, business);
      console.log('PNG generated, size:', pngBlob.size);

      // 3. Upload to Supabase
      const pdfPath = `${businessId}/Invoice_${invoice.invoice_number}.pdf`;
      const pngPath = `${businessId}/Invoice_${invoice.invoice_number}.png`;

      console.log('Uploading files to storage:', { pdfPath, pngPath });

      await Promise.all([
        supabaseService.uploadFile('invoices', pdfPath, pdfBlob),
        supabaseService.uploadFile('invoices', pngPath, pngBlob)
      ]);

      console.log('Upload successful');

      const pdfUrl = await supabaseService.getFileUrl('invoices', pdfPath);
      const pdfSize = pdfBlob.size;
      const pngSize = pngBlob.size;

      return { pdfPath, pngPath, pdfUrl, pdfSize, pngSize };
    } catch (error) {
      console.error('Error in generateAndUploadFiles:', error);
      throw error;
    }
  },
};
