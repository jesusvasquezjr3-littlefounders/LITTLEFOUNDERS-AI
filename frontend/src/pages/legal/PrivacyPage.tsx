import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      eyebrowKey="privacy.eyebrow"
      titleKey="privacy.title"
      subtitleKey="privacy.subtitle"
      effectiveDateKey="privacy.effective_date"
      comingSoonKey="privacy.coming_soon"
      comingSoonDescKey="privacy.coming_soon_desc"
      contactNoteKey="privacy.contact_note"
    />
  );
}
