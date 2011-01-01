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
 * Web document loader; gets the document text, feeds it along to the doc-loader
 *  to process then fires up the proper "app" to render the output.  A lot of
 *  this is now less tied to web display and should be refactored out.
 **/

define("narscribblus-plat/web-loader",
  [
    "exports",
    "require",
    "narscribblus/doc-loader",
    "narscribblus-plat/package-info",
    "narscribblus-plat/utils/env",
    "narscribblus/utils/pwomise",
  ],
  function (
    exports,
    require,
    loader,
    pkginfo,
    $env,
    pwomise
  ) {

var when = pwomise.when;

var gPackageBaseRelPath;

exports.main = function web_loader_main(relPath) {
  gPackageBaseRelPath = relPath;
  var env = $env.getEnv();
  if (!("doc" in env) && !("src" in env) && !("srcdoc" in env)) {
    var body = document.getElementsByTagName("body")[0];
    body.innerHTML = "I am going to level with you. " +
      "I need you to put the path of the narscribblus doc in the 'doc' " +
      "argument type thing.  Failure to do so results in sadness and messages "+
      "like this one.  <i>Sniff sniff</i>.";
    return;
  }
  var path;
  if ("doc" in env) {
    path = env.doc;
    when(pkginfo.loadData(path),
         exports.showDoc.bind(null, path),
         explodeSadFace.bind(null, path));
  }
  else if ("src" in env) {
    path = env.src;
    when(pkginfo.loadSource(path),
         exports.showDoc.bind(null, path),
         explodeSadFace.bind(null, path));
  }
  else if ("srcdoc" in env) {
    path = env.srcdoc;
    when(pkginfo.loadDoc(path),
         exports.showDoc.bind(null, path),
         explodeSadFace.bind(null, path));
  }
};

function explodeSadFace(aDocPath, aStatusCode) {
  var body = document.getElementsByTagName("body")[0];
  if (aStatusCode == 404) {
    body.innerHTML = "We tried to find a document that does not exist: " +
      aDocPath;
  }
  else {
    body.innerHTML = "I couldn't find the document: " +
      aDocPath + "(" + aStatusCode + ")";
  }
}

/**
 * Wrap a call to the document loader with some minor configuration setup
 *  (before) and dynamic loading of the appropriate application (after).
 *
 *
 * Compare and constrast with main.js' showWhereYouCan and skbwl-protocol.js'
 *  makeDocURI.
 *
 * If we successfully retrieve the document then we create an iframe for it to
 *  live in.
 *
 * @args[
 *   @param[aDocPath String]{
 *     The friendly description of the path.  It's hiding the fact that you also
 *     need to know whether doc (loadData), src (loadSource), or srcdoc
 *     (loadDoc) was used, since those also perform transforms on the path.
 *   }
 *   @param[aContents String]{
 *     The text that makes up the document.
 *   }
 * ]
 */
exports.showDoc = function showDoc(aDocPath, aContents) {
  var env = $env.getEnv();
  var options = {
  };
  var docPath = env.doc;
  if ("src" in env) {
    options.lang = "narscribblus/js";
    docPath = env.src;
  }
  if ("forcelang" in env)
    options.forceLang = env.forcelang;
  if ("mode" in env)
    options.mode = env.mode;

  when(loader.parseDocument(aContents, aDocPath, options),
       function(parsed) {
         if (!("app" in parsed) || parsed.app == "html") {
           showOldSchoolIFrame(parsed);
           return;
         }

         var appModule;
         switch (parsed.app) {
           case "browse":
             appModule = "narscribblus/present/app-browse";
             break;
           case "doc":
             appModule = "narscribblus/present/app-doc";
             break;
           default:
             throw new Error("unrecognized app code: " + parsed.app);
         }

         require([appModule], function(app) {
           app.showDoc(parsed, document, gPackageBaseRelPath);
         });
       });
};

function showOldSchoolIFrame(parseOutput) {
  var body = document.getElementsByTagName("body")[0];
  body.setAttribute(
    "style",
    "height: 100%; padding: 0; margin: 0; border: 0; overflow: none;");

  // create an iframe to hold the document we built.
  var iframe = document.createElement("iframe");
  //iframe.setAttribute("seamless", "seamless");
  iframe.setAttribute("width", "100%");
  iframe.setAttribute("height", "100%");
  iframe.setAttribute("style",
    "border: 0; margin: 0; padding: 0; height: 99%; overflow: none;");
  body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(parseOutput.body);
  iframe.contentDocument.close();

  // propagate the title outwards...
  var innerDocTitleElem =
    iframe.contentDocument.getElementsByTagName("title")[0];
  if (innerDocTitleElem)
    document.getElementsByTagName("title")[0].textContent =
        innerDocTitleElem.textContent;

  // the body output is supposed to be escaped legal HTML...
  if (parseOutput.liveject)
    parseOutput.liveject(iframe.contentDocument, iframe.contentWindow);
};


}); // end define
