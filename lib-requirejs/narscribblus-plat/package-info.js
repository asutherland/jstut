/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at:
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Messaging Code.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Our teleport implementation here just assumes that the catalog is correct
 *  and bases everything off of that.  Teleport only keeps a copy of the wrapped
 *  source around and we may not actually be loading the things we want to look
 *  at, so we fetch things as requested.
 *
 * All public documentation lives in package-info.js.
 **/

require.def("narscribblus-plat/package-info",
  [
    "exports",
    "require",
    "narscribblus/utils/pwomise",
  ],
  function(
    exports,
    require,
    pwomise
  ) {

var config = require.config;

function commonLoad(url, promiseName, promiseRef) {
  var deferred = pwomise.defer(promiseName, promiseRef);
  var req = new XMLHttpRequest();
  req.open("GET", url, true);
  req.addEventListener("load", function() {
    if (req.status == 200)
      deferred.resolve(req.responseText);
    else
      deferred.reject(req.status);
  }, false);
  // We used to disable caching here with Cache-Control.  Instead, we are
  //  making this the problem of the development web-server to provide us
  //  with proper cache directives.  Or the client can nuke or otherwise
  //  disable its cache.
  req.send(null);
  return deferred.promise;
}

/**
 * Returns a promise that provides the source of a given module.
 */
function loadSource(aSourceRef) {
  var deferred = pwomise.defer("load.source", aSourceRef);
  var url = require.nameToUrl(aSourceRef, null);
  return commonLoad(url, "load.source", aSourceRef);
}
exports.loadSource = loadSource;

function commonPackageLoad(aRef, aDirName) {
  var refParts = aRef.split("/");
  var packageName = refParts[0];
  var relPath = refParts.slice(1).join("/");

  var url = config.baseUrl + packageName + "/" + aDirName + "/" + relPath;
  return commonLoad(url, "load." + aDirName, aRef);
}

/**
 * Load a data file from the given package.
 */
function loadData(aDataRef) {
  return commonPackageLoad(aDataRef, "data");
}
exports.loadData = loadData;

function loadDoc(aDocRef) {
  return commonPackageLoad(aDocRef, "docs");  
}
exports.loadDoc = loadDoc;

function dataDirUrl(aDataRef) {
  var refParts = aDataRef.split("/");
  var packageName = refParts[0];
  var relPath = refParts.slice(1).join("/");

  var url = config.baseUrl + packageName + "/data/" + relPath;
  return url;
}
exports.dataDirUrl = dataDirUrl;

}); // end require.def
