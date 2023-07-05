import { provide } from 'vue'
import { CURRENT_USER_KEY } from '@/injectionKeys'
import { injectWithSelf } from '@/utils'
import { useFetch } from '@vueuse/core'
import type { User } from '@/types'

export function useUserContext() {
  const existingContext = injectWithSelf(CURRENT_USER_KEY)
  if (existingContext) {
    console.log('context already exists')
    return { user: existingContext }
  }
  const { data: user, isFetching, error } = useFetch<User>('https://api.github.com/').json()
  provide(CURRENT_USER_KEY, user)
  return { user }
}
