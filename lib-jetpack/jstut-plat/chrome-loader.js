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

define("jstut-plat/chrome-loader",
  [
    "exports",
    "jstut/doc-loader",
    "jstut-plat/package-info",
    "jstut/utils/pwomise",
  ],
  function (
    exports,
    loader,
    pkginfo,
    pwomise
  ) {

var when = pwomise.when;

exports.main = function(document, env) {
  if (!("doc" in env) && !("src" in env)) {
    var body = document.getElementsByTagName("body")[0];
    body.innerHTML = "I am going to level with you. " +
      "I need you to put the path of the jstut doc in the 'doc' " +
      "argument type thing.  Failure to do so results in sadness and messages "+
      "like this one.  <i>Sniff sniff</i>.";
    return;
  }
  if ("doc" in env) {
    var docPath = env.doc;
    when(pkginfo.loadData(docPath),
         exports.showDoc.bind(null, docPath, document, env),
         explodeSadFace.bind(null, docPath, document, env));
  }
  else if ("src" in env) {
    var srcPath = env.src;
    when(pkginfo.loadSource(srcPath),
         exports.showDoc.bind(null, srcPath, document, env),
         explodeSadFace.bind(null, srcPath, document, env));
  }
};

function explodeSadFace(aDocPath, document, env, aStatusCode) {
  var body = document.getElementsByTagName("body")[0];
  if (aStatusCode == 404) {
    body.innerHTML = "We tried to find a document that does not exist: " +
      env.doc;
  }
  else {
    body.innerHTML = "I couldn't find the document: " +
      env.doc + "(" + aStatusCode + ")";
  }
}

/**
 * Compare and constrast with main.js' showWhereYouCan and skbwl-protocol.js'
 *  makeDocURI.
 *
 * If we successfully retrieve the document then we create an iframe for it to
 *  live in.
 */
exports.showDoc = function showDoc(aDocPath, document, env, aContents) {
  var options = {
    /**
     * Link to a specific document.
     */
    makeDocLink: function(aDocPath, aCitingPackageName, aOptArgs) {
      aDocPath = aCitingPackageName + "/" + aDocPath;
      var ls = 'about:jstut?doc=' + encodeURIComponent(aDocPath);
      if (aOptArgs) {
        for (var key in aOptArgs) {
          ls += "&" + key + "=" + encodeURIComponent(aOptArgs[key]);
        }
      }
      return ' href="' + ls + '" target="_parent"';
    },
    /**
     * Link to something in the type/symish hierarchy.  This is probably just
     *  for open in new tab purposes; in-frame popups are handled elsewhere.
     */
    makeTypeishLink: function(docInfo) {
      // XXX punt until after we've got the popup stuff working.
      return "";
    },
  };
  var docPath = env.doc;
  if ("src" in env) {
    options.lang = "jstut/js";
    docPath = env.src;
  }
  if ("forcelang" in env)
    options.forceLang = env.forcelang;
  if ("mode" in env)
    options.mode = env.mode;

  when(loader.parseDocument(aContents, docPath, options),
       documentParsed.bind(null, document));
};

function documentParsed(document, parseOutput) {
  try {
    // create an iframe to hold the document we built.
    var iframe = document.getElementById("iframe");


    //console.log("BODY", parseOutput.body);


    var allstr = parseOutput.body;
    var headBit = allstr.substring(allstr.indexOf("<head>"),
                                   allstr.indexOf("</head>") +
                                     ("</head>").length);
    var bodyBit = allstr.substring(allstr.indexOf("<body>"),
                                   allstr.length - 8);

    iframe.contentDocument.getElementsByTagName("head")[0].innerHTML =
      headBit;
    iframe.contentDocument.getElementsByTagName("body")[0].innerHTML = bodyBit;

    console.log("propagating title");
    // propagate the title outwards...
    //document.getElementsByTagName("title")[0].textContent =
    //  iframe.contentDocument.getElementsByTagName("title")[0].textContent;

    // the body output is supposed to be escaped legal HTML...
    if (parseOutput.liveject)
      parseOutput.liveject(iframe.contentDocument, iframe.contentWindow);
  }
  catch (ex) {
    console.log("problem building the iframe", ex.fileName, ex.lineNumber, ex);
  }
};


}); // end define
