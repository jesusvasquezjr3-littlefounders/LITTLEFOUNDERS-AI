import { LegalDocumentViewer } from './LegalDocumentViewer';

export function LegalPage({ doc }: { doc: 'terms' | 'privacy' }) {
  return <LegalDocumentViewer doc={doc} />;
}
