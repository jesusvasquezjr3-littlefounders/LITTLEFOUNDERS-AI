import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/routes/Layout';
import { SectionPage } from '@/routes/SectionPage';
import { MarketingLayout } from '@/routes/marketing/MarketingLayout';
import { Landing } from '@/routes/marketing/Landing';
import { ComingSoon } from '@/routes/marketing/ComingSoon';
import { LegalPage } from '@/routes/marketing/LegalPage';

export function App() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<Landing />} />
        <Route path="how-it-works" element={<ComingSoon page="howItWorks" />} />
        <Route path="families" element={<ComingSoon page="families" />} />
        <Route path="faq" element={<ComingSoon page="faq" />} />
        <Route path="legal/terms" element={<LegalPage doc="terms" />} />
        <Route path="legal/privacy" element={<LegalPage doc="privacy" />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="learn" element={<SectionPage section="learn" />} />
        <Route path="tutor" element={<SectionPage section="tutor" />} />
        <Route path="games" element={<SectionPage section="games" />} />
        <Route path="tasks" element={<SectionPage section="tasks" />} />
        <Route path="profile" element={<SectionPage section="profile" />} />
      </Route>
    </Routes>
  );
}
