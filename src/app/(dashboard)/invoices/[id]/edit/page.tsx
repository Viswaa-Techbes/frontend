'use client';

import React from 'react';
import InvoiceEditor from '@/components/InvoiceEditor';

interface EditInvoicePageProps {
  params: {
    id: string;
  };
}

export default function EditInvoicePage({ params }: EditInvoicePageProps) {
  return <InvoiceEditor mode="edit" documentId={params.id} />;
}
