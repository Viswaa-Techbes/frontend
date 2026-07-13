'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import DeliveryChallanEditor from '@/components/DeliveryChallanEditor';

export default function EditDeliveryChallanRoutePage() {
  const { id } = useParams();
  return <DeliveryChallanEditor initialId={id as string} />;
}
