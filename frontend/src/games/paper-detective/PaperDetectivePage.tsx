import { PaperDetectiveGame } from './components/PaperDetectiveGame';
import './paper-detective.css';

export default function PaperDetectivePage() {
  return (
    <div className="game-fullscreen pd-font">
      <PaperDetectiveGame />
    </div>
  );
}
