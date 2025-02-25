import type { ComponentPublicInstance } from 'vue'
import { removePage } from '../../../service/framework/page/getCurrentPages'
import { closeWebview } from './webview'
import { removeTabBarPage } from '../../framework/app/tabBar'
import {
  entryPageState,
  navigateToPagesBeforeEntryPages,
  reLaunchToPagesBeforeEntryPages,
  redirectToPagesBeforeEntryPages,
  switchTabPagesBeforeEntryPages,
} from '../../framework/app'
import { $navigateTo } from './navigateTo'
import { $switchTab } from './switchTab'
import { _redirectTo } from './redirectTo'
import { $reLaunch } from './reLaunch'
import { getCurrentPage } from '@dcloudio/uni-core'
import { addLeadingSlash } from '@dcloudio/uni-shared'

export function closePage(
  page: ComponentPublicInstance,
  animationType: string,
  animationDuration?: number
) {
  closeWebview(page.$nativePage!, animationType, animationDuration)
  removePage(page)
  removeTabBarPage(page)
}

export function updateEntryPageIsReady(path: string) {
  if (
    !getCurrentPage() &&
    path === addLeadingSlash(__uniConfig.entryPagePath!)
  ) {
    entryPageState.isReady = true
  }
}

export function handleBeforeEntryPageRoutes() {
  if (entryPageState.handledBeforeEntryPageRoutes) {
    return
  }
  entryPageState.handledBeforeEntryPageRoutes = true

  const navigateToPages = [...navigateToPagesBeforeEntryPages]
  navigateToPagesBeforeEntryPages.length = 0
  // @ts-expect-error
  navigateToPages.forEach(({ args, handler }) => $navigateTo(args, handler))

  const switchTabPages = [...switchTabPagesBeforeEntryPages]
  switchTabPagesBeforeEntryPages.length = 0
  switchTabPages.forEach(({ args, handler }) => $switchTab(args, handler))

  const redirectToPages = [...redirectToPagesBeforeEntryPages]
  redirectToPagesBeforeEntryPages.length = 0
  redirectToPages.forEach(({ args, handler }) =>
    _redirectTo(args).then(handler.resolve).catch(handler.reject)
  )

  const reLaunchToPages = [...reLaunchToPagesBeforeEntryPages]
  reLaunchToPagesBeforeEntryPages.length = 0
  reLaunchToPages.forEach(({ args, handler }) => $reLaunch(args, handler))
}
