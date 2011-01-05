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
 *     Processing.
 *   }
 * ]
 **/

define("narscribblus/doc-loader",
  [
    "exports",
    "narscribblus/utils/pwomise",
  ],
  function(
    exports,
    pwomise
  ) {

// attempt to play nice with jetpack's manifest builder without actually having
//  a chrome dependency...
if (0) require("chrome");

var when = pwomise.when;

function ParserContext(aFileDataPath, aOptions) {
  var pathBits = aFileDataPath.split("/");
  this.packageName = pathBits[0];
  pathBits.splice(0, 1);
  this.packageRelPath = pathBits.join("/");

  // current line number; this should be updated by code at control transition
  // XXX uh, don't think we use this right now...
  this.line = 0;
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

  // Contributions from narscribblusGeneralHooks are accumulated into lists of
  //  whatever the payload of each contributing module was.
  this.hookMap = {};

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

  /**
   * @listof[Promise]{
   *
   * }
   */
  this._promises = [];
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
    if (name in this.levelStacks) {
      this.levelStacks[name].push(toPush);
    }
    else {
      this.levelStacks[name] = [toPush];
    }
  },

  /**
   * Add something to the current top context by that name.  If there is no
   *  such context, this function has no effect.
   */
  namedContextAdd: function(key, what, nameIfAny) {
    if (!(key in this.levelStacks))
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
   * Return a copy of the current state of the given named context stack.
   */
  snapshotNamedContextStack: function(key) {
    if (!(key in this.levelStacks))
      return [];
    return this.levelStacks[key].concat();
  },

  /**
   * Pop the given named context and return its contexts.
   */
  popNamedContext: function(name) {
    if (!(name in this.levelStacks))
      throw new Error("trying to pop a named context that doesn't exist: " +
                      name);
    var stack = this.levelStacks[name];
    var rval = stack.pop();
    if (stack.length === 0)
      delete this.levelStacks[name];
    return rval;
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
  // Asynchrony

  /**
   * Create a new deferred which will block completion of the current processing
   *  phase until it is fulfilled but which is otherwise a normal deferred.
   *
   * @return[Deferred]
   */
  newDeferred: function() {
    var deferred = promise.defer();
    this._promises.push(deferred.promise);
    return deferred;
  },

  /**
   * Create a new promise that triggers once all of the promises created by
   *  newPromise since the last call to this function have been fulfilled.
   *
   * @return[Promise]
   */
  waitForAllPromises: function() {
    var promises = this._promises;
    this._promises = [];
    return promise.group(promises);
  },

  //////////////////////////////////////////////////////////////////////////////
  // Parse Problem Tracking


  //////////////////////////////////////////////////////////////////////////////
  // General Contribution Handling

  fireHook: function(hookName, args) {
    if (!(hookName in this.hookMap))
      return;

    var hooks = this.hookMap[hookName];
    for (var i = 0; i < hooks.length; i++) {
      hooks[i].apply(null, args);
    }
  },

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
    if ("narscribblusPreExecFuncs" in module) {
      var pfs = module.narscribblusPreExecFuncs;
      for (key in pfs) {
        this.funcPreMap[key] = pfs[key];
      }
    }

    if ("narscribblusGeneralHooks" in module) {
      var ghs = module.narscribblusGeneralHooks;
      for (key in ghs) {
        if (key in this.hookMap)
          this.hookMap[key].push(ghs[key]);
        else
          this.hookMap[key] = [ghs[key]];
      }
    }

    if ("narscribblusParserDepResolve" in module) {
      module.narscribblusParserDepResolve(this);
    }
  }

  //////////////////////////////////////////////////////////////////////////////
};
exports.ParserContext = ParserContext;

var RE_LANG_LINE = /^#lang (.+)$/;
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
 *     "wmsy/docdex/index.skwbl" refers to the path "data/docdex/index.skwbl"
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
        case "skwbl":
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
  var selfIdentifiedLang;
  // scribble-syntax documents possess a language line, probably.
  if (docType === "scribble") {
    var idxNewline = aDocString.indexOf("\n");
    if (idxNewline == -1)
      throw new Error("The document has no newlines.  They are not optional!");
    var langLine = aDocString.substring(0, idxNewline);
    var match = RE_LANG_LINE.exec(langLine);
    if (match)
      selfIdentifiedLang = match[1];
  }
  // for markdown, we heuristically detect the jetpack variant
  else if (docType === "markdown") {
    // "\n<api" means jetpack!
    if (aDocString.indexOf("\n<api") != -1)
      selfIdentifiedLang = "narscribblus/jetpack-doc";
    else
      selfIdentifiedLang = "narscribblus/markdown";
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

  // Transform the language name by inserting /langs/ after the root package.
  // This is an attempt to keep the language name short and provide flexibility
  //  while providing some protection against foot-shooting import of totally
  //  wrong things.  This is not security protection.  We would probably want
  //  to force packages to explicitly document and/or map their language names
  //  via package.json/friends for that.
  var langNameBits = langName.split("/");
  var langModuleName = langNameBits[0] + "/langs/" +
                       langNameBits.slice(1).join("/");
  //console.log("Using language", langName, "loading", langModuleName);

  var deferredLang = pwomise.defer("lang", langName);
  require([langModuleName], function(langModule) {
    //console.log("loaded", langModule);
    deferredLang.resolve(langModule);
  });

  var lang, ctx;
  var parsed = when(deferredLang.promise, function parser(langModule) {
    lang = langModule;
    ctx = new ParserContext(aFileDataPath, aOptions);
    if (("mode" in aOptions) && (aOptions.mode === "raw"))
      ctx.rawMode = true;
    ctx.slurpModuleContributions(lang);

    var body = match ? aDocString.substring(idxNewline + 1) : aDocString;

    return lang.parse(body, ctx);
  });

  var expanded = when(parsed, function expander(parsed) {
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
