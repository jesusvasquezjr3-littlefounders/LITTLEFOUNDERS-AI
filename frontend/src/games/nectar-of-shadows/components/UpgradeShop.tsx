/* ──────────────────────────────────────────────────────────────
   Upgrade Shop – Invest coins into improvements
   ────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import type { Upgrade, UpgradeKey } from '../types';

interface Props {
  coins: number;
  vaultSavings: number;
  upgrades: Upgrade[];
  hasVault: boolean;
  onPurchase: (key: UpgradeKey) => void;
  onSaveToVault: (amount: number) => void;
  onContinue: () => void;
}

const UPGRADE_ICONS: Record<UpgradeKey, string> = {
  squeezer: '🍋',
  awning: '⛺',
  sign: '📜',
  vault: '🏦',
};

export function UpgradeShop({ coins, vaultSavings, upgrades, hasVault, onPurchase, onSaveToVault, onContinue }: Props) {
  const { t } = useTranslation('games');
  const [saveAmount, setSaveAmount] = useState(0);

  const handleSave = () => {
    if (saveAmount > 0) {
      onSaveToVault(saveAmount);
      setSaveAmount(0);
    }
  };

  return (
    <div className="nectar-shop">
      <div className="nectar-shop-panel">
        {/* Header */}
        <h2 className="nectar-shop-title">{t('nectar.shop.title')}</h2>

        {/* Balance */}
        <div className="nectar-shop-balance">
          <AssetImg assetPath={PICTURES.coin} alt="" className="nectar-icon-sm" />
          <span>{t('nectar.shop.balance', { coins })}</span>
        </div>

        {/* Upgrades grid */}
        <div className="nectar-shop-grid">
          {upgrades.map((upgrade) => {
            const canBuy = !upgrade.purchased && coins >= upgrade.cost;

            return (
              <button
                key={upgrade.key}
                className={`nectar-shop-item ${upgrade.purchased ? 'purchased' : ''} ${canBuy ? 'available' : ''}`}
                onClick={() => canBuy && onPurchase(upgrade.key)}
                disabled={upgrade.purchased || !canBuy}
              >
                <span className="nectar-shop-item-icon">
                  {UPGRADE_ICONS[upgrade.key]}
                </span>
                <span className="nectar-shop-item-name">
                  {t(`nectar.shop.upgrades.${upgrade.key}.name`)}
                </span>
                <span className="nectar-shop-item-desc">
                  {t(`nectar.shop.upgrades.${upgrade.key}.desc`)}
                </span>
                {upgrade.purchased ? (
                  <span className="nectar-shop-item-owned">
                    {t('nectar.shop.owned')}
                  </span>
                ) : (
                  <span className="nectar-shop-item-price">
                    <AssetImg assetPath={PICTURES.coin} alt="" className="nectar-icon-xs" />
                    {upgrade.cost}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Vault savings section */}
        {hasVault && (
          <div className="nectar-shop-vault">
            <div className="nectar-shop-vault-header">
              <AssetImg assetPath={PICTURES.vault} alt="" className="nectar-icon-sm" />
              <span>{t('nectar.shop.vault.title')}</span>
            </div>
            <p className="nectar-shop-vault-balance">
              {t('nectar.shop.vault.saved', { amount: vaultSavings })}
            </p>
            <div className="nectar-shop-vault-input">
              <input
                type="range"
                min={0}
                max={coins}
                value={saveAmount}
                onChange={(e) => setSaveAmount(Number(e.target.value))}
                className="nectar-slider"
              />
              <span className="nectar-shop-vault-amount">{saveAmount}</span>
              <button
                className="nectar-btn nectar-btn-small"
                onClick={handleSave}
                disabled={saveAmount <= 0}
              >
                {t('nectar.shop.vault.save')}
              </button>
            </div>
          </div>
        )}

        {/* Continue button */}
        <button className="nectar-btn nectar-btn-primary" onClick={onContinue}>
          {t('nectar.shop.nextDay')}
        </button>
      </div>
    </div>
  );
}
