/**
 * Loads a scribble-styled document.
 **/

var RE_LANG_LINE = /^#lang (.+)$/;
exports.parseDocument = function(aDocString) {
  var idxNewline = aDocString.indexOf("\n");
  if (idxNewline == -1)
    throw new Error("The document has no newlines.  They are not optional!");
  var langLine = aDocString.substring(0, idxNewline);
  var match = RE_LANG_LINE.exec(langLine);
  if (!match)
    throw new Error("Lang line '" + langLine + "' is no good.");
  var langName = match[1];

  // At some point it might make sense to totally dynamically load things, but
  //  not for now.
  var lang;
  switch (langName) {
    case "narscribblus/interactive":
      lang = require("narscribblus/interactive-lang");
      break;
    default:
      throw new Error("Unsupported language: " + langName);
  }

  var body = aDocString.substring(idxNewline + 1);
  lang.parse(body);
};
