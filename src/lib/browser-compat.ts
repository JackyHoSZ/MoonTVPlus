// Chrome 66 supports modules (so it skips Next's nomodule polyfills), but
// globalThis arrived in Chrome 71. Next's client AsyncLocalStorage reads it
// before React mounts. This browser-only ES5 shim must run before the runtime.
export const LEGACY_GLOBAL_THIS_POLYFILL =
  "if(typeof globalThis==='undefined'){Object.defineProperty(window,'globalThis',{value:window,writable:true,configurable:true});}";
