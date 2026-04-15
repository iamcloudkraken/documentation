// Polyfill require.resolveWeak for Node.js 25+ compatibility with webpack SSR
if (typeof require !== 'undefined' && !require.resolveWeak) {
  require.resolveWeak = function(id) {
    try { return require.resolve(id); } catch { return undefined; }
  };
}
