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

var pwomise = require("narscribblus/utils/pwomise");
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

function loadSource(aSourceRef) {
  var deferred = pwomise.defer("load.source", aSourceRef);
  var url = path(aSourceRef, ".js", "lib", true);
  var req = new XMLHttpRequest();
  req.open("GET", url, true);
  req.addEventListener("load", function() {
    if (req.status == 200)
      deferred.resolve(req.responseText);
    else
      deferred.reject(req.status);
  }, false);
  // XXX disable caching for dev only
  //req.setRequestHeader("Cache-Control", "no-cache");
  req.send(null);
  return deferred.promise;
}
exports.loadSource = loadSource;

function loadData(aDataRef) {
  var deferred = pwomise.defer("load.data", aDataRef);
  var url = path(aDataRef, "", "data", false);
  var req = new XMLHttpRequest();
  req.open("GET", url, true);
  req.addEventListener("load", function() {
    if (req.status == 200)
      deferred.resolve(req.responseText);
    else
      deferred.reject(req.status);
  }, false);
  // XXX disable caching for dev only
  //req.setRequestHeader("Cache-Control", "no-cache");
  req.send(null);
  return deferred.promise;
}
exports.loadData = loadData;

function dataDirUrl(aDataRef) {
  return path(aDataRef, "", "data", false);
}
exports.dataDirUrl = dataDirUrl;
