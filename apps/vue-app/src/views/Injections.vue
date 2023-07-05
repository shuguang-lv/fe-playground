<script setup lang="ts">
import { useUserContext } from '@/composables/useUserContext'

const { user } = useUserContext()
</script>

<template>
  <div>{{ user }}</div>
</template>

<style scoped></style>
