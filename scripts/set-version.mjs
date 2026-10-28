import { readFileSync, writeFileSync } from 'node:fs'

const version = process.argv[2]?.replace(/^v/, '')
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: node scripts/set-version.mjs <major.minor.patch>')
  process.exit(1)
}

const updateJson = (path) => {
  const value = JSON.parse(readFileSync(path, 'utf8'))
  value.version = version
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

const replaceOnce = (path, pattern, replacement) => {
  const source = readFileSync(path, 'utf8')
  const next = source.replace(pattern, replacement)
  if (next === source) {
    if (!pattern.test(source)) throw new Error(`Could not update version in ${path}`)
    return
  }
  writeFileSync(path, next)
}

updateJson('package.json')
updateJson('src-tauri/tauri.conf.json')
replaceOnce(
  'src-tauri/Cargo.toml',
  /(^\[package\]\s*\nname = "memory"\s*\nversion = ")[^"]+("\s*$)/m,
  `$1${version}$2`,
)
replaceOnce(
  'src-tauri/Cargo.lock',
  /(\[\[package\]\]\s*\nname = "memory"\s*\nversion = ")[^"]+("\s*)/,
  `$1${version}$2`,
)
replaceOnce(
  'src/Full.tsx',
  /const APP_VERSION = '[^']+'\s*\/\/ release-version/,
  `const APP_VERSION = '${version}' // release-version`,
)

console.log(`Set Stash version to ${version}`)

