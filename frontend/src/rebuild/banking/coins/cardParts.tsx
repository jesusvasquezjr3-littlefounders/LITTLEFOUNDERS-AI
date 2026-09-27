import { ChipGroup, ChoiceChip, Copy, TextField } from '../../design/controls';
import type { CoinCardCopy } from '../../family/tasks/taskParts';
import { CARD_DESIGNS, CARD_NAME_MAX, type CardDesign } from './coinsApi';

/*
 * The coin card's name and colour (F5, W2F.2): used where a Tutor opens a
 * child's card and where a child renames or recolours their own. Each colour
 * is a choice chip with its word and a swatch of the card's own hue, and the
 * chosen one carries a check (never the hue alone, 02 rule 6). A practice
 * card has no number, chip or network mark (D.7).
 */
export function CardFields({ labels, colours, name, design, onName, onDesign, disabled }: {
  labels: { cardName: string; cardNameHelp?: string; colour: string };
  colours: CoinCardCopy;
  name: string;
  design: CardDesign;
  onName: (name: string) => void;
  onDesign: (design: CardDesign) => void;
  disabled?: boolean;
}) {
  return <>
    <TextField label={labels.cardName} help={labels.cardNameHelp} autoComplete="off" maxLength={CARD_NAME_MAX} value={name} disabled={disabled}
      onChange={(event) => onName(event.target.value)} />
    <div className="lf-money-colours" data-family-part="card-colour">
      <Copy role="body">{labels.colour}</Copy>
      <ChipGroup label={labels.colour}>
        {CARD_DESIGNS.map((option) => <ChoiceChip key={option} selected={design === option} disabled={disabled} onToggle={() => onDesign(option)}>
          <span className="lf-money-swatch" data-design={option} aria-hidden="true" />{colours[option]}
        </ChoiceChip>)}
      </ChipGroup>
    </div>
  </>;
}
