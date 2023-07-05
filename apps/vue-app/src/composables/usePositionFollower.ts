import { h, defineComponent, computed } from 'vue'
import type { LazyOrRef } from '@/types'
import { unravel } from '@/utils'

export function usePositionFollower(position: LazyOrRef<{ x: number; y: number }>) {
  const style = computed(() => {
    const { x, y } = unravel(position)
    return {
      position: 'fixed',
      top: 0,
      left: 0,
      transform: `translate3d(${x}px, ${y}px, 0)`
    }
  })
  const Follower = defineComponent(
    (props, { slots }) =>
      () =>
        h('div', { ...props, style: style.value }, slots)
  )
  return Follower
}
