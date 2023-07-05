<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import { useUserContext } from '@/composables/useUserContext'
import { usePositionFollower } from '@/composables/usePositionFollower'
import { useMouse } from '@vueuse/core'

const { user } = useUserContext()

const { x, y } = useMouse()
const Follower = usePositionFollower(() => ({
  x: x.value,
  y: y.value
}))
</script>

<template>
  <div class="tw-flex tw-flex-col tw-items-center tw-w-[70vw]">
    <nav class="tw-flex tw-justify-center">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/async-setup">async setup()</RouterLink>
      <RouterLink to="/injections">Injections</RouterLink>
    </nav>

    <RouterView />

    <Follower class="tw-ml-4">{{ x }}, {{ y }}</Follower>
  </div>
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
