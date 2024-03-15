import path, { basename, join, relative } from 'path'
import fs from 'fs-extra'
import { APP_PLATFORM } from './manifest/utils'
import { normalizePath } from './shared'

export function isEncrypt(pluginDir: string) {
  return fs.existsSync(path.resolve(pluginDir, 'encrypt'))
}

function createRollupCommonjsCode(
  pluginDir: string,
  pluginRelativeDir: string
) {
  return `
import * as commonjsHelpers from "\0commonjsHelpers.js"

import { __module, exports as __exports } from "\0${normalizePath(
    pluginDir
  )}?commonjs-module"

Object.defineProperty(__exports, '__esModule', { value: true })      
__module.exports = uni.requireUTSPlugin('${normalizePath(pluginRelativeDir)}')

export default /*@__PURE__*/commonjsHelpers.getDefaultExportFromCjs(__exports);
export { __exports as __moduleExports };
`
}
function createWebpackCommonjsCode(pluginRelativeDir: string) {
  return `
module.exports = uni.requireUTSPlugin('${normalizePath(pluginRelativeDir)}')
`
}

export async function compileEncrypt(pluginDir: string, isX = false) {
  const inputDir = process.env.UNI_INPUT_DIR
  const outputDir = process.env.UNI_OUTPUT_DIR
  const utsPlatform = process.env.UNI_UTS_PLATFORM as APP_PLATFORM
  const isRollup = !!process.env.UNI_UTS_USING_ROLLUP
  const pluginRelativeDir = relative(inputDir, pluginDir)
  const outputPluginDir = normalizePath(join(outputDir, pluginRelativeDir))
  let code = isX
    ? ''
    : isRollup
    ? createRollupCommonjsCode(pluginDir, pluginRelativeDir)
    : createWebpackCommonjsCode(pluginRelativeDir)
  if (process.env.NODE_ENV !== 'development') {
    // 生成wgt和本地生成资源，无需复制加密插件目录
    const needCopy = !(
      process.env.UNI_APP_PRODUCTION_TYPE === 'WGT' ||
      process.env.UNI_APP_PRODUCTION_TYPE === 'LOCAL_PACKAGING'
    )
    if (needCopy) {
      // 复制插件目录
      fs.copySync(pluginDir, join(outputDir, pluginRelativeDir))
    }
    return {
      dir: outputPluginDir,
      code,
      deps: [] as string[],
      encrypt: true,
      meta: { commonjs: { isCommonJS: true } },
    }
  }
  const cacheDir = process.env.HX_DEPENDENCIES_DIR!
  if (!isX) {
    // 读取缓存目录的 js code
    const indexJsPath = resolveJsCodeCacheFilename(
      utsPlatform,
      cacheDir,
      pluginRelativeDir
    )
    if (fs.existsSync(indexJsPath)) {
      code = fs.readFileSync(indexJsPath, 'utf-8') + code
    } else {
      console.error(
        `uts插件[${path.basename(pluginDir)}]不存在，请重新打包自定义基座`
      )
    }
  } else {
    const jarPath = resolveJarCacheFilename(cacheDir, pluginRelativeDir)
    if (!fs.existsSync(jarPath)) {
      console.error(
        `uts插件[${path.basename(pluginDir)}]不存在，请重新打包自定义基座`
      )
    }
  }
  return {
    dir: outputPluginDir,
    code,
    deps: [] as string[],
    encrypt: true,
    meta: { commonjs: { isCommonJS: true } },
  }
}

export function resolveJsCodeCacheFilename(
  platform: APP_PLATFORM,
  cacheDir: string,
  pluginRelativeDir: string
) {
  return join(cacheDir, platform, 'uts', pluginRelativeDir, 'index.js')
}

export function resolveJarCacheFilename(
  cacheDir: string,
  pluginRelativeDir: string
) {
  return join(cacheDir, pluginRelativeDir, basename(pluginRelativeDir) + '.jar')
}
