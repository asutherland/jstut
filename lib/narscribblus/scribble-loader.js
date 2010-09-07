/**
 * Loads a scribble-styled document.
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

var pwomise = require("narscribblus/utils/pwomise");
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
   * @listof[Promise]{
   *
   * }
   */
  this._promises = [];
}
ParserContext.prototype = {
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
 *   @param[aDocString String]
 *   @param[aFileDataPath String]{
 *     The package-relative data path of the document.  This will usually not
 *     include the word "data" because it is implied.  For example:
 *     "wmsy/docdex/index.skwbl" refers to the path "data/docdex/index.skwbl"
 *     inside the "wmsy" package.
 *   }
 *   @param[aOptions]
 * ]
 * @return[Promise]
 */
exports.parseDocument = function(aDocString, aFileDataPath, aOptions) {
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
  aOptions.detectedLang = langName;

  if ("forceLang" in aOptions)
    langName = aOptions.forceLang;

  // At some point it might make sense to totally dynamically load things, but
  //  not for now.  teleport uses regexes to detect potential imports, which
  //  means this is helpful for us to do.
  var lang;
  switch (langName) {
    case "narscribblus/manual":
      lang = require("narscribblus/langs/manual");
      break;
    case "narscribblus/interactive":
      lang = require("narscribblus/langs/interactive");
      break;
    // we never expect to get to this one from a #lang directive; explicit
    //  options is how this should happen (or this will be dead code...)
    case "narscribblus/js":
      lang = require("narscribblus/langs/js");
      break;
    case "narscribblus/raw":
      lang = require("narscribblus/langs/raw");
      break;
    default:
      throw new Error("Unsupported language: " + langName);
  }

  console.log("Using language", langName);

  var ctx = new ParserContext(aFileDataPath, aOptions);
  ctx.slurpModuleContributions(lang);

  var body = match ? aDocString.substring(idxNewline + 1) : aDocString;

  var expanded = when(lang.parse(body, ctx), function expander(parsed) {
    console.info("*** expand phase");
    var expanded = lang.expand(parsed, ctx);
    console.info("  * expand returned:");
    return expanded;
  });
  var processed = when(expanded, function processor(expanded) {
    console.info("*** process phase");
    return lang.process(expanded, ctx);
  });
  return pwomise.wrap(processed, "parseDocument", aFileDataPath);
};
