import { cashDrawerStatus, cashFlow } from './cash-drawer.ts'
import type { CashFlow } from './cash-drawer.ts'
import type { CashDrawer, CashDrawerRecord } from './cash-drawer-model.ts'
import { ledgerFingerprint } from './cash-ledger.ts'
import type { LedgerEntry } from './cash-ledger.ts'

/** 그날 시재의 지금 모습입니다. 판정(`cash-drawer.aggregate.ts`)과 응답이 같이 씁니다. */
export interface CashDrawerState {
  /** 저장한 시재입니다. 열지 않았으면 `null`입니다. */
  record: CashDrawerRecord | null
  drawer: CashDrawer
  ledger: ReadonlyArray<LedgerEntry>
  flow: CashFlow
}

/**
 * 저장한 시재와 지금 현금 원장으로 시재를 계산합니다 (front-desk.md 시재와 지출). 상태는 저장하지 않고 읽을 때마다
 * 계산합니다. 마감 뒤 원장이 바뀌면(마감 때 남긴 지문과 다르면) 다시 마감할 때까지 `REOPENED`
 * (`CHANGED_AFTER_CLOSE`)입니다. 열지 않았어도 그날 현금 흐름을 담아 `NOT_OPENED`로 줍니다.
 */
export function cashDrawerView(
  date: string,
  record: CashDrawerRecord | null,
  ledger: ReadonlyArray<LedgerEntry>,
): CashDrawerState {
  const flow = cashFlow(record?.openingAmount ?? 0, ledger)
  const changed = record?.closing != null && record.closing.ledger !== ledgerFingerprint(ledger)
  const status = cashDrawerStatus({
    opened: record !== null,
    closed: record?.closing != null,
    reopenedSinceLastClose: record?.reopened != null || changed,
  })
  const drawer: CashDrawer = {
    date,
    status,
    openingAmount: record?.openingAmount ?? null,
    carriedOver: record?.carriedOver ?? false,
    cashIn: flow.cashIn,
    cashRefunds: flow.cashRefunds,
    expenses: flow.expenses,
    expectedClosing: record === null ? null : flow.expectedClosing,
    opened: record === null ? null : { at: record.openedAt, by: record.openedBy },
    closing: record?.closing == null ? null : withoutLedger(record.closing),
    reopened:
      record?.reopened != null
        ? { cause: 'MANUAL', ...record.reopened }
        : changed
          ? { cause: 'CHANGED_AFTER_CLOSE', reason: null, at: null, by: null }
          : null,
    version: record?.version ?? 0,
  }
  return { record, drawer, ledger, flow }
}

const withoutLedger = ({ ledger: _, ...closing }: NonNullable<CashDrawerRecord['closing']>) => closing
