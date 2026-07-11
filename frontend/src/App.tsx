import { Route, Routes } from 'react-router-dom';
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
    </Routes>
  );
}
