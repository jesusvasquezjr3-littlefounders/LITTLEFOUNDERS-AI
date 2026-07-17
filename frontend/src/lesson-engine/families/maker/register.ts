// `maker` family registry slice — composed by lesson-engine/registry.ts.

import type { Registry } from '../../core/types'
import {
  BalanceScale,
  CodeOrder,
  DebugHunt,
  MachineIo,
  MeasureRead,
  RobotPath,
  buildMachineAnswer,
  buildMeasureAnswer,
  makerCanSubmit,
} from './components'

export { makerSchemas } from './schema'
export { makerGraders } from './grade'
export { makerFixtures } from './fixtures'

export const makerRegistry: Registry = {
  code_order: { kind: 'input', component: CodeOrder, canSubmit: makerCanSubmit.code_order },
  robot_path: { kind: 'flow', component: RobotPath },
  debug_hunt: { kind: 'input', component: DebugHunt, canSubmit: makerCanSubmit.debug_hunt },
  balance_scale: {
    kind: 'input',
    component: BalanceScale,
    canSubmit: makerCanSubmit.balance_scale,
  },
  measure_read: {
    kind: 'input',
    component: MeasureRead,
    canSubmit: makerCanSubmit.measure_read,
    buildAnswer: buildMeasureAnswer,
  },
  machine_io: {
    kind: 'input',
    component: MachineIo,
    canSubmit: makerCanSubmit.machine_io,
    buildAnswer: buildMachineAnswer,
  },
}
