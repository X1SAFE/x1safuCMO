// IMPORTANT: polyfills must be the very first import
import { Buffer } from 'buffer'

// Make Buffer available globally (required by @solana/web3.js)
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.Buffer = window.Buffer ?? Buffer
  // @ts-ignore
  window.global = window.global ?? window
}

if (typeof globalThis !== 'undefined') {
  // @ts-ignore
  globalThis.Buffer = globalThis.Buffer ?? Buffer
}

export {}
