/**
 * Combination of a custom protocol to make sure we can load bespin in with the
 *  chrome privileges the rest of the document has and the legwork to splice
 *  the 'script' tag and what not into a document to use that protocol.
 **/

var PROTO_NAME = "narbespin";
var protocol = require("custom-protocol").register(PROTO_NAME);
var self = require("self");

protocol.setHost("files", self.data.url("bespin/"));

exports.loadBespin = function loadBespin(doc, callback) {
  var rawWin = doc.defaultView.wrappedJSObject;
  rawWin.onBespinLoad = callback;
  rawWin.console = console;

  var head = doc.getElementsByTagName('head')[0];
  var link = doc.createElement('link');
  link.setAttribute("id", "bespin_base", "system");
  link.setAttribute("href", PROTO_NAME + "://files/");
  head.appendChild(link);

  var script = doc.createElement("script");
  script.src = PROTO_NAME + "://files/BespinEmbedded.js";
  head.appendChild(script);
};
