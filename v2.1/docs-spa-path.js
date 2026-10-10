// Deep links into a version directory, on a host that has one 404 page.
//
// GitHub Pages answers every missing path with the site root's `404.html`,
// whatever directory the path was under. A copy's own `404.html` is never
// consulted, so `/TMDataGrid/next/docs/testing` arrives running the root's
// bundle: the wrong version's documentation, and a bundle whose idea of the
// current page is off by the directory it never knew it was in.
//
// So the root's 404 sends such a path to the copy that owns it, parking the
// path in the query - `/TMDataGrid/next/?/docs/testing` - because that URL is
// a real file and Pages serves it. The same script, running in that copy,
// puts the path back before the router reads it.
//
// Loaded synchronously in `<head>`: module scripts are deferred, so this runs
// before the application boots and the router sees a settled URL.
//
// Deliberately dependency-free. It runs inside bundles it knows nothing about,
// including ones built long before it existed.
(function () {
  var script = document.currentScript;
  var root = (script && script.getAttribute("data-site-root")) || "/";
  var slug = (script && script.getAttribute("data-slug")) || "root";
  var location = window.location;

  /** The directories a copy can live in. Mirrors the deploy's slugs. */
  var SLUG = /^(next|v\d+\.\d+|b\/[^/]+)\/(.*)$/;

  // A query that begins with "/" is a path this script parked. Anything the
  // original URL carried beyond it follows, with "&" escaped so the split
  // below cannot cut a real query in half.
  if (location.search.indexOf("?/") === 0) {
    var parked = location.search.slice(2).split("&");
    var path = parked.shift();
    var query = parked.join("&").replace(/~and~/g, "&");
    history.replaceState(
      null,
      "",
      location.pathname + path + (query ? "?" + query : "") + location.hash,
    );
    return;
  }

  // Only the root's 404 has to redirect: every other copy is reached by a URL
  // that is already inside it.
  if (slug !== "root" || location.pathname.indexOf(root) !== 0) return;

  var owner = SLUG.exec(location.pathname.slice(root.length));
  if (!owner) return;

  var carried = location.search
    ? "&" + location.search.slice(1).replace(/&/g, "~and~")
    : "";
  location.replace(
    root + owner[1] + "/?/" + owner[2] + carried + location.hash,
  );
})();
