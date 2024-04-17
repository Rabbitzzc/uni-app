import path from 'path'
import { extend, isFunction } from '@vue/shared'
import type { RPT2Options } from 'rollup-plugin-typescript2'
import { isInHBuilderX } from '../../shared'
interface UTS2JavaScriptOptions extends Omit<RPT2Options, 'transformers'> {
  inputDir: string
  version: string
  modules: Record<string, any>
}
type uts2js = (options: UTS2JavaScriptOptions) => import('rollup').Plugin[]

export const uts2js: uts2js = (options) => {
  const inputDir = options.inputDir
  const isWeb = process.env.UNI_UTS_PLATFORM === 'web'
  extend(options, {
    cwd: inputDir,
    check: isWeb,
    noCache: process.env.NODE_ENV === 'production' || isWeb,
    tsconfigOverride: {
      compilerOptions: {
        rootDir: inputDir,
        sourceMap: isWeb,
        ignoreDeprecations: '5.0',
        preserveValueImports: true,
        importsNotUsedAsValues: 'preserve',
        verbatimModuleSyntax: false,
      },
    },
  })
  if (!options.tsconfigOverride) {
    options.tsconfigOverride = {}
  }
  if (!options.tsconfigOverride.compilerOptions) {
    options.tsconfigOverride.compilerOptions = {}
  }
  options.tsconfigOverride.compilerOptions.sourceMap =
    process.env.NODE_ENV === 'development'
  if (!options.tsconfig) {
    if (isInHBuilderX()) {
      options.tsconfig = path.resolve(
        __dirname,
        '../../../lib/tsconfig/hbuilderx/tsconfig.json'
      )
    } else {
      options.tsconfig = path.resolve(inputDir, '../tsconfig.json')
    }
  }
  if (!options.typescript) {
    options.typescript = require('../../../lib/typescript')
  }
  if (isInHBuilderX()) {
    const hxPluginPath = process.env.UNI_HBUILDERX_PLUGINS
    extend(options.tsconfigOverride.compilerOptions, {
      paths: {
        '@dcloudio/*': [
          path.resolve(
            hxPluginPath,
            'uniapp-cli-vite/node_modules/@dcloudio/*'
          ),
        ],
        '@vue/runtime-core': [
          path.resolve(
            hxPluginPath,
            'uniapp-cli-vite/node_modules/@vue/runtime-core'
          ),
        ],
        vue: [
          path.resolve(
            hxPluginPath,
            'uniapp-cli-vite/node_modules/@vue/runtime-core'
          ),
        ],
      },
      typeRoots: [path.resolve(__dirname, '../../../lib/tsconfig/types')],
    })
  } else {
    extend(options.tsconfigOverride.compilerOptions, {
      paths: {
        vue: [path.resolve(inputDir, '../node_modules/@vue/runtime-core')],
      },
      typeRoots: [path.resolve(__dirname, '../../../lib/tsconfig/types')],
    })
  }
  if (isFunction(globalThis.uts2js)) {
    return globalThis.uts2js(options)
  }
  return require('../../../lib/javascript').uts2js(options)
}
