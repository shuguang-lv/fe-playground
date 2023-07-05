<script setup lang="ts">
import { computed } from 'vue'

import { useUserContext } from '@/composables/useUserContext'

const { user } = useUserContext()

// const data = ref<any>(null)

// fetch('https://api.github.com/')
//   .then(r => r.json())
//   .then(res => data.value = res)

// const user = computed(() => data.value?.current_user_url)
</script>

<template>
  <div>
    {{ user }}
  </div>
</template>
