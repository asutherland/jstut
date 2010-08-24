/**
 * Unified file interface; lets us enumerate the contents of web and local
 *  directories and get their contents.
 **/

// teleport exposes XMLHttpRequest this way
var xhr = require("xhr");
// teleport exposes an empty module; we are expected to die if we are used for
//  local file access.
var file = require("file");

// apache always uses "
var RE_LINK = /href="([^\"]+)"/g;

/**
 * List the contents of a web directory by hitting the page, hoping it's an
 *  index, and treating all relative links observed as children of that
 *  directory.  If there is a trailing slash, we presume it to be a directory,
 *  otherwise a file.  Links that start with "?" are presumed to be sorting
 *  magic or what have you.
 *
 * This is intended to handle apache's mod_autoindex output and nothing else:
 *  http://httpd.apache.org/docs/2.2/mod/mod_autoindex.html
 *
 * It would be neat to support other things in the future, but it's not a
 *  concern right now.
 */
function webList(aPath, aCallback) {
  var req = new xhr.XMLHttpRequest();
  req.open("GET", aPath, true);
  req.addEventListener("load", function() {
    if (req.status != 200) {
      aCallback([]);
      return;
    }

    var match;
    var things = [];
    while ((match = RE_LINK.exec(req.responseText))) {
      var link = match[1];
      if (!link.length || link[0] === "?" || link[0] === "/" ||
          link[0] === "." || link.indexOf("//") != -1)
        continue;
      // After that comprehensive and absolutely infallible set of heuristics,
      //  we must be looking at a relative link.
      things.push(link);
    }
    aCallback(things);
  }, false);
  req.send(null);
}

RE_HTTP = /^http[s]?:\/\//;

exports.list = function(aPath, aCallback) {
  if (RE_HTTP.test(aPath)) {
    webList(aPath, aCallback);
    return;
  }
  aCallback(file.list(aPath));
};
