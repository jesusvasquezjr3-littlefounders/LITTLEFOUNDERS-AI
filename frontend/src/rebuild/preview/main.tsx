import { createRoot } from 'react-dom/client';
import { Preview } from './Preview';
import '../design/tokens.css';
import '../design/system.css';

// Separate development entry: no legacy UI, auth session, analytics or paid services.
if (import.meta.env.DEV) {
  createRoot(document.getElementById('rebuild-root')!).render(<Preview />);
}
