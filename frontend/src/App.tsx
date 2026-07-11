import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/routes/Layout';
import { Home } from '@/routes/Home';
import { SectionPage } from '@/routes/SectionPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="learn" element={<SectionPage section="learn" />} />
        <Route path="tutor" element={<SectionPage section="tutor" />} />
        <Route path="games" element={<SectionPage section="games" />} />
        <Route path="tasks" element={<SectionPage section="tasks" />} />
        <Route path="profile" element={<SectionPage section="profile" />} />
      </Route>
    </Routes>
  );
}
