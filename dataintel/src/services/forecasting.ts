import { query } from '../db/duckdb.js';
import { forecastQuery } from '../db/queries.js';

export interface ForecastPoint {
  date: string;
  value: number | null;
  isForecast: boolean;
  confidenceLower?: number;
  confidenceUpper?: number;
}

type ForecastRow = {
  day: string;
  forecast_value: number;
  slope: number;
  intercept: number;
};

type HistoryRow = {
  day: string;
  metric_value: number;
};

export async function getForecast(
  metric: string,
  daysHistory: number,
  daysForecast: number,
): Promise<ForecastPoint[] | null> {
  try {
    const histSql = `\
      SELECT
        created_at::DATE AS day,
        COUNT(*) AS metric_value
      FROM fact_events
      WHERE created_at::DATE >= CURRENT_DATE - INTERVAL '${daysHistory}' DAY
        AND created_at::DATE < CURRENT_DATE
      GROUP BY created_at::DATE
      ORDER BY day`;

    const histRows = await query<HistoryRow>(histSql);

    const q = forecastQuery(metric, daysHistory, daysForecast);
    const forecastRows = await query<ForecastRow>(q.sql, ...q.params);

    const points: ForecastPoint[] = [];

    for (const r of histRows) {
      points.push({
        date: r.day,
        value: Number(r.metric_value),
        isForecast: false,
      });
    }

    const forecastValues: number[] = [];
    for (const r of forecastRows) {
      forecastValues.push(Number(r.forecast_value));
    }

    if (forecastValues.length > 0) {
      const lastHistorical =
        histRows.length > 0
          ? Number(histRows[histRows.length - 1]!.metric_value)
          : forecastValues[0]!;

      let sumSqErr = 0;
      let count = 0;
      for (let i = 0; i < Math.min(histRows.length, forecastValues.length); i++) {
        const actual = Number(histRows[i]!.metric_value);
        const predicted = forecastValues[i]!;
        sumSqErr += (actual - predicted) * (actual - predicted);
        count++;
      }

      const rmse = count > 1 ? Math.sqrt(sumSqErr / count) : lastHistorical * 0.05;
      const se = rmse;

      for (const r of forecastRows) {
        const futureVal = Number(r.forecast_value);
        points.push({
          date: r.day,
          value: futureVal < 0 ? 0 : round2(futureVal),
          isForecast: true,
          confidenceLower:
            futureVal - 1.96 * se < 0 ? 0 : round2(futureVal - 1.96 * se),
          confidenceUpper: round2(futureVal + 1.96 * se),
        });
      }
    }

    return points;
  } catch (err) {
    console.error('[dataintel][forecasting] getForecast failed:', err);
    return null;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
