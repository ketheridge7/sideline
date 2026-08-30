export const TRANSACTION_KINDS = ['trade', 'add', 'drop', 'add_drop', 'status'] as const

export type TransactionKind = (typeof TRANSACTION_KINDS)[number]

export const mapTransactionKind = (raw: string, adds: number, drops: number): TransactionKind => {
  const lower = raw.toLowerCase()
  if (lower.includes('trade')) return 'trade'
  if (adds > 0 && drops > 0) return 'add_drop'
  if (adds > 0) return 'add'
  if (drops > 0) return 'drop'
  return 'status'
}

export const transactionKindLabel = (kind: TransactionKind): string => {
  switch (kind) {
    case 'trade':
      return 'trade'
    case 'add':
      return 'add'
    case 'drop':
      return 'drop'
    case 'add_drop':
      return 'add / drop'
    case 'status':
      return 'update'
    default: {
      const _never: never = kind
      return _never
    }
  }
}
