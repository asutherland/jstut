/**
 * Loads a scribble-styled document.
 *
 * There are three distinct phases of document consumption:
 * - Parsing.  We consume the file with the help of scribble-syntax and
 *    registered reader functions.  These produce a simple object hierarchy.
 * - Expansion.  (We are borrowing the term from scribble/racket).  We walk
 *    the parse tree hierarchy from the previous phase executing all @commands
 *    (that were not processed as reader functions).
 * - Processing.
 **/

function ParserContext(aFilename, aOptions) {
  // current line number; this should be updated by code at control transition
  this.line = 0;
  // the filename of the origin file, as best we can guess
  this.filename = aFilename;
  // maps names to reader functions used during the parse phase
  this.readerMap = {};
  // maps names to interpretation/execution functions for exec phase
  this.funcMap = {};
  this.options = (aOptions !== undefined) ? aOptions : {};
}
ParserContext.prototype = {
  slurpModuleContributions: function(module) {
    var key;
    if ("narscribblusReaderFuncs" in module) {
      var rfs = module.narscribblusReaderFuncs;
      for (key in rfs)
        this.readerMap[key] = rfs[key];
    }
    if ("narscribblusExecFuncs" in module) {
      var efs = module.narscribblusExecFuncs;
      for (key in efs) {
        this.funcMap[key] = efs[key];
      }
    }
  }
};
exports.ParserContext = ParserContext;

var RE_LANG_LINE = /^#lang (.+)$/;
exports.parseDocument = function(aDocString, aFilename, aOptions) {
  var idxNewline = aDocString.indexOf("\n");
  if (idxNewline == -1)
    throw new Error("The document has no newlines.  They are not optional!");
  var langLine = aDocString.substring(0, idxNewline), langName;
  var match = RE_LANG_LINE.exec(langLine);
  if (match)
    langName = match[1];
  else if (aOptions && "lang" in aOptions)
    langName = aOptions.lang;
  else
    throw new Error("Lang line '" + langLine + "' is no good.");

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
    case "narscribblus/js":
      lang = require("narscribblus/js-lang");
      break;
    default:
      throw new Error("Unsupported language: " + langName);
  }

  console.log("Using language", langName);

  var ctx = new ParserContext(aFilename, aOptions);
  ctx.slurpModuleContributions(lang);

  var body = aDocString.substring(idxNewline + 1);
  var parsed = lang.parse(body, ctx);
  var expanded = lang.expand(parsed, ctx);
  return lang.process(expanded, ctx);
};
