'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import CreditNoteEditor from '@/components/CreditNoteEditor';

export default function EditCreditNoteRoutePage() {
  const { id } = useParams();
  return <CreditNoteEditor initialId={id as string} />;
}
