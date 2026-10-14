// Chrome 66 supports modules (so it skips Next's nomodule polyfills), but
// globalThis arrived in Chrome 71. Next's client AsyncLocalStorage reads it
// before React mounts. This browser-only ES5 shim must run before the runtime.
export const LEGACY_GLOBAL_THIS_POLYFILL =
  "if(typeof globalThis==='undefined'){Object.defineProperty(window,'globalThis',{value:window,writable:true,configurable:true});}";

// Chrome 42–67 defaults fetch credentials to omit. Restore modern same-origin
// defaults before app effects/refresh interceptors run. Explicit policies and
// Request objects keep their existing semantics; never default to include.
export const LEGACY_FETCH_CREDENTIALS_POLYFILL = `(function(){
  if(typeof window.fetch!=='function'||typeof window.Request!=='function')return;
  if(new window.Request(window.location.href).credentials!=='omit')return;
  var nativeFetch=window.fetch;
  window.fetch=function(input,init){
    if(!(input instanceof window.Request)&&(!init||typeof init.credentials==='undefined')){
      var options=Object.create(init||null);
      Object.defineProperty(options,'credentials',{value:'same-origin',enumerable:true});
      return nativeFetch.call(window,input,options);
    }
    return nativeFetch.call(window,input,init);
  };
}());`;
