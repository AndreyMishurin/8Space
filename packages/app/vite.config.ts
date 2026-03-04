import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

// https://vite.dev/config/
function readAppVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string }
    return packageJson.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function readGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'local'
  }
}

const appVersion = process.env.APP_VERSION ?? readAppVersion()
const buildSha = process.env.BUILD_SHA ?? readGitSha()
const buildDate = process.env.BUILD_DATE ?? new Date().toISOString()

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify(buildSha),
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(buildDate),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
