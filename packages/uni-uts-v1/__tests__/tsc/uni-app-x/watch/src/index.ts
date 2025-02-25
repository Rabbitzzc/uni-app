export const __sfc__ = defineComponent({
  setup() {
    const count = ref(0)
    watch(count, () => {})
    watchEffect(() => count.value)
    watchPostEffect(() => count.value)
    watchSyncEffect(() => count.value)
  },
})
