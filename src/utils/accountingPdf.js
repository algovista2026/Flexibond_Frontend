// ────────────────────────────────────────────────────────────────────────────
// utils/accountingPdf.js — ledger PDF + WhatsApp hand-off for both Accounting pages (2026-10-09).
//
// buildLedgerPdf(ledger)  → jsPDF doc laid out like the Tally/Kuber "Ledger Account" print:
//                           letterhead · party · period · voucher table · totals · Closing
//                           Balance · bill-wise pending list. Uses the jsPDF + AutoTable CDN
//                           scripts already loaded in index.html for the Financials register.
// shareLedgerOnWhatsApp() → the closest thing to "attach + send" a website can do:
//   • phone / tablet (touch + Web Share with files): native share sheet with the PDF ATTACHED and
//     the message filled in — the user picks WhatsApp → the chat → Send.
//   • laptop / desktop: downloads the PDF and opens WhatsApp Web on that party's chat (number from
//     the Tally contact line) with the message typed in; the user drags the PDF in.
// ⚠️ A `wa.me` / `web.whatsapp.com/send` link CANNOT carry a file — no website can attach one.
// Fully automatic sending needs the paid WhatsApp Business (Cloud) API. See CLAUDE.md.
// ────────────────────────────────────────────────────────────────────────────
import { fmtDate, money2 } from './accountingFormat';

// jsPDF's built-in Helvetica has no ₹ glyph, so the PDF prints plain amounts with Dr/Cr, exactly
// as the Tally print does.
const drCrText = (v) => {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  if (!n) return 'Nil';
  return `${money2(Math.abs(n))} ${n > 0 ? 'Dr' : 'Cr'}`;
};

/**
 * @param {object} l
 *   companyName, companyAddress, partyName, partyLines[] (address / contact / salesperson),
 *   period, asOf, entries[{date, side, particulars, vchType, vchNo, debit, credit, allocations?}],
 *   totals {debit, credit, closing}, bills[{date, ref|vchNo, amount, received, pending, ageDays|daysOld}],
 *   demo (bool) — stamps a "DEMO DATA" line.
 */
