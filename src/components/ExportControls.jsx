import React, { useState } from 'react';
import { FiDownload, FiFileText, FiImage } from 'react-icons/fi';

const ExportControls = ({ pageTitle = 'Dashboard' }) => {
  const [loading, setLoading] = useState(false);

  // Chart.js canvases that live inside scrollable / absolutely-positioned wrappers
  // (Colour / Thickness / Dimensions charts, the frozen-axis column charts, etc.) render
  // BLANK when html2canvas tries to rasterise them. Fix: snapshot every live canvas to a PNG
  // first, then in html2canvas's `onclone` swap each cloned canvas for a plain <img> of that
  // snapshot and un-clip its scroll wrapper, so the full chart always shows in the export.
  const buildCanvas = async (targetElement) => {
    const originals = Array.from(targetElement.querySelectorAll('canvas'));
    const snaps = originals.map((c) => {
      try {
        const rect = c.getBoundingClientRect();
        return { url: c.toDataURL('image/png'), w: rect.width, h: rect.height };
      } catch (e) {
        return null;
      }
    });

    return window.html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#f8fafc',
      onclone: (clonedDoc) => {
        // WYSIWYG flip capture: the `is-exporting` CSS (index.css) flattens each flip-card and
        // shows ONLY its currently-visible face — the chart (front) or the AI insights (back) —
        // instead of html2canvas bleeding the rotated back face through. Apply it on the CLONE
        // so the live page never flickers.
        clonedDoc.body.classList.add('is-exporting');
        // Scope everything to the cloned page-content so canvas indices line up with `snaps`
        // (which were collected from the live .page-content, not the whole document).
        const clonedTarget = clonedDoc.querySelector('.page-content') || clonedDoc;
        // Hide interactive controls (export/notification buttons, AI insight) from the export.
        clonedTarget.querySelectorAll('.page-controls, .ai-insights-btn, .ai-insights-panel')
          .forEach((el) => { el.style.display = 'none'; });

        const clones = Array.from(clonedTarget.querySelectorAll('canvas'));
        clones.forEach((cc, i) => {
          const snap = snaps[i];
          if (!snap || !snap.url) return;
          const img = clonedDoc.createElement('img');
          img.src = snap.url;
          img.style.width = `${snap.w}px`;
          img.style.height = `${snap.h}px`;
          img.style.display = 'block';
          img.style.maxWidth = 'none';
          // Un-clip any scroll wrapper between the canvas and its chart card so the whole
          // chart is visible in the snapshot (no cut-off scrollable charts).
          let p = cc.parentElement;
          let hops = 0;
          while (p && !p.classList.contains('chart-card') && hops < 4) {
            p.style.overflow = 'visible';
            p.style.position = 'static';
            p.style.height = 'auto';
            p.style.minHeight = '0';
            p = p.parentElement;
            hops += 1;
          }
          if (cc.parentNode) cc.parentNode.replaceChild(img, cc);
        });
      }
    });
  };

  const captureScreenshot = async (format) => {
    try {
      setLoading(true);

      const targetElement = document.querySelector('.page-content');
      if (!targetElement) {
        alert('Could not find dashboard layout to export.');
        return;
      }

      if (format === 'image') {
        const canvas = await buildCanvas(targetElement);

        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = `${pageTitle}_Export_${new Date().toISOString().split('T')[0]}.png`;
        link.click();
      }

      else if (format === 'pdf') {
        const canvas = await buildCanvas(targetElement);

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const imgWidth = 210; // A4 Width in mm
        const pageHeight = 295; // A4 Height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Add extra pages if needed
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`${pageTitle}_Export_${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) {
      console.error('Export Error:', error);
      alert('Failed to export dashboard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button
        disabled={loading}
        onClick={() => captureScreenshot('pdf')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          background: '#fff',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => { if(!loading) e.currentTarget.style.background = 'var(--bg-light)'; }}
        onMouseLeave={(e) => { if(!loading) e.currentTarget.style.background = '#fff'; }}
      >
        <FiFileText />
        <span>{loading ? 'Exporting...' : 'PDF'}</span>
      </button>

      <button
        disabled={loading}
        onClick={() => captureScreenshot('image')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          background: '#fff',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => { if(!loading) e.currentTarget.style.background = 'var(--bg-light)'; }}
        onMouseLeave={(e) => { if(!loading) e.currentTarget.style.background = '#fff'; }}
      >
        <FiImage />
        <span>{loading ? 'Exporting...' : 'Image'}</span>
      </button>
    </div>
  );
};

export default ExportControls;
