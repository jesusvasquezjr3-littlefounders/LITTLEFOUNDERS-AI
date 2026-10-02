import type { HorizonteFixture } from './types.generated';
import * as goldenFixtures from './golden/fixtures.generated';
import * as numAFixtures from './num-a/fixtures.generated';
import * as numBFixtures from './num-b/fixtures.generated';
import * as balanceFixtures from './balance/fixtures.generated';
import * as stats1Fixtures from './stats1/fixtures.generated';
import * as plane1Fixtures from './plane1/fixtures.generated';
import * as fin1Fixtures from './fin1/fixtures.generated';
import * as fin2Fixtures from './fin2/fixtures.generated';
import * as alg1Fixtures from './alg1/fixtures.generated';
import * as alg2Fixtures from './alg2/fixtures.generated';
import * as geom2Fixtures from './geom2/fixtures.generated';
import * as probFixtures from './prob/fixtures.generated';
import * as comFixtures from './com/fixtures.generated';
import * as sim1Fixtures from './sim1/fixtures.generated';
import * as sim2Fixtures from './sim2/fixtures.generated';
import * as solidsFixtures from './solids/fixtures.generated';
import * as space1Fixtures from './space1/fixtures.generated';
import * as space2Fixtures from './space2/fixtures.generated';

/** Preview, audit and test only: kept out of the player bundle. */
export const HORIZONTE_FIXTURES: Readonly<Record<string, readonly HorizonteFixture[]>> = {
  'golden': goldenFixtures.GOLDEN_FIXTURES,
  'num-a': numAFixtures.NUM_A_FIXTURES,
  'num-b': numBFixtures.NUM_B_FIXTURES,
  'balance': balanceFixtures.BALANCE_FIXTURES,
  'stats1': stats1Fixtures.STATS1_FIXTURES,
  'plane1': plane1Fixtures.PLANE1_FIXTURES,
  'fin1': fin1Fixtures.FIN1_FIXTURES,
  'fin2': fin2Fixtures.FIN2_FIXTURES,
  'alg1': alg1Fixtures.ALG1_FIXTURES,
  'alg2': alg2Fixtures.ALG2_FIXTURES,
  'geom2': geom2Fixtures.GEOM2_FIXTURES,
  'prob': probFixtures.PROB_FIXTURES,
  'com': comFixtures.COM_FIXTURES,
  'sim1': sim1Fixtures.SIM1_FIXTURES,
  'sim2': sim2Fixtures.SIM2_FIXTURES,
  'solids': solidsFixtures.SOLIDS_FIXTURES,
  'space1': space1Fixtures.SPACE1_FIXTURES,
  'space2': space2Fixtures.SPACE2_FIXTURES,
};
