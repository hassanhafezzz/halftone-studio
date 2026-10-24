(function () {
  var root = document.documentElement, KEY = 'theme';
  function stored() { try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } }
  function current() { return root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); }
  var t = stored();
  if (t) root.setAttribute('data-theme', t);
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('theme');
    if (!b) return;
    function label() { var next = current() === 'dark' ? 'light' : 'dark'; b.setAttribute('data-next', next); b.setAttribute('aria-label', 'Switch to ' + next + ' mode'); }
    b.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      label();
    });
    label();
  });
})();
