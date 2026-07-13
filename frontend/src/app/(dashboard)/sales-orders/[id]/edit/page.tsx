'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import SalesOrderEditor from '@/components/SalesOrderEditor';

export default function EditSalesOrderRoutePage() {
  const { id } = useParams();
  return <SalesOrderEditor initialId={id as string} />;
}
