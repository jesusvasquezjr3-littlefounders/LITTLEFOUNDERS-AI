/* ──────────────────────────────────────────────────────────────
   Market Phase – Customers walk past the stand
   ────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, GAME_CONFIG, calculateSatisfaction } from '../constants';
import type { Customer, Recipe, WeatherType, DayResult } from '../types';

interface Props {
  recipe: Recipe;
  weather: WeatherType;
  day: number;
  coins: number;
  hasAwning: boolean;
  hasSign: boolean;
  onFinish: (result: DayResult) => void;
  playSound: (path: string) => void;
  paused?: boolean;
}

let custId = 0;
const nextCustId = () => `cust_${custId++}`;

/*
 * MARKET PHYSICS MODEL
 * All x-positions are stored in PERCENTAGE of container width (0–100+).
 * This makes customer speed resolution-independent.
 * The stand is at 50% of the container.
 */

// Speed = % of container width per frame (at 60fps)
const WALK_SPEED = 0.55;       // ~55% of container in ~100 frames ≈ 1.7s to reach stand
const LEAVE_SPEED = 1.0;       // exit quickly
const STAND_POSITION = 48;     // customers stop just before center
const REACT_DURATION_MS = 900; // how long they react before leaving

export function MarketPhase({ recipe, weather, day, coins, hasAwning, hasSign, onFinish, playSound, paused = false }: Props) {
  const { t } = useTranslation('games');
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const customersRef = useRef<Customer[]>([]);
  const spawnedRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const finishedRef = useRef(false);
  const prevTimeRef = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Track which customers have started their react timer (to avoid setTimeout avalanche)
  const reactTimersRef = useRef<Set<string>>(new Set());
  // Store actual timeout handles so we can cancel them on unmount
  const timeoutHandlesRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [displayCustomers, setDisplayCustomers] = useState<Customer[]>([]);
  const [earnedCoins, setEarnedCoins] = useState(0);

  const satisfaction = calculateSatisfaction(recipe, weather);
  const totalCustomers = GAME_CONFIG.baseCustomerCount + day * GAME_CONFIG.difficultyScaleCustomers + (hasSign ? 2 : 0);
  const awningBonus = hasAwning && weather === 'cold' ? 0.15 : 0;
  const adjustedSatisfaction = Math.min(1, satisfaction + awningBonus);

  const ingredientCost = (recipe.lemons + recipe.sugar) * GAME_CONFIG.ingredientCostPerUnit;

  const finishMarket = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const bought = customersRef.current.filter((c) => c.bought).length;
    const totalSales = bought * GAME_CONFIG.pricePerCup;
    const netProfit = totalSales - ingredientCost;

    onFinish({
      totalSales,
      ingredientCost,
      netProfit,
      customersBought: bought,
      customersTotal: totalCustomers,
    });
  }, [ingredientCost, onFinish, totalCustomers]);

  useEffect(() => {
    prevTimeRef.current = performance.now();

    const loop = (now: number) => {
      if (finishedRef.current) return;

      // If paused, keep scheduling frames but don't update
      if (pausedRef.current) {
        prevTimeRef.current = now;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // dt normalised to 60fps
      const dt = Math.min((now - prevTimeRef.current) / 16.67, 3);
      prevTimeRef.current = now;

      // Spawn customers
      if (spawnedRef.current < totalCustomers && now - lastSpawnRef.current > GAME_CONFIG.customerSpawnIntervalMs) {
        lastSpawnRef.current = now;
        spawnedRef.current++;

        // Each customer decides to buy based on satisfaction (with some randomness)
        const willBuy = Math.random() < adjustedSatisfaction;

        customersRef.current.push({
          id: nextCustId(),
          x: -12, // start off-screen left (in %)
          satisfied: null,
          bought: willBuy,
          animState: 'walking',
        });
      }

      // Move customers — all positions in % of container width
      customersRef.current = customersRef.current.map((c) => {
        // Already off-screen right — no updates needed
        if (c.animState === 'leaving' && c.x > 110) {
          return c;
        }

        // Leaving — move right quickly
        if (c.animState === 'leaving') {
          return { ...c, x: c.x + LEAVE_SPEED * dt };
        }

        // Walking towards the stand
        if (c.animState === 'walking') {
          const newX = c.x + WALK_SPEED * dt;
          if (newX >= STAND_POSITION) {
            // Arrive at stand — play sound & trigger reaction
            if (c.bought) {
              playSound('customerHappy');
              setEarnedCoins((prev) => prev + GAME_CONFIG.pricePerCup);
            } else {
              playSound('customerSad');
            }
            return {
              ...c,
              x: STAND_POSITION,
              animState: 'reacting' as const,
              satisfied: c.bought,
            };
          }
          return { ...c, x: newX };
        }

        // Reacting — wait, then schedule transition to leaving (ONCE)
        if (c.animState === 'reacting') {
          if (!reactTimersRef.current.has(c.id)) {
            reactTimersRef.current.add(c.id);
            const handle = setTimeout(() => {
              customersRef.current = customersRef.current.map((cu) =>
                cu.id === c.id ? { ...cu, animState: 'leaving' as const } : cu
              );
            }, REACT_DURATION_MS);
            timeoutHandlesRef.current.push(handle);
          }
          return c;
        }

        return c;
      });

      // Check if all done
      const spawnComplete = spawnedRef.current >= totalCustomers;
      const allGone = spawnComplete && customersRef.current.every(
        (c) => c.animState === 'leaving' && c.x > 110
      );

      if (allGone) {
        finishMarket();
        return;
      }

      setDisplayCustomers([...customersRef.current]);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      reactTimersRef.current.clear();
      // Cancel all pending reaction timers
      timeoutHandlesRef.current.forEach(clearTimeout);
      timeoutHandlesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCustomers, adjustedSatisfaction]);

  // Auto finish safety net — if something gets stuck
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!finishedRef.current) finishMarket();
    }, totalCustomers * GAME_CONFIG.customerSpawnIntervalMs + 12000);
    return () => clearTimeout(timeout);
  }, [totalCustomers, finishMarket]);

  const bgImage = weather === 'hot' ? PICTURES.bgStandHot : PICTURES.bgStandCold;

  return (
    <div ref={containerRef} className="nectar-market" style={{ backgroundImage: `url(${bgImage})` }}>
      {/* Stand */}
      <div className="nectar-market-stand">
        <img src={PICTURES.stand} alt="" className="nectar-market-stand-img" style={{ width: 240, height: 200, objectFit: 'contain' }} />
      </div>

      {/* Customers — positioned with % for responsive layout */}
      {displayCustomers.map((c) => {
        let imgSrc = PICTURES.customerWalk;
        if (c.animState === 'reacting' || c.animState === 'leaving') {
          imgSrc = c.satisfied ? PICTURES.customerHappy : PICTURES.customerSad;
        }

        return (
          <div
            key={c.id}
            className={`nectar-customer nectar-customer-${c.animState}`}
            style={{ left: `${c.x}%`, bottom: '15%' }}
          >
            <img
              src={imgSrc}
              alt=""
              className="nectar-customer-img"
              style={{ width: 100, height: 120, objectFit: 'contain' }}
            />
            {c.animState === 'reacting' && c.satisfied && (
              <span className="nectar-customer-coin-pop">+{GAME_CONFIG.pricePerCup}</span>
            )}
            {c.animState === 'reacting' && !c.satisfied && (
              <span className="nectar-customer-sad-pop">😤</span>
            )}
          </div>
        );
      })}

      {/* Coin counter */}
      <div className="nectar-market-hud">
        <div className="nectar-market-coins">
          <img src={PICTURES.coin} alt="" className="nectar-icon-sm" />
          <span>{earnedCoins}</span>
        </div>
        <p className="nectar-market-label">{t('nectar.market.watching')}</p>
      </div>
    </div>
  );
}
