export type HistoryActionKind = 'collection' | 'tag' | 'asset' | 'search' | 'source' | 'preview'

export interface HistoryActionContext {
  kind: HistoryActionKind
  label: string
  coalesceKey?: string
}

export interface HistoryAction {
  context: HistoryActionContext
  undo: () => Promise<void> | void
  redo: () => Promise<void> | void
}

const historyStack: HistoryAction[] = []
const redoStack: HistoryAction[] = []
const listeners = new Set<() => void>()
let historyGeneration = 0
let historyOperation: Promise<unknown> = Promise.resolve()

export function pushHistoryAction(action: HistoryAction) {
  historyStack.push(action)
  redoStack.length = 0
  notifyHistoryListeners()
}

export function pushCoalescedHistoryAction(action: HistoryAction) {
  const previous = historyStack.at(-1)
  if (
    previous
    && action.context.coalesceKey
    && previous.context.kind === action.context.kind
    && previous.context.coalesceKey === action.context.coalesceKey
  ) {
    historyStack[historyStack.length - 1] = {
      context: action.context,
      undo: previous.undo,
      redo: action.redo,
    }
    redoStack.length = 0
    notifyHistoryListeners()
    return
  }
  pushHistoryAction(action)
}

export function clearHistory() {
  if (historyStack.length === 0 && redoStack.length === 0) return
  historyGeneration += 1
  historyStack.length = 0
  redoStack.length = 0
  notifyHistoryListeners()
}

export async function undoLastHistoryAction(kind?: HistoryActionKind) {
  return enqueueHistoryOperation(async () => {
    const index = findLastActionIndex(historyStack, kind)
    if (index < 0) return false
    const action = historyStack[index]
    if (!action) return false
    const generation = historyGeneration
    await action.undo()
    if (generation !== historyGeneration) return false
    const currentIndex = historyStack.indexOf(action)
    if (currentIndex < 0) return false
    historyStack.splice(currentIndex, 1)
    redoStack.push(action)
    notifyHistoryListeners()
    return true
  })
}

export async function redoLastHistoryAction(kind?: HistoryActionKind) {
  return enqueueHistoryOperation(async () => {
    const index = findLastActionIndex(redoStack, kind)
    if (index < 0) return false
    const action = redoStack[index]
    if (!action) return false
    const generation = historyGeneration
    await action.redo()
    if (generation !== historyGeneration) return false
    const currentIndex = redoStack.indexOf(action)
    if (currentIndex < 0) return false
    redoStack.splice(currentIndex, 1)
    historyStack.push(action)
    notifyHistoryListeners()
    return true
  })
}

export function canUndoHistory(kind?: HistoryActionKind) {
  return kind ? historyStack.some((action) => action.context.kind === kind) : historyStack.length > 0
}

export function canRedoHistory(kind?: HistoryActionKind) {
  return kind ? redoStack.some((action) => action.context.kind === kind) : redoStack.length > 0
}

export function onHistoryChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function findLastActionIndex(stack: HistoryAction[], kind?: HistoryActionKind) {
  if (!kind) return stack.length - 1
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index]?.context.kind === kind) return index
  }
  return -1
}

function notifyHistoryListeners() {
  for (const listener of listeners) {
    listener()
  }
}

function enqueueHistoryOperation<T>(operation: () => Promise<T>) {
  const next = historyOperation.then(operation, operation)
  historyOperation = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}
