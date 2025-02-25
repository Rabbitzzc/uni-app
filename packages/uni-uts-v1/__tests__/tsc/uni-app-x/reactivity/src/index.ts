export const __sfc__ = defineComponent({
  setup() {
    const obj = {} as UTSJSONObject

    const refObj = ref(obj)
    // @ts-expect-error
    toRaw<UTSJSONObject>(refObj) === obj

    const reactiveObj = reactive(obj)
    toRaw<UTSJSONObject>(reactiveObj) === obj

    const readonlyObj = readonly(obj)
    toRaw<UTSJSONObject>(readonlyObj) === obj

    const shallowReactiveObj = shallowReactive(obj)

    toRaw<UTSJSONObject>(shallowReactiveObj) === obj

    const shallowReadonlyObj = shallowReadonly(obj)

    toRaw<UTSJSONObject>(shallowReadonlyObj) === obj
  },
})
