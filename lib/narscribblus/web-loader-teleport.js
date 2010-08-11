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
exports.docFetch = function docFetch(aPath, aCallback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "../../" + aPath);
  xhr.addEventListener("load", function() {
      aCallback(xhr.responseText);
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
  exports.docFetch(docPath, exports.showDoc);
};

/**
 * Compare and constrast with main.js' showWhereYouCan and skbwl-protocol.js'
 *  makeDocURI.
 *
 * If we successfully retrieve the document then we create an iframe for it to
 *  live in.
 */
exports.showDoc = function showDoc(aContents) {
  var options = {
  };
  var parseOutput = loader.parseDocument(aContents, engine.env.doc, options);
  var body = document.getElementsByTagName("body")[0];

  // create an iframe to hold the document we built.
  var iframe = document.createElement("iframe");
  //iframe.setAttribute("seamless", "seamless");
  iframe.setAttribute("width", "100%");
  iframe.setAttribute("height", "100%");
  iframe.setAttribute("style", "border: 0; margin: 0; padding: 0; height: 99%; overflow: none;");
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
