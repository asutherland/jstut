/**
 * Loads a scribble-styled document.
 **/

function ParserContext(aFilename) {
  // current line number; this should be updated by code at control transition
  this.line = 0;
  // the filename of the origin file, as best we can guess
  this.filename = aFilename;
  // maps names to reader functions used during the parse phase
  this.readerMap = {};
  // maps names to interpretation/execution functions for exec phase
  this.funcMap = {};
}
ParserContext.prototype = {
  slurpModuleContributions: function(module) {
    var key;
    if ("narscribblusReaderFuncs" in module) {
      var rfs = module.narscribblusReaderFuncs;
      for (key in rfs)
        this.readerMap = rfs[key];
    }
    if ("narscribblusExecFuncs" in module) {
      var efs = module.narscribblusExecFuncs;
      for (key in efs)
        this.funcMap = efs[key];
    }
  }
};
exports.ParserContext = ParserContext;

var RE_LANG_LINE = /^#lang (.+)$/;
exports.parseDocument = function(aDocString, aFilename) {
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
    case "narscribblus/manual":
      lang = require("narscribblus/manual-lang");
      break;
    case "narscribblus/interactive":
      lang = require("narscribblus/interactive-lang");
      break;
    default:
      throw new Error("Unsupported language: " + langName);
  }

  var ctx = new ParserContext(aFilename);
  ctx.slurpModuleContributions(lang);

  var body = aDocString.substring(idxNewline + 1);
  lang.parse(body, ctx);
};
