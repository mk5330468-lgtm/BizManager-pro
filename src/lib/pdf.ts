import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import html2pdf from 'html2pdf.js';
import { Invoice } from '../types';
import { formatCurrency, formatDate, numberToWords, safeJson } from './utils';
import { supabaseService } from '../services/supabaseService';
import { getInvoiceHTML } from './invoiceTemplates';

export const generateInvoicePDFFromHTML = async (invoice: Invoice, business: any): Promise<Blob> => {
  const element = document.createElement('div');
  element.style.position = 'absolute';
  element.style.left = '-9999px';
  element.style.top = '-9999px';
  element.style.width = '750px'; // Match the template width
  element.innerHTML = getInvoiceHTML(invoice, business);
  document.body.appendChild(element);

  try {
    // Add delay for rendering
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 750,
      windowWidth: 750,
      scrollX: 0,
      scrollY: 0,
      logging: true
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    const blob = pdf.output('blob');
    
    console.log('PDF Blob generated from HTML, size:', blob.size);
    document.body.removeChild(element);
    return blob;
  } catch (error) {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    console.error('Error generating PDF from HTML:', error);
    throw error;
  }
};

export const generateInvoicePNG = async (invoice: Invoice, business: any): Promise<Blob> => {
  const element = document.createElement('div');
  element.style.position = 'absolute';
  element.style.left = '-9999px';
  element.style.top = '-9999px';
  
  const width = business?.invoice_theme === 'thermal' ? '280px' : '794px';
  element.style.width = width;
  element.innerHTML = getInvoiceHTML(invoice, business);
  document.body.appendChild(element);

  try {
    // Add delay for rendering
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: parseInt(width),
      windowWidth: parseInt(width),
      scrollX: 0,
      scrollY: 0
    });
    document.body.removeChild(element);
    
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          console.log('PNG generated, size:', blob.size);
          resolve(blob);
        }
        else reject(new Error('Failed to generate PNG blob'));
      }, 'image/png');
    });
  } catch (error) {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    console.error('Error generating PNG:', error);
    throw error;
  }
};

export const generateInvoicePDF = async (invoice: Invoice, action: 'download' | 'print' | 'blob' = 'download') => {
  // Fetch business settings
  let business: any = {};
  try {
    business = await supabaseService.getBusiness();
  } catch (error) {
    console.error("Failed to fetch business settings:", error);
  }

  const theme = business.invoice_theme || 'gst';
  
  // If items are not provided, fetch them
  let items = invoice.items;
  if (!items || items.length === 0) {
    try {
      items = await supabaseService.getInvoiceItems(invoice.id);
      invoice.items = items;
    } catch (error) {
      console.error("Failed to fetch invoice items:", error);
      items = [];
    }
  }

  // Create a container that is technically "visible" but moved out of view
  // This helps mobile browsers prioritize rendering it
  const container = document.createElement('div');
  container.id = 'pdf-gen-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = theme === 'thermal' ? '300px' : '850px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '9999';
  container.style.visibility = 'visible';
  
  const element = document.createElement('div');
  element.style.width = theme === 'thermal' ? '280px' : '794px';
  element.style.backgroundColor = '#ffffff';
  element.style.padding = '0';
  element.style.margin = '0';
  
  const fontImport = `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Dancing+Script:wght@400;700&display=swap');</style>`;
  element.innerHTML = fontImport + getInvoiceHTML(invoice, business);
  
  container.appendChild(element);
  document.body.appendChild(container);

  try {
    // Wait for fonts and images
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Explicitly wait for images to load
    const images = element.getElementsByTagName('img');
    const imagePromises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    await Promise.all(imagePromises);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: true,
      width: element.offsetWidth,
      height: element.offsetHeight,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById('pdf-gen-container');
        if (clonedEl) {
          clonedEl.style.left = '0';
          clonedEl.style.visibility = 'visible';
        }
      }
    });

    // Check if canvas is blank
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let isBlank = true;
      // Sample some pixels to see if they are all white/transparent
      for (let i = 0; i < pixelData.length; i += 400) { // Sample every 100th pixel
        if (pixelData[i] !== 255 || pixelData[i+1] !== 255 || pixelData[i+2] !== 255) {
          isBlank = false;
          break;
        }
      }
      if (isBlank) {
        console.warn('Canvas appears blank, retrying with different settings...');
        // Retry once with lower scale and different positioning
        container.style.left = '0';
        container.style.opacity = '0.01';
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: theme === 'thermal' ? [80, 250] : 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    if (action === 'download') {
      pdf.save(`Invoice_${invoice.invoice_number}.pdf`);
    } else if (action === 'print') {
      window.open(pdf.output('bloburl'), '_blank');
    } else if (action === 'blob') {
      const blob = pdf.output('blob');
      console.log('PDF Blob generated, size:', blob.size);
      return blob;
    }

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
};
