import { useNavigate, useParams } from 'react-router-dom';
import { ChildMentorTalks } from '@/rebuild/family/console/ChildMentorTalks';
import { familyHref, useConsoleEnvironment, useConsoleTransport } from './consoleSession';

/*
 * /family/:kidId/tutor: F3, a child's Mentor talks through the verified
 * Tutor's eyes (W2F.1). Parent visibility is a product invariant (§1.9), not
 * a feature: the route is parent-gated and Core re-checks the verified
 * guardian link on every request, so this page cannot show anything the
 * server would not already hand over. Keyed by the child so a new :kidId
 * never shows the previous child's flags, even for a moment.
 */
export function KidTutorPage() {
  const { kidId = '' } = useParams();
  const transport = useConsoleTransport();
  const { locale, dark, family, copy } = useConsoleEnvironment();
  const navigate = useNavigate();
  return <ChildMentorTalks key={kidId} copy={family.familyChildMentor} notesCopy={family.familyMemoryNotes} consentCopy={family.familyChildConsent}
    profileCopy={copy.mentor.mentorProfile} locale={locale} dark={dark} transport={transport} kidId={kidId} backHref={familyHref(kidId)}
    onNavigate={(href) => navigate(href)} />;
}

export default KidTutorPage;
