/**
 * M5-1（F17）：外围工具页共用的**非受控**表单原语。
 *
 * 为什么不是受控组件：旧 public 页一律 `$el.value` 直读字段值，外部驱动（含
 * `tests/workbench-interactions.mjs`、`tests/roadmap-panels.mjs` 这类先 `el.value = …`
 * 再派发 `input`/`click` 的脚本）依赖这一语义。React 的 `inputValueTracking` 会吞掉
 * 「程序赋值 + 派发 input」触发的 onChange，改成受控字段会让这类驱动静默失效，
 * 因此这里统一用 `defaultValue` + callback ref，值只在事件处理器里按需读取。
 */
import { useCallback, useRef } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export type FieldEl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

export interface FieldBag {
  /** 取某个 id 的稳定 callback ref（同一 id 跨渲染返回同一函数，避免每次重挂）。 */
  fieldRef: (id: string) => (el: FieldEl | null) => void
  readValue: (id: string) => string
  readFiles: (id: string) => File[]
  readChecked: (id: string) => boolean
  selectedValues: (id: string) => string[]
  setValue: (id: string, value: string) => void
  setChecked: (id: string, checked: boolean) => void
  setSelectedValues: (id: string, values: string[]) => void
  focus: (id: string) => void
  click: (id: string) => void
}

export function useFieldBag(): FieldBag {
  const elements = useRef(new Map<string, FieldEl>())
  const refFns = useRef(new Map<string, (el: FieldEl | null) => void>())
  const fieldRef = useCallback((id: string) => {
    let fn = refFns.current.get(id)
    if (!fn) {
      fn = (el: FieldEl | null) => {
        if (el) elements.current.set(id, el)
        else elements.current.delete(id)
      }
      refFns.current.set(id, fn)
    }
    return fn
  }, [])
  const readValue = useCallback((id: string): string => elements.current.get(id)?.value ?? '', [])
  const readFiles = useCallback((id: string): File[] => {
    const el = elements.current.get(id)
    return el instanceof HTMLInputElement ? Array.from(el.files ?? []) : []
  }, [])
  const readChecked = useCallback((id: string): boolean => {
    const el = elements.current.get(id)
    return el instanceof HTMLInputElement ? el.checked : false
  }, [])
  const selectedValues = useCallback((id: string): string[] => {
    const el = elements.current.get(id)
    return el instanceof HTMLSelectElement ? Array.from(el.selectedOptions).map((option) => option.value) : []
  }, [])
  const setValue = useCallback((id: string, value: string): void => {
    const el = elements.current.get(id)
    if (el) el.value = value
  }, [])
  const setChecked = useCallback((id: string, checked: boolean): void => {
    const el = elements.current.get(id)
    if (el instanceof HTMLInputElement) el.checked = checked
  }, [])
  const setSelectedValues = useCallback((id: string, values: string[]): void => {
    const el = elements.current.get(id)
    if (!(el instanceof HTMLSelectElement)) return
    for (const option of Array.from(el.options)) option.selected = values.includes(option.value)
  }, [])
  const focus = useCallback((id: string): void => { elements.current.get(id)?.focus() }, [])
  const click = useCallback((id: string): void => { elements.current.get(id)?.click() }, [])
  return { fieldRef, readValue, readFiles, readChecked, selectedValues, setValue, setChecked, setSelectedValues, focus, click }
}

interface LabeledFieldProps {
  id: string
  label: string
  refFn: (el: FieldEl | null) => void
}

export function LabeledInput({ id, label, refFn, ...rest }: LabeledFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      <label>{label}</label>
      <input id={id} ref={refFn} {...rest} />
    </>
  )
}

export function LabeledSelect({ id, label, refFn, children, ...rest }: LabeledFieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <>
      <label>{label}</label>
      <select id={id} ref={refFn} {...rest}>{children}</select>
    </>
  )
}

export function LabeledTextarea({ id, label, refFn, ...rest }: LabeledFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <>
      <label>{label}</label>
      <textarea id={id} ref={refFn} {...rest} />
    </>
  )
}

/** 状态行：`error` 为真时套用旧页的 `.error` 配色。 */
export function StatusLine({ id, text, error = false }: { id: string; text: string; error?: boolean }) {
  return <div id={id} className={error ? 'status error' : 'status'}>{text}</div>
}
