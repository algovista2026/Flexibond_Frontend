import React from 'react';
import { FiFileText } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

// PDF + WhatsApp buttons on a ledger view (both Accounting pages, 2026-10-09).
// The work lives in utils/accountingPdf.js; this is only the two buttons.
const LedgerActions = ({ onPdf, onWhatsApp, hasPhone }) => (
  <div className="acc-ledger-actions">
    <button type="button" className="acc-btn" onClick={onPdf} title="Download this ledger as a PDF">
      <FiFileText /> Ledger PDF
    </button>
    <button
      type="button"
      className="acc-btn acc-wa"
      onClick={onWhatsApp}
      title={hasPhone
        ? 'Phone/tablet: share the PDF + message to WhatsApp. Laptop: downloads the PDF and opens this party\'s WhatsApp Web chat with the message typed in.'
        : 'No phone number in this ledger — WhatsApp opens with the message and you pick the contact.'}
    >
      <FaWhatsapp /> WhatsApp
    </button>
  </div>
);

export default LedgerActions;
