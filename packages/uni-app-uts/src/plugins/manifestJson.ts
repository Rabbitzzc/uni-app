import path from 'path'
import fs from 'fs-extra'
import type { OutputAsset } from 'rollup'
import type { Plugin } from 'vite'
import { MANIFEST_JSON_UTS, parseJson } from '@dcloudio/uni-cli-shared'
import { ENTRY_FILENAME } from './utils'

function isManifest(id: string) {
  return id.endsWith(MANIFEST_JSON_UTS)
}

export function uniAppManifestPlugin(): Plugin {
  const manifestJsonPath = path.resolve(
    process.env.UNI_INPUT_DIR,
    'manifest.json'
  )
  const manifestJsonUTSPath = path.resolve(
    process.env.UNI_INPUT_DIR,
    MANIFEST_JSON_UTS
  )
  let manifestJson: Record<string, any> = {}
  return {
    name: 'uni:app-manifest',
    apply: 'build',
    resolveId(id) {
      if (isManifest(id)) {
        return manifestJsonUTSPath
      }
    },
    load(id) {
      if (isManifest(id)) {
        return fs.readFileSync(manifestJsonPath, 'utf8')
      }
    },
    transform(code, id) {
      if (isManifest(id)) {
        this.addWatchFile(
          path.resolve(process.env.UNI_INPUT_DIR, 'manifest.json')
        )
        manifestJson = parseJson(code)
        return `export default 'manifest.json'`
      }
    },
    generateBundle(_, bundle) {
      if (bundle[ENTRY_FILENAME]) {
        const asset = bundle[ENTRY_FILENAME] as OutputAsset
        const singleThread =
          manifestJson?.['uni-app-x']?.['singleThread'] === true
            ? `override singleThread: Boolean = true`
            : ''
        asset.source =
          asset.source +
          `
import { AppConfig } from "io.dcloud.uniapp.appframe"
export class UniAppConfig extends AppConfig {
    override name: string = "${manifestJson.name || ''}"
    override appid: string = "${manifestJson.appid || ''}"
    override versionName: string = "${manifestJson.versionName || ''}"
    override versionCode: string = "${manifestJson.versionCode || ''}"
    override uniCompileVersion: string = "${
      process.env.UNI_COMPILER_VERSION || ''
    }"
    // override tabBar = __uniTabBar
    // override launchPage = __uniLaunchPage
    ${singleThread}
    constructor() {}
}
`
      }
      fs.outputFileSync(
        path.resolve(process.env.UNI_OUTPUT_DIR, 'manifest.json'),
        JSON.stringify(
          {
            id: manifestJson.appid || '',
            name: manifestJson.name || '',
            description: manifestJson.description || '',
            version: {
              name: manifestJson.versionName || '',
              code: manifestJson.versionCode || '',
            },
            'uni-app-x': manifestJson['uni-app-x'] || {},
            app: manifestJson.app || {},
          },
          null,
          2
        )
      )
    },
  }
}
