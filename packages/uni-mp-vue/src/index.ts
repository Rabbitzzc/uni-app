import plugin from './plugin'
// @ts-expect-error
import { createVueApp } from 'vue'
export function createApp(rootComponent: unknown, rootProps = null) {
  rootComponent && ((rootComponent as any).mpType = 'app')
  return createVueApp(rootComponent, rootProps).use(plugin)
}
export const createSSRApp = createApp
export * from './helpers'
// @ts-expect-error
export * from 'vue'
