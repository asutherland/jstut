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
 * Identifies the document language, loads the right language, and then drives
 *  the asynchronous processing of the document.
 *
 * There are three distinct phases of document consumption:
 * @itemize[
 *   @item{
 *     Parsing.  We consume the file with the help of scribble-syntax and
 *     registered reader functions.  These produce a simple object hierarchy.
 *   }
 *   @item{
 *     Expansion.  (We are borrowing the term from scribble/racket).  We walk
 *     the parse tree hierarchy from the previous phase executing all @commands
 *     (that were not processed as reader functions).
 *   }
 *   @item{
 *     Processing.  Conversion to display form.  Before we started using wmsy
 *     for UI purposes this is where we would serialize things to HTML.  Now
 *     we frequently will just return the object tree from the expansion phase
 *     without any processing.
 *   }
 * ]
 **/

define(
  [
    "exports",
    "jstut/utils/pwomise",
  ],
  function(
    exports,
    $pwomise
  ) {

// attempt to play nice with jetpack's manifest builder without actually having
//  a chrome dependency...
if (0) require("chrome");

var when = $pwomise.when;

function ParserContext(aFileDataPath, aOptions) {
  if (!aOptions.pkg)
    throw new Error("Attempted to create a ParserContext without a package!");

  this.path = aFileDataPath;
  this.pkg = aOptions.pkg;
  this.packageName = this.pkg.name;
  // This name is unfortunate; it used to be moduleInfo, and then we had
  //  docInfo, but we want them to be similar and not have a misleading name,
  //  so let's compromise on a bad name.
  this.metaInfo = aOptions.metaInfo;

  this.docFusion = aOptions.docFusion;

  /**
   * The index of the first unconsumed byte in the document to be parsed.
   *  This should only be modified by top-level language parsers; sub-parsers
   *  (like scribble syntax inside of a JS document that consume pre-chewed
   *  snippets of comments) should not touch this.
   *
   * This variable is maintained to assist in error handling; if we know the
   *  offset where the problem happened, we can translate into line numbers
   *  and provide a pointer at the problem.  (We aren't good at keeping accurate
   *  line numbers except in JS, so it's easiest to just figure out from the
   *  offset.  Although we do need to support relative line offsets on top of
   *  that for cases where transformations on nested content make it hard to
   *  maintain correct offsets.)
   *
   * This only needs to be updated at control-flow transitions where code
   *  can no longer guarantee that other code won't read or write this variable.
   */
  this.unconsumedIndex = 0;
  /**
   * Transient hack to help guard against nested scribble parsing messing with
   *  `unconsumedIndex`.  We might end up maintain an actual stack; this still
   *  a work-in-progress.
   */
  this.parserDepth = 0;

  // the filename of the origin file, as best we can guess
  this.filename = aFileDataPath;

  // maps names to reader functions used during the parse phase
  this.readerMap = {};
  // maps names to interpretation/execution functions for exec phase
  this.funcMap = {};
  // Like funcMap but an optional set of corresponding functions to invoke
  //  prior to textStreamChewer recursively chewing the svals and tvals.  This
  //  enables use of the named context mechanism to gather info about children
  //  by having relevant children explicitly document their own existence
  //  rather than requiring an all-knowing visitor traversal mechanism.
  this.funcPreMap = {};

  this.options = (aOptions !== undefined) ? aOptions : {};
  this.options.oneUp = 0;
  /**
   * @dictof[
   *   @key["Stack name" String]
   *   @value["Stack" @listof[@oneof[
   *     @case[Array]{
   *       A list context to hold un-named contributions where order is
   *       significant.
   *     }
   *     @case[@dictof[
   *       @key["Contribution name" String]
   *       @value["Contribution value" Object]
   *     ]]{
   *       A dict context to hold named contributions where order is not
   *       significant, although will generally be maintained because of
   *       implementation details.
   *     }]]
   *   ]{
   *     The list will never be empty; we will delete the entry from the
   *     dictionary once it becomes empty.
   *   }
   * ]{
   *
   * }
   */
  this.levelStacks = {};
  this.namedValueStacks = {};

  this.rawMode = false;
  this.curTokenRun = null;
  this.tokenRuns = null;

  /**
   * A specialized stack for tracking nested tokens.  Currently used so that
   *  some generically named jsdoc tags can find out who encloses them so they
   *  can choose the right implementation class.  But I can see this useful
   *  to help provide improved error messages too.
   */
  this.tokenStack = [];
}
ParserContext.prototype = {
  /**
   * Helper function to use to process text streams into a formatted stream.
   * This is where paragraph breaking occurs.  This is intended to be invoked
   *  exactly once on any given text-stream and to be non-recursive.  So all
   *  commands that want formatted doc streams should apply this on their
   *  children.
   *
   * This is stored on the ParserContext as a forward-looking means of making
   *  this easier to parameterize.  This would both be for languages being
   *  able to use alternate parsing logic as well as to allow for commands to
   *  push implementations in a stack-like fashion to allow for localized
   *  special text processing of child nodes.
   */
  formatTextStream: null,

  bumpUnconsumedIndex: function(idxBump) {
    if (this.parserDepth === 0)
      this.unconsumedIndex += idxBump;
    return this.unconsumedIndex;
  },

  //////////////////////////////////////////////////////////////////////////////
  // Level Stack Operations

  /**
   * Create a new named context which will shadow any previously existing
   *  context with that name until popped.  If you call this method, then you
   *  must make a matching call to @lxref{popNamedContext} at the appropriate
   *  time.  (Specifically, it is assumed these calls are being used to bookend
   *  traversal of child nodes.)
   *
   * @args[
   * ]
   */
  pushNamedContext: function(name, toPush) {
    if (this.levelStacks.hasOwnProperty(name)) {
      this.levelStacks[name].push(toPush);
    }
    else {
      this.levelStacks[name] = [toPush];
    }
  },

  /**
   * Add something to the current top context by that key.  If there is no
   *  such context, this function has no effect.
   */
  namedContextAdd: function(key, what, nameIfAny) {
    if (!this.levelStacks.hasOwnProperty(key))
      throw new Error("trying to add to a named context that doesn't exist: " +
                      name);
    var stack = this.levelStacks[key];
    var namedContext = stack[stack.length-1];
    if (nameIfAny)
      namedContext[nameIfAny] = what;
    else
      namedContext.push(what);
  },

  /**
   * Lookup a name in the closest context with the given key, returning
   *  undefined if it's not present.
   */
  namedContextLookup: function(key, name) {
    var stack = this.levelStacks[key];
    var namedContext = stack[stack.length-1];
    return namedContext[name];
  },

  /**
   * Return a copy of the current state of the given named context stack.
   */
  snapshotNamedContextStack: function(key) {
    if (!this.levelStacks.hasOwnProperty(key))
      return [];
    return this.levelStacks[key].concat();
  },

  /**
   * Pop the given named context and return its contexts.
   */
  popNamedContext: function(name) {
    if (!this.levelStacks.hasOwnProperty(name))
      throw new Error("trying to pop a named context that doesn't exist: " +
                      name);
    var stack = this.levelStacks[name];
    var rval = stack.pop();
    if (stack.length === 0)
      delete this.levelStacks[name];
    return rval;
  },

  //////////////////////////////////////////////////////////////////////////////
  // Named Lookup
  //
  // Sort of the inverse of the level stack functionality.  Level stacks are
  //  oriented so that callers can push items into a list or a dict/map.  We
  //  are oriented so that callers can lookup an item by name.  We could
  //  reuse the same root dictionary object/namespace, however...

  pushNamedValue: function(name, value) {
    if (this.namedValueStacks.hasOwnProperty(name)) {
      this.namedValueStacks[name].push(value);
    }
    else {
      this.namedValueStacks[name] = [value];
    }
  },

  lookupNamedValue: function(name) {
    if (this.namedValueStacks.hasOwnProperty(name)) {
      var list = this.namedValueStacks[name];
      return list[list.length - 1];
    }
    return null;
  },

  popNamedValue: function(name) {
    if (this.namedValueStacks.hasOwnProperty(name)) {
      var list = this.namedValueStacks[name];
      if (list.length > 1) {
        list.pop();
        return;
      }
      delete this.namedValueStacks[name];
    }
  },

  //////////////////////////////////////////////////////////////////////////////
  // Token Stack Operations

  pushToken: function(commandName) {
    this.tokenStack.push(commandName);
  },

  popToken: function() {
    this.tokenStack.pop();
  },

  get parentToken() {
    if (!this.tokenStack.length)
      throw new Error("No parent token available!");
    return this.tokenStack[this.tokenStack.length - 1];
  },

  //////////////////////////////////////////////////////////////////////////////
  // Parse Problem Tracking
  //
  // Ideally these would go somewhere internal that is surfaced in a friendly
  //  fashion, but for now they just log to the "console".

  /**
   * Log a non-fatal parsing problem in a document.
   */
  logParseWarning: function logParseWarning(promiseOrEx, relLine) {
    var ex;
    if ($pwomise.isRejected(promiseOrEx)) {
      ex = promiseOrEx.valueOf().reason;
    }
    console.warn("parse warning on", this.filename,
                 "around line", relLine, " ex: ", ex);
  },

  /**
   * Log a fatal parsing problem in a document and return a pwomise rejection
   *  with suitable details on the problem.
   */
  logParseFailure: function logParseFailure(promiseOrEx, relLine) {
    var ex;
    // XXX I think this first one doesn't happen but don't want to check...
    if ($pwomise.isRejected(promiseOrEx))
      ex = promiseOrEx.valueOf().reason;
    else
      ex = promiseOrEx;
    console.error("parse failure on", this.filename,
                  "around line", relLine, " ex: ", ex, ex.stack);
    return $pwomise.reject(ex);
  },

  //////////////////////////////////////////////////////////////////////////////
  // General Contribution Handling

  slurpModuleContributions: function(module) {
    var key;
    if ("jstutReaderFuncs" in module) {
      var rfs = module.jstutReaderFuncs;
      for (key in rfs)
        this.readerMap[key] = rfs[key];
    }
    if ("jstutExecFuncs" in module) {
      var efs = module.jstutExecFuncs;
      for (key in efs) {
        this.funcMap[key] = efs[key];
      }
    }
    if ("jstutPreExecFuncs" in module) {
      var pfs = module.jstutPreExecFuncs;
      for (key in pfs) {
        this.funcPreMap[key] = pfs[key];
      }
    }

    if ("jstutParserDepResolve" in module) {
      module.jstutParserDepResolve(this);
    }
  }

  //////////////////////////////////////////////////////////////////////////////
};
exports.ParserContext = ParserContext;

var RE_LANG_LINE = /^#lang ([^ ]+) (.+)$/;
/**
 * Asynchronously process a document.
 *
 * @args[
 *   @param[aDocString String]{
 *     The document file as a single string.
 *   }
 *   @param[aFileDataPath #:optional String]{
 *     The package-relative data path of the document.  This will usually not
 *     include the word "data" because it is implied.  For example:
 *     "wmsy/docdex/index.jstut" refers to the path "data/docdex/index.jstut"
 *     inside the "wmsy" package.
 *   }
 *   @param[aOptions @dict[
 *     @key["docType" #:optional String]{
 *       The document type; only used when @lxref{aFileDataPath} is not
 *       provided so that we can know if we can look in the document body to
 *       figure out the language.
 *     }
 *     @key["lang" #:optional String]{
 *       Provides a default language to use if the language type detection based
 *       on the filename and/or self-identifying document processing fails.
 *     }
 *     @key["forceLang" #:optional String]{
 *       Forces a specific language to be used to process a file.  The language
 *       that would have been used if forcing did not occur will be saved to
 *       `detectedLang` in case the forced language cares.
 *     }
 *   ]]{
 *   }
 * ]
 * @return[Promise]
 */
exports.parseDocument = function(aDocString, aFileDataPath, aOptions) {
  var docType, langName;
  // -- extension detection
  if (aFileDataPath) {
    var lastDot = aFileDataPath.lastIndexOf(".");
    if (lastDot != -1) {
      var ext = aFileDataPath.substring(lastDot + 1);
      switch (ext) {
        case "jstut":
          docType = "scribble";
          break;
        case "md":
          docType = "markdown";
          break;
      }
    }
  }
  else if ("docType" in aOptions) {
    docType = aOptions.docType;
  }

  // -- self-identifying document types...
  var selfIdentifiedLang, langbitRequests = [];
  // scribble-syntax documents possess a language line, probably.
  if (docType === "scribble") {
    var idxNewline = aDocString.indexOf("\n");
    if (idxNewline == -1)
      throw new Error("The document has no newlines.  They are not optional!");
    var langLine = aDocString.substring(0, idxNewline);
    var match = RE_LANG_LINE.exec(langLine);
    if (!match)
      throw new Error("The document's #lang directive is ill-formed: " +
                      langLine);
    selfIdentifiedLang = match[1];
    langbitRequests = match[2].split(/ +/g);
  }
  // for markdown, we heuristically detect the jetpack variant
  else if (docType === "markdown") {
    // "\n<api" means jetpack!
    if (aDocString.indexOf("\n<api") != -1)
      selfIdentifiedLang = "jstut/jetpack-doc";
    else
      selfIdentifiedLang = "jstut/markdown";
  }

  if (selfIdentifiedLang)
    langName = selfIdentifiedLang;
  else if (aOptions && "lang" in aOptions)
    langName = aOptions.lang;
  else
    throw new Error("Unable to figure out the document language.");
  aOptions.detectedLang = langName;

  if ("forceLang" in aOptions)
    langName = aOptions.forceLang;

  function implicitPackageTransform(path, implicitDir) {
    var pathBits = path.split("/");
    return pathBits[0] + "/" + implicitDir + "/" +
           pathBits.slice(1).join("/");
  }

  // Transform the language name by inserting /langs/ after the root package.
  // This is an attempt to keep the language name short and provide flexibility
  //  while providing some protection against foot-shooting import of totally
  //  wrong things.  This is not security protection.  We would probably want
  //  to force packages to explicitly document and/or map their language names
  //  via package.json/friends for that.
  var langModuleNames = [implicitPackageTransform(langName, "langs")];
  for (var iLangBit = 0; iLangBit < langbitRequests.length; iLangBit++) {
    langModuleNames.push(
      implicitPackageTransform(langbitRequests[iLangBit], "langbits"));
  }
  console.log("for file", aFileDataPath,
              "loading language", langModuleNames[0], "with langbits",
              langModuleNames.slice(1), "from lang line", langbitRequests);

  var deferredLang = $pwomise.defer("lang", langName);
  require(langModuleNames, function() {
    deferredLang.resolve(arguments);
  });

  var lang, ctx;
  var parsed = when(deferredLang.promise, function parser(langModules) {
    lang = langModules[0];
    ctx = new ParserContext(aFileDataPath, aOptions);
    // Save the body to the context for error reporting.  We want to clear
    //  this after parsing has completed and we are sure error handling has
    //  had its at-bat.  Since lang.parse can return a rejection promise,
    //  that means we need to do this in the next phase.
    // note: This includes the (possibly there) #lang line which does not
    //  actually get seen by the parser.
    ctx.contents = aDocString;
    if (("mode" in aOptions) && (aOptions.mode === "raw"))
      ctx.rawMode = true;
    for (var i = 0; i < langModules.length; i++) {
      ctx.slurpModuleContributions(langModules[i]);
    }

    var body = match ? aDocString.substring(idxNewline + 1) : aDocString;
    // bump the index to skip over the language line...
    if (match)
      ctx.bumpUnconsumedIndex(match[0].length + 1);

    return lang.parse(body, ctx);
  });

  var expanded = when(parsed, function expander(parsed) {
    // Clear the body off of the context since parsing should have completed.
    ctx.contents = null;

    //console.info("*** expand phase", aFileDataPath, {parsed: parsed});
    var expanded = lang.expand(parsed, ctx);
    //console.info("  * expand returned:");
    return expanded;
  });
  return when(expanded, function processor(expanded) {
    //console.info("*** process phase", aFileDataPath);
    return lang.process(expanded, ctx);
  }, null, "parseDocument", aFileDataPath);
};

}); // end define
