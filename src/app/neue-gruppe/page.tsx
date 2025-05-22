'use client';

import GroupRequestForm from '@/components/GroupRequestForm';
import FormPageLayout from '@/components/FormPageLayout';

export default function NewGroupPage() {
  return (
    <FormPageLayout
      title="Neue Arbeitsgruppe"
      subtitle="Online-Formular zur Beantragung einer Arbeitsgruppe"
      introText="Hier finden Sie alle Termine und wichtige Informationen für Mitglieder der Linken in Frankfurt."
      breadcrumbs={[
        { label: 'Start', href: '/' },
        { label: 'Neue Gruppen Anfrage', href: '/neue-gruppe', active: true },
      ]}
    >
      <GroupRequestForm />
    </FormPageLayout>
  );
}