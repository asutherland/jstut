// the engine knows what our arguments were
var engine = require("teleport/engine");
var loader = require("narscribblus/scribble-loader");

/**
 * In the jetpack world we would use the 'self' module's data.load() method to
 *  get the goods.  We could create an analogous module, but there's no synergy.
 *  And we are creatures of synergy.  We do nothing without synergy.  NOTHING!
 *
 * @param["aPath"]{
 *   The path relative to the implied root of our little teleport universe.  We
 *   are assuming that the HTML page was loaded from "narscribblus/web/*.html"
 *   and so we prepend "../../" onto the front of all provided paths.  As such
 *   all paths should be of the form "module/path/in/module/blah.blah".
 * }
 * @param["aCallback"]{
 *   The callback to invoke when the document is retrieved.  Failure is not
 *   currently an option, you quitter.
 * }
 */
exports.docFetch = function docFetch(aPath, aCallback, aErrorback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "../../" + aPath);
  xhr.addEventListener("load", function() {
      if (xhr.status == 200)
        aCallback(xhr.responseText);
      else
        aErrorback(xhr.status);
    }, false);
  xhr.send(null);
};

exports.main = function web_loader_teleport_main() {
  if (!("doc" in engine.env)) {
    var body = document.getElementsByTagName("body")[0];
    body.innerHTML = "I am going to level with you. " +
      "I need you to put the path of the narscribblus doc in the 'doc' " +
      "argument type thing.  Failure to do so results in sadness and messages "+
      "like this one.  <i>Sniff sniff</i>.";
    return;
  }
  var docPath = engine.env.doc;
  // xhr up our doc.
  exports.docFetch(docPath, exports.showDoc, explodeSadFace);
};

function explodeSadFace(aStatusCode) {
  var body = document.getElementsByTagName("body")[0];
  if (aStatusCode == 404) {
    body.innerHTML = "We tried to find a document that does not exist: " +
      engine.env.doc;
  }
  else {
    body.innerHTML = "I couldn't find the document: " +
      engine.env.doc + "(" + aStatusCode + ")";
  }
}

/**
 * Compare and constrast with main.js' showWhereYouCan and skbwl-protocol.js'
 *  makeDocURI.
 *
 * If we successfully retrieve the document then we create an iframe for it to
 *  live in.
 */
exports.showDoc = function showDoc(aContents) {
  var options = {
    makeDocLink: function(aDocPath) {
      var packageBase = engine.env.doc.split("/").slice(0, 2).join("/");
      aDocPath = packageBase + "/" + aDocPath;
      return ' href="?doc=' + encodeURIComponent(aDocPath) +'" ' +
        'target="_parent"';
    }
  };
  if ("forcelang" in engine.env) {
    options.forceLang = engine.env.forcelang;
  }
  var parseOutput = loader.parseDocument(aContents, engine.env.doc, options);
  var body = document.getElementsByTagName("body")[0];

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

  // the body output is supposed to be escaped legal HTML...
  if (parseOutput.liveject)
    parseOutput.liveject(iframe.contentDocument, iframe.contentWindow);
};

if (require.main == module) {
  // defer to avoid errors being reported during the initial eval pass
  setTimeout(function() {
    exports.main();
  }, 10);
}