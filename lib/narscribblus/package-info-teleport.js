/**
 * Our teleport implementation here just assumes that the catalog is correct
 *  and bases everything off of that.  Teleport only keeps a copy of the wrapped
 *  source around and we may not actually be loading the things we want to look
 *  at, so we fetch things as requested.
 *
 * All public documentation lives in package-info.js.
 **/

var catalog = require("teleport/packages").catalog;

// from teleport.js, but modified
function path(id, suffix, dirtype, repeatPackage) {
  var url = id, name = id.split("/")[0];
  if (name in catalog) {
    var descriptor = catalog[name];
    url = descriptor.path
      + ((descriptor.directories && (dirtype in descriptor.directories))
         ? descriptor.directories[dirtype] : dirtype)
      + "/" + (repeatPackage ? (name + "/") : "") +
      id.substr(name.length + 1);
  }
  return url + suffix;
}

function loadSource(aSourceRef, aCallback, aErrBack) {
  var url = path(aSourceRef, ".js", "lib", true);
  var req = new XMLHttpRequest();
  req.open("GET", url, true);
  req.addEventListener("load", function() {
    if (req.status == 200)
      aCallback(aSourceRef, req.responseText);
    else
      aErrBack(aSourceRef, req.status);
  }, false);
  req.setRequestHeader("Cache-Control", "no-cache");
  req.send(null);
}
exports.loadSource = loadSource;

function loadData(aDataRef, aCallback, aErrBack) {
  var url = path(aDataRef, "", "data", false);
  var req = new XMLHttpRequest();
  req.open("GET", url, true);
  req.addEventListener("load", function() {
    if (req.status == 200)
      aCallback(aDataRef, req.responseText);
    else
      aErrBack(aDataRef, req.status);
  }, false);
  req.setRequestHeader("Cache-Control", "no-cache");
  req.send(null);
}
exports.loadData = loadData;