export const buildLedgerPdf = (l) => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) throw new Error('PDF library failed to load. Please refresh the page.');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  if (typeof doc.autoTable !== 'function') throw new Error('PDF table plugin failed to load. Please refresh the page.');

  const W = doc.internal.pageSize.getWidth();
  let y = 42;
  const centre = (text, size, style = 'normal', colour = [17, 24, 39]) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...colour);
    doc.splitTextToSize(String(text), W - 120).forEach((line) => { doc.text(line, W / 2, y, { align: 'center' }); y += size + 4; });
  };

  centre(l.companyName, 13, 'bold');
  if (l.companyAddress) centre(l.companyAddress, 8.5, 'normal', [100, 116, 139]);
  y += 6;
  centre(l.partyName, 12, 'bold', [29, 78, 216]);
  centre('Ledger Account', 9, 'normal', [71, 85, 105]);
  (l.partyLines || []).filter(Boolean).forEach(t => centre(t, 8.5, 'normal', [100, 116, 139]));
  centre(l.period, 8.5, 'normal', [71, 85, 105]);
  if (l.demo) centre('DEMO DATA — simulated balances for presentation', 8, 'bold', [180, 83, 9]);
  y += 4;

  const body = [];
  l.entries.forEach((e) => {
    body.push([fmtDate(e.date), `${e.side}  ${e.particulars}`, e.vchType, e.vchNo, money2(e.debit), money2(e.credit)]);
    (e.allocations || []).forEach((a) => {
      body.push([{ content: '', styles: {} }, {
        content: `      ${a.type} ${a.ref}${a.terms ? ` · ${a.terms}` : ''} · ${money2(a.amount)} ${a.side}`,
        colSpan: 5, styles: { fontSize: 7, textColor: [120, 130, 145], cellPadding: { top: 0, bottom: 3, left: 4, right: 4 } },
      }]);
    });
  });

  const t = l.totals;
  const foot = [
    ['', '', '', '', money2(t.debit), money2(t.credit)],
  ];
  if (Math.abs(t.closing) >= 0.5) {
    foot.push([t.closing > 0 ? 'Dr' : 'Cr', 'Closing Balance', '', '', t.closing < 0 ? money2(-t.closing) : '', t.closing > 0 ? money2(t.closing) : '']);
  }
  foot.push(['', '', '', '', money2(Math.max(t.debit, t.credit)), money2(Math.max(t.debit, t.credit))]);

  doc.autoTable({
    startY: y,
    head: [['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Debit', 'Credit']],
    body,
    foot,
    showFoot: 'lastPage', // totals + Closing Balance once, at the end — not under every page
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 4, textColor: [17, 24, 39] },
    headStyles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [71, 85, 105] },
    footStyles: { fontStyle: 'bold', fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 56 }, 2: { cellWidth: 74 }, 3: { cellWidth: 104 },
      4: { halign: 'right', cellWidth: 72 }, 5: { halign: 'right', cellWidth: 72 },
    },
    didParseCell: (d) => { if ((d.section === 'head' || d.section === 'foot') && d.column.index >= 4) d.cell.styles.halign = 'right'; },
    margin: { left: 36, right: 36 },
  });

  const pending = (l.bills || []).filter(b => b.pending > 0);
  if (pending.length) {
    let y2 = doc.lastAutoTable.finalY + 22;
    if (y2 > doc.internal.pageSize.getHeight() - 90) { doc.addPage(); y2 = 48; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(17, 24, 39);
    doc.text(`Pending Bills as on ${fmtDate(l.asOf)}`, 36, y2);
    doc.autoTable({
      startY: y2 + 8,
      head: [['Bill Date', 'Ref. No.', 'Bill Amount', 'Received', 'Pending', 'Age (days)']],
      body: pending.map(b => [fmtDate(b.date), b.ref || b.vchNo, money2(b.amount), money2(b.received), money2(b.pending), String(b.ageDays ?? b.daysOld)]),
      foot: [['', 'Total', '', '', money2(pending.reduce((a, b) => a + b.pending, 0)), '']],
      showFoot: 'lastPage',
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [71, 85, 105] },
      footStyles: { fontStyle: 'bold', fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      didParseCell: (d) => { if ((d.section === 'head' || d.section === 'foot') && d.column.index >= 2) d.cell.styles.halign = 'right'; },
      margin: { left: 36, right: 36 },
    });
  }

  // Footer on every page.
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text(`${l.companyName} · Ledger of ${l.partyName}`, 36, doc.internal.pageSize.getHeight() - 20);
    doc.text(`Page ${i} of ${pages}`, W - 36, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  return doc;
};

export const ledgerFileName = (party, asOf) =>
  `Ledger_${String(party).replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')}_${fmtDate(asOf)}.pdf`;

// First Indian mobile number in a Tally contact line ("Tel. No. : , 84866 70699") → "918486670699".
export const phoneFromContact = (text) => {
  const digits = String(text || '').replace(/[^\d]/g, ' ').split(/\s+/).join('');
  const m = digits.match(/(?:91)?([6-9]\d{9})/);
  return m ? `91${m[1]}` : null;
};

export const ledgerMessage = ({ partyName, companyName, period, asOf, closing, pendingBills, oldestDays }) => {
  const lines = [`Dear ${partyName},`, '', `Greetings from ${companyName}.`, '',
    `Please find attached your ledger statement for ${period}.`];
  if (closing > 0.5) {
    lines.push('', `Outstanding balance as on ${fmtDate(asOf)}: *Rs. ${money2(closing)} Dr*`
      + (pendingBills ? ` (${pendingBills} pending bill${pendingBills === 1 ? '' : 's'}${oldestDays ? `, oldest ${oldestDays} days` : ''})` : '') + '.',
    '', 'We request you to kindly arrange the payment at the earliest. Please ignore this message if already paid.');
  } else if (closing < -0.5) {
    lines.push('', `Your account shows a credit balance of Rs. ${money2(-closing)} as on ${fmtDate(asOf)}.`);
  } else {
    lines.push('', `Your account is fully settled as on ${fmtDate(asOf)}. Thank you for your prompt payments.`);
  }
  lines.push('', 'Regards,', 'Accounts Team', companyName);
  return lines.join('\n');
};

const isTouchDevice = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

// Returns 'shared' | 'web' | 'cancelled' so the caller can show the right toast.
export const shareLedgerOnWhatsApp = async ({ doc, fileName, message, phone }) => {
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (isTouchDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: message, title: fileName });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // Any other failure → fall through to the desktop path.
    }
  }

  doc.save(fileName);
  const text = encodeURIComponent(message);
  const url = phone
    ? `https://web.whatsapp.com/send?phone=${phone}&text=${text}`
    : `https://web.whatsapp.com/send?text=${text}`;
  window.open(url, '_blank', 'noopener');
  return 'web';
};
