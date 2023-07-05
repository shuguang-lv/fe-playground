<script setup lang="ts">
import { ref, computed} from 'vue'
import { useFetch } from '@vueuse/core'

const { data, isFetching, error } = useFetch<any>('https://api.github.com/').json()

// const data = ref<any>(null)

// fetch('https://api.github.com/')
//   .then(r => r.json())
//   .then(res => data.value = res)

const user = computed(() => data.value?.current_user_url)
</script>

<template>
  <div>
    {{ user }}
  </div>
</template>

