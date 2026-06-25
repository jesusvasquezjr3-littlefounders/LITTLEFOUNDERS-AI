import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export default function TermsPage() {
  return (
    <LegalPageLayout
      eyebrowKey="terms.eyebrow"
      titleKey="terms.title"
      subtitleKey="terms.subtitle"
      effectiveDateKey="terms.effective_date"
      comingSoonKey="terms.coming_soon"
      comingSoonDescKey="terms.coming_soon_desc"
      contactNoteKey="terms.contact_note"
    />
  );
}
