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

define("jstut-plat/web-loader",
  [
    "exports",
    "require",
    "jstut/doc-loader",
    "jstut-plat/package-info",
    "jstut-plat/utils/env",
    "jstut/utils/pwomise",
    "jstut/docfusion"
  ],
  function (
    exports,
    require,
    loader,
    $pkginfo,
    $env,
    pwomise,
    $docfusion
  ) {

var when = pwomise.when;

var gPackageBaseRelPath, gDocFusion = null;

exports.main = function web_loader_main(relPath, pathToJstutJson) {
  gPackageBaseRelPath = relPath;
  var env = $env.getEnv(), path;
  gDocFusion = new $docfusion.DocFusion();
  when(gDocFusion.bootstrapUniverse(pathToJstutJson),
       function() {
    var pkg = gDocFusion.originPackage;
    // (if nothing is specified) give them the overview for the package.
    if (!("doc" in env) && !("src" in env)) {
      // crawl all the source files; in the future we might be able to just
      //  grab the precomputed data for this from somewhere.
      when(pkg.crawlAllSourceFiles(),
           exports.showOverview,
           explodeSadFace.bind(null, 'overview'));
    }
    else if ("doc" in env) {
      path = env.doc;
      when(pkg.requireDoc(path),
           exports.showDoc,
           explodeSadFace.bind(null, path));
    }
    else if ("src" in env) {
      path = env.src;
      when(pkg.requireModule(path),
           exports.showDoc,
           explodeSadFace.bind(null, path));
    }
    // XXX we used to have a 'srcdoc' mechanism which is not self-explanatory
    //  and I think was related to our original jetpack-focused implementation
    //  where things that weren't source files had to live under 'data'.  IT
    //  is no longer the case that we are hardcore-jetpack, nor is it the case
    //  that jetpack is so strict about paths.
  }, explodeSadFace.bind(null, pathToJstutJson));
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

// XXX this needs to get hooked up to the parse failure pipeline; this used
//  to be directly slaved to the file parser so we'd get its rejections,
//  but got moot-bandoned by the change to using requireDoc
function explodeParseFailure(ex) {
  // force app-doc in failure cases since it has provision for failure
  //  display
  require(["jstut/present/app-doc"], function(app) {
    app.showDoc({
                  app: "parse-failure",
                  kind: "webbish",
                  path: aDocPath,
                  ex: ex
                },
                document, gPackageBaseRelPath);
  });
}

/**
 *
 */
exports.showOverview = function showOverview() {

};

/**
 * requireDoc/requireModule has completed successfully, and we're getting the
 *  ModuleInfo or DocInfo structure back.
 */
exports.showDoc = function showDoc(aMetaInfo) {
  var parsed = aMetaInfo.langOutput;
  if (!("app" in parsed) || parsed.app == "html") {
    showOldSchoolIFrame(parsed);
    return;
  }

  var appModule;
  // XXX this parameterization is basically mooted at the current time as
  //  we have basically dismantled the mode system as it used to exist.  I
  //  think the proper direction is probably to have 'process' totally end
  //  up doing nothing until we get to this stage.  And then we can have this
  //  stage tell process to pick a mode and produce something for its
  //  presentation layer.
  // At that point, the only way a language can alter its behaviour is by
  //  turning on raw mode, and that should just cause it to generate token runs
  //  that potentially get annotated.
  switch (parsed.app) {
    case "browse":
      appModule = "jstut/present/app-browse";
      break;
    case "doc":
      appModule = "jstut/present/app-doc";
      break;
    default:
      throw new Error("unrecognized app code: " + parsed.app);
  }

  require([appModule], function(app) {
    app.showDoc(parsed, document, gPackageBaseRelPath);
  });

  document.jstutVisualizeDocLoad = function visDocLoad(showBoring) {
    require(["jstut/utils/pwomise-vis"], function ($pvis) {
      $pvis.visualizePromise(document, loadPromise, showBoring);
    });
  };
};

/**
 * Display the provided parse output in an iframe.  This was the original
 *  means of display before we started using wmsy for almost everything. This
 *  sticks around for some of the debugging representations which are fine
 *  with straight-up HTML generation followed by a "livejection" fix-up pass.
 */
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
