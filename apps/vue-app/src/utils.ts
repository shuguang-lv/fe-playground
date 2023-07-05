import { getCurrentInstance, inject, type InjectionKey } from 'vue'
export function injectWithSelf<T>(key: InjectionKey<T>): T | undefined {
  const vm = getCurrentInstance() as any
  return vm?.provides[key as any] || inject(key)
}
