/* ES5-only startup watchdog: never log exception messages, URLs or credentials. */
(function () {
  var version = /Chrome\/([0-9]+)/.exec(navigator.userAgent);
  window.setTimeout(function () {
    var root = document.getElementById('tv-login-root');
    var status = document.getElementById('tv-login-status');
    if (root && status && root.getAttribute('data-ready') !== 'true') {
      var info = document.getElementById('tv-login-compat');
      if (info && version)
        info.textContent =
          '浏览器内核 Chrome ' + version[1] + '；登录诊断版本 QR-2';
      status.textContent =
        '登录脚本未启动（BOOT）：脚本加载失败或浏览器内核不兼容。请重新加载，或尝试 GeckoView 版本。';
    }
  }, 15000);
})();
