import type { WindowItem, GlobalFormData } from "@/types/window-item"
import { formatMeasurement } from "./measurements"
import { generateAnnotatedImage } from "./pdf-drawing"
import type { FormConfig, FormField } from "@/types/form-config"
import { toast } from "@/components/ui/use-toast"; // Import toast

export async function generatePDF(windows: WindowItem[], globalFormData: GlobalFormData, formConfig: FormConfig): Promise<void> {
  try {
    const logoSvg = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="#1e40af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 7L12 12L22 7" stroke="#1e40af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 12V22" stroke="#1e40af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    // Generate all annotated images in parallel
    const annotatedImageSrcs = await Promise.all(windows.map(async (window) => {
      try {
        const src = await generateAnnotatedImage(window);
        if (!src) {
          console.warn(`PDF Generator: No annotated image generated for window ${window.lineNumber}.`);
        }
        return src;
      } catch (imageGenError) {
        console.error(`PDF Generator: Error generating annotated image for window ${window.lineNumber}:`, imageGenError);
        toast({
          title: "PDF Generation Warning",
          description: `Could not generate image for window ${window.lineNumber}. PDF will be incomplete.`,
          variant: "destructive",
        });
        return ''; // Ensure it's empty if generation fails
      }
    }));

    let windowCardsHtml = "";
    windows.forEach((window, index) => {
      const annotatedImageSrc = annotatedImageSrcs[index]; // Get the pre-generated image src
      
      // Get all fields from line item sections for this window
      const lineItemFields = formConfig.sections
        .filter(section => section.isLineItemSection !== false) // Default is true
        .flatMap(section => section.rows.flatMap(row => row.fields));

      const details = lineItemFields
        .filter(field => field.id !== 'location' && field.id !== 'windowNumber' && field.id !== 'product' && field.id !== 'width' && field.id !== 'height' && field.id !== 'depth' && field.id !== 'image' && field.id !== 'annotations' && field.id !== 'wizardImage' && field.id !== 'wizardMeasurements' && field.id !== 'wizardWindowBounds' && field.id !== 'notes' && field.id !== 'signature' && field.id !== 'uploadedFiles') // Exclude fields already handled or internal
        .map(field => {
          let value = window[field.id];
          if (value === undefined || value === null || value === '') return null; // Skip empty values

          if (field.type === 'toggle') {
            value = value ? 'Yes' : 'No';
          } else if (field.type === 'date') {
            value = new Date(value).toLocaleDateString();
          } else if (field.type === 'number') {
            value = formatMeasurement(value) + '"';
          } else if (field.type === 'fileUpload') {
            value = (value as any[]).map(f => f.name).join(', ');
          } else if (field.type === 'signature') {
            // Signatures are handled separately below
            return null;
          }

          return {
            label: field.name,
            value: String(value),
            fullWidth: field.type === 'textarea',
            capitalize: field.type === 'picklist' || field.type === 'radio' || field.id === 'mountType', // Example capitalization
          };
        })
        .filter(Boolean); // Remove nulls

      const wizardWidths = window.wizardMeasurements?.widths;
      const wizardHeights = window.wizardMeasurements?.heights;

      // New: Signature and Uploaded Files for PDF
      const signatureHtml = window.signature ? `<div class="signature-section"><p>Signature:</p><img src="${window.signature}" alt="Signature" class="signature-image" /></div>` : '';
      const uploadedFilesHtml = window.uploadedFiles && window.uploadedFiles.length > 0 ? `
        <div class="uploaded-files-section">
          <p>Uploaded Files:</p>
          <ul>
            ${window.uploadedFiles.map(file => `<li>${file.name}</li>`).join('')}
          </ul>
        </div>
      ` : '';

      windowCardsHtml += `
        <div class="window-card">
          <div class="window-header">
            <span>Line #${window.lineNumber}: ${window.location || 'N/A'}</span>
            <span class="window-tag">${window.windowNumber || ''}</span>
          </div>
          <div class="window-content">
            <div class="window-image">
              ${annotatedImageSrc ? `<img src="${annotatedImageSrc}" alt="Annotated image for window ${window.lineNumber}" />` : '<div class="no-image">No Image Available</div>'}
            </div>
            <div class="window-details">
              <div class="measurements-grid">
                <div class="measurement-box">
                  <div class="label">Width</div>
                  <div class="value">${formatMeasurement(window.width)}"</div>
                </div>
                <div class="measurement-box">
                  <div class="label">Height</div>
                  <div class="value">${formatMeasurement(window.height)}"</div>
                </div>
                <div class="measurement-box">
                  <div class="label">Depth</div>
                  <div class="value">${formatMeasurement(window.depth)}"</div>
                </div>
              </div>
              ${(wizardWidths || wizardHeights) ? `
              <div class="wizard-measurements">
                <div class="wizard-title">Wizard Measurements</div>
                <div class="wizard-grid">
                  ${wizardWidths ? `<div>W: ${formatMeasurement(wizardWidths.T)} | ${formatMeasurement(wizardWidths.M)} | ${formatMeasurement(wizardWidths.B)}</div>` : ''}
                  ${wizardHeights ? `<div>H: ${formatMeasurement(wizardHeights.L)} | ${formatMeasurement(wizardHeights.C)} | ${formatMeasurement(wizardHeights.R)}</div>` : ''}
                </div>
              </div>
              ` : ''}
              ${details.length > 0 ? `
              <table class="details-table">
                ${details.map(d => `
                  <tr ${d.fullWidth ? 'class="full-width"' : ''}>
                    <td>${d.label}</td>
                    <td ${d.fullWidth ? 'colspan="1"' : ''}>${d.capitalize ? d.value.charAt(0).toUpperCase() + d.value.slice(1) : d.value}</td>
                  </tr>
                `).join('')}
              </table>
              ` : ''}
              ${signatureHtml}
              ${uploadedFilesHtml}
            </div>
          </div>
        </div>
      `;
    });

    let globalFieldsHtml = "";
    const globalSections = formConfig.sections.filter(section => section.isLineItemSection === false);
    if (globalSections.length > 0) {
      globalFieldsHtml += `<div class="global-fields-section"><h2>Global Information</h2>`;
      globalSections.forEach(section => {
        if (section.label) {
          globalFieldsHtml += `<h3>${section.label}</h3>`;
        }
        globalFieldsHtml += `<table class="details-table">`;
        section.rows.forEach(row => {
          row.fields.forEach(field => {
            let value = globalFormData[field.id];
            if (value === undefined || value === null || value === '') return;

            if (field.type === 'toggle') {
              value = value ? 'Yes' : 'No';
            } else if (field.type === 'date') {
              value = new Date(value).toLocaleDateString();
            } else if (field.type === 'number') {
              value = formatMeasurement(value) + '"';
            } else if (field.type === 'fileUpload') {
              value = (value as any[]).map(f => f.name).join(', ');
            } else if (field.type === 'signature') {
              globalFieldsHtml += `
                <tr>
                  <td>${field.name}</td>
                  <td><img src="${value}" alt="Signature" class="signature-image-small" /></td>
                </tr>
              `;
              return;
            }

            globalFieldsHtml += `
              <tr ${field.type === 'textarea' ? 'class="full-width"' : ''}>
                <td>${field.name}</td>
                <td ${field.type === 'textarea' ? 'colspan="1"' : ''}>${String(value)}</td>
              </tr>
            `;
          });
        });
        globalFieldsHtml += `</table>`;
      });
      globalFieldsHtml += `</div>`;
    }


    const content = `
      <html>
      <head>
        <title>Window Measurements Report</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: landscape; }
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; color: #212529; -webkit-print-color-adjust: exact; }
          .page { width: 297mm; min-height: 210mm; padding: 15mm; margin: 10mm auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          @media print {
            body { background-color: white; }
            .page { margin: 0; box-shadow: none; padding: 10mm; }
          }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #dee2e6; padding-bottom: 15px; margin-bottom: 20px; }
          .header-title { display: flex; align-items: center; gap: 15px; }
          .header h1 { font-size: 26px; font-weight: 700; color: #1e40af; margin: 0; }
          .report-info { text-align: right; font-size: 12px; color: #495057; }
          .window-card { margin-bottom: 20px; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
          .window-header { display: flex; justify-content: space-between; align-items: center; background-color: #eff6ff; padding: 10px 15px; font-size: 16px; font-weight: 700; color: #1e40af; border-bottom: 1px solid #e9ecef; }
          .window-tag { font-size: 14px; font-weight: 600; background-color: #1e40af; color: white; padding: 4px 10px; border-radius: 12px; }
          .window-content { display: flex; flex-direction: row; padding: 15px; gap: 20px; }
          .window-image { flex: 2; min-width: 0; }
          .window-image img { width: 100%; border-radius: 6px; border: 1px solid #dee2e6; }
          .no-image { display: flex; align-items: center; justify-content: center; width: 100%; height: 300px; background-color: #f8f9fa; border-radius: 6px; color: #6c757d; }
          .window-details { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 15px; }
          .measurements-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .measurement-box { background-color: #f8f9fa; border-radius: 6px; padding: 8px; text-align: center; }
          .measurement-box .label { font-size: 11px; font-weight: 600; color: #6c757d; margin-bottom: 4px; text-transform: uppercase; }
          .measurement-box .value { font-size: 18px; font-weight: 700; color: #1e40af; }
          .wizard-measurements { background-color: #f8f9fa; border-radius: 6px; padding: 10px; }
          .wizard-title { font-size: 11px; font-weight: 600; color: #6c757d; margin-bottom: 8px; text-transform: uppercase; text-align: center; }
          .wizard-grid { display: grid; grid-template-columns: 1fr; gap: 4px; text-align: center; font-size: 13px; font-family: monospace; color: #343a40; }
          .details-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .details-table td { padding: 6px 0; border-bottom: 1px solid #e9ecef; vertical-align: top; }
          .details-table td:first-child { font-weight: 600; color: #495057; width: 120px; }
          .details-table tr:last-child td { border-bottom: none; }
          .details-table tr.full-width td:last-child { white-space: pre-wrap; word-break: break-word; }
          .signature-section, .uploaded-files-section { margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef; }
          .signature-section p, .uploaded-files-section p { font-weight: 600; margin-bottom: 8px; color: #495057; }
          .signature-image { max-width: 100%; height: auto; border: 1px solid #dee2e6; border-radius: 4px; }
          .signature-image-small { max-width: 150px; height: auto; border: 1px solid #dee2e6; border-radius: 4px; }
          .uploaded-files-section ul { list-style: none; padding: 0; margin: 0; }
          .uploaded-files-section li { background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 6px 10px; margin-bottom: 5px; border-radius: 4px; font-size: 12px; }
          .global-fields-section { margin-top: 30px; padding-top: 20px; border-top: 2px solid #dee2e6; }
          .global-fields-section h2 { font-size: 22px; font-weight: 700; color: #1e40af; margin-bottom: 15px; }
          .global-fields-section h3 { font-size: 18px; font-weight: 600; color: #495057; margin-top: 15px; margin-bottom: 10px; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="header-title">${logoSvg}<h1>Window Report</h1></div>
            <div class="report-info">
              <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
              <div><strong>Total Windows:</strong> ${windows.length}</div>
            </div>
          </div>
          ${windowCardsHtml}
          ${globalFieldsHtml}
          <div class="footer">
            <p>Measure Wizard &copy; ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const printWindow = window.open(url, "_blank");

    if (!printWindow) {
      toast({
        title: "PDF Generation Failed",
        description: "Please allow popups to generate the PDF.",
        variant: "destructive",
      });
      return;
    }

    printWindow.onload = () => {
      // Wait for all images in the new window's document to load
      const images = printWindow.document.querySelectorAll('img');
      const imageLoadPromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => {
            console.warn(`Image failed to load in print window: ${img.src}`);
            resolve(); // Resolve even on error to not block printing
          };
        });
      });

      Promise.all(imageLoadPromises).then(() => {
        // Revoke the object URL after the window has loaded its content and images
        URL.revokeObjectURL(url);
        try {
          // Add a small delay before printing to ensure everything is ready
          setTimeout(() => {
            printWindow.print();
            // Do NOT close the window here. The user should close it manually.
          }, 500); // 500ms delay
        } catch (printError) {
          console.error("Error printing PDF:", printError);
          toast({
            title: "PDF Printing Failed",
            description: "There was an error printing the PDF. Please try again.",
            variant: "destructive",
          });
        }
      }).catch(error => {
        console.error("Error waiting for images to load in print window:", error);
        toast({
          title: "PDF Generation Error",
          description: "An error occurred while loading images for the PDF. Please try again.",
          variant: "destructive",
        });
        URL.revokeObjectURL(url); // Clean up URL even on image load error
        // Do not close printWindow here, let the user see the error or incomplete PDF
      });
    };

  } catch (error) {
    console.error("Error generating PDF document structure:", error);
    toast({
      title: "PDF Generation Failed",
      description: "An unexpected error occurred while preparing the PDF. Please try again.",
      variant: "destructive",
    });
  }
}