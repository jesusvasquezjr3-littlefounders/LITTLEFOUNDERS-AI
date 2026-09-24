export interface RatioTableItem {
  itemsPerPack: number;
  pricePerPack: number;
  minimumPacks: number;
  maximumPacks: number;
  initialPacks: number;
}

export interface RatioTableRow {
  packs: number;
  items: number;
  price: number;
  unitPrice: number;
}

/** Computes each linked value from the authored base ratio; never from display text. */
export function ratioTableRows(item: RatioTableItem, selectedPacks: number): RatioTableRow[] | null {
  const values = [item.itemsPerPack, item.pricePerPack, item.minimumPacks, item.maximumPacks, item.initialPacks, selectedPacks];
  if (values.some((value) => !Number.isSafeInteger(value))) return null;
  if (item.itemsPerPack < 1 || item.itemsPerPack > 12 || item.pricePerPack < 1 || item.pricePerPack > 1_000
    || item.minimumPacks < 1 || item.maximumPacks <= item.minimumPacks || item.maximumPacks > 8
    || item.initialPacks < item.minimumPacks || item.initialPacks > item.maximumPacks
    || selectedPacks < item.minimumPacks || selectedPacks > item.maximumPacks
    || item.pricePerPack % item.itemsPerPack !== 0) return null;
  const unitPrice = item.pricePerPack / item.itemsPerPack;
  return Array.from({ length: selectedPacks }, (_, index) => {
    const packs = index + 1;
    return { packs, items: packs * item.itemsPerPack, price: packs * item.pricePerPack, unitPrice };
  });
}
