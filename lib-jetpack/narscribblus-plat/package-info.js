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
 * Jetpack packaging information is stored in the 'packaging' info global.
 *  Both source and data is accessed via resource:// protocol paths which
 *  can be converted back into filesystem references.  We do not assume
 *  anything clever about layout.
 *
 * All public documentation lives in package-info.js.
 **/

var file = require("file");
var url = require("url");

function loadSource(aSourceRef) {
  var loader = packaging.harnessService.loader;
  var path = loader.fs.resolveModule(null, aSourceRef);
  var o = loader.fs.getFile(path);

  return o.contents;
}
exports.loadSource = loadSource;

var packageData = packaging.options.packageData;

function loadData(aDataRef) {
  var path = url.toFilename(dataDirUrl(aDataRef));
  return file.read(path);
}
exports.loadData = loadData;

function dataDirUrl(aDataRef) {
  var refParts = aDataRef.split("/");
  var packageName = refParts[0];
  var relPath = refParts.slice(1).join("/");

  console.log("package name", packageName, "data", packageData[packageName],
              "relPath", relPath);
  console.log("RETURNING", packageData[packageName] + relPath);
  if (packageName in packageData)
    return packageData[packageName] + relPath;
  throw new Error("nothing is known about package " + packageName);
}
exports.dataDirUrl = dataDirUrl;
