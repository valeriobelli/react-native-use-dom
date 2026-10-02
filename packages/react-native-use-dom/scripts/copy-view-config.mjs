import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

// The view config JSON is required from `src/native/web-view.ts` with a relative path that reaches
// the package root from `src/native`. The built code lives one level deeper (`lib/<target>/native`),
// where the same relative path reaches `lib/`, so the built bundle needs its own copy there for the
// path to resolve in Metro, which bundles it statically.
const source = path.resolve('nitrogen/generated/shared/json/RNUseDomWebViewConfig.json')
const destination = path.resolve('lib/nitrogen/generated/shared/json/RNUseDomWebViewConfig.json')

mkdirSync(path.dirname(destination), { recursive: true })
copyFileSync(source, destination)
