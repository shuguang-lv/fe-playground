import type { InjectionKey, Ref } from 'vue'
import type { User } from '@/types'
export const CURRENT_USER_KEY: InjectionKey<Ref<User>> = Symbol('User')
