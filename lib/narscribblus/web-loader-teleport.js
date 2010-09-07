// the engine knows what our arguments were
var engine = require("teleport/engine");
var loader = require("narscribblus/scribble-loader");
var pkginfo = require("narscribblus/package-info");
var pwomise = require("narscribblus/utils/pwomise");
var when = pwomise.when;

exports.main = function web_loader_teleport_main() {
  if (!("doc" in engine.env) && !("src" in engine.env)) {
    var body = document.getElementsByTagName("body")[0];
    body.innerHTML = "I am going to level with you. " +
      "I need you to put the path of the narscribblus doc in the 'doc' " +
      "argument type thing.  Failure to do so results in sadness and messages "+
      "like this one.  <i>Sniff sniff</i>.";
    return;
  }
  if ("doc" in engine.env) {
    var docPath = engine.env.doc;
    when(pkginfo.loadData(docPath),
         exports.showDoc.bind(null, docPath),
         explodeSadFace);
  }
  else if ("src" in engine.env) {
    var srcPath = engine.env.src;
    when(pkginfo.loadSource(srcPath),
         exports.showDoc.bind(null, srcPath),
         explodeSadFace);
  }
};

function explodeSadFace(aDocPath, aStatusCode) {
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
exports.showDoc = function showDoc(aDocPath, aContents) {
  var options = {
    /**
     * Link to a specific document.
     */
    makeDocLink: function(aDocPath, aCitingPackageName, aOptArgs) {
      aDocPath = aCitingPackageName + "/" + aDocPath;
      var ls = '?doc=' + encodeURIComponent(aDocPath);
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
  var docPath = engine.env.doc;
  if ("src" in engine.env) {
    options.lang = "narscribblus/js";
    docPath = engine.env.src;
  }
  if ("forcelang" in engine.env)
    options.forceLang = engine.env.forcelang;
  if ("mode" in engine.env)
    options.mode = engine.env.mode;

  when(loader.parseDocument(aContents, docPath, options),
       documentParsed);
};

function documentParsed(parseOutput) {
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

  // propagate the title outwards...
  document.getElementsByTagName("title")[0].textContent =
    iframe.contentDocument.getElementsByTagName("title")[0].textContent;

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
