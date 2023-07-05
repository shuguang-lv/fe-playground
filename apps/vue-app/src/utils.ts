import { getCurrentInstance, inject, unref, isRef, type InjectionKey } from 'vue'
import type { MaybeLazyRef, LazyOrRef } from '@/types'

export function injectWithSelf<T>(key: InjectionKey<T>): T | undefined {
  const vm = getCurrentInstance() as any
  return vm?.provides[key as any] || inject(key)
}

export function unravel<T>(value: MaybeLazyRef<T>): T {
  if (typeof value === 'function') {
    return value()
  }
  return unref(value)
}

export function isWatchable<T>(value: MaybeLazyRef<T>): value is LazyOrRef<T> {
  return isRef(value) || typeof value === 'function'
}
