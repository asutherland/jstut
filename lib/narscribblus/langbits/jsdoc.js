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
 * All documentation logic happens in two phases corresponding to the 'expand'
 *  and 'process' stages.  Because documentation likes to cross-reference other
 *  bits of documentation, it is presumed that 'expand' processing will occur
 *  globally across all potential backing documents before any documents moves
 *  on to the 'process' stage.
 *
 * From an implementation perspective, this translates into the constructors
 *  of the objects needing to cause themselves to be registered in the great
 *  documentation registry in the sky/top-level.  Because we also want various
 *  nesting things to happen, this nets out to maintaining a stack of namespaces
 *  / what have you on the passed-in context object.  Because textStreamChewer
 *  operates as a postorder traversal
 **/

require.def("narscribblus/langbits/jsdoc",
  [
    "exports",
    "narscribblus/readers/scribble-syntax",
    "narscribblus/mcstreamy",
    "narscribblus/langs/manual",
    "narscribblus/render/html",
    "narscribblus-plat/package-info",
    "narscribblus/typerep",
    "narscribblus/typeref",
    "narscribblus/xref",
    "narscribblus/protocols",
  ],
  function(
    exports,
    syn,
    $docstreams,
    man,
    html,
    $pkginfo,
    $tyeprep,
    $typeref,
    $xref,
    $protocols
  ) {

var Identifier = syn.Identifier, Keyword = syn.Keyword;

var TypeRef = $typeref.TypeRef;

var decodeFlow = man.decodeFlow;
var htmlStreamify = html.htmlStreamify, htmlEscapeText = html.htmlEscapeText;

function coerceString(st) {
  if (typeof(st) === "string")
    return st;
  if (st instanceof Keyword)
    return st.keyword;
  if (st instanceof Identifier)
    return st.identifier;
  throw new Error("Unable to coerce " + st + " to a string.");
}

function oneOfKeywords(thing) {
  if (!(thing instanceof Keyword))
    return false;
  for (var i = 1; i < arguments.length; i++) {
    if (thing.keyword === arguments[i])
      return true;
  }
  return false;
}


function findChildByType(kids, type) {
  for (var i = 0; i < kids.length; i++) {
    if (kids[i] instanceof type)
      return kids[i];
  }
  return null;
}
exports.findChildByType = findChildByType;

function chewType(typeThing, ctx) {
  if (typeThing == null)
    throw new Error("null typeThing!");

  if (typeThing instanceof TypeRef)
    return typeThing;

  var pkg = ctx.options.pkg;

  // textual references that will be resolved on-demand
  if (typeof(typeThing) === "string")
    return new TypeRef(typeThing, pkg);
  if (typeThing instanceof Keyword)
    return new TypeRef(typeThing.keyword, pkg);
  if (typeThing instanceof Identifier)
    return new TypeRef(typeThing.identifier, pkg);

  // inline jsdoc types...
  if (("isType" in typeThing) && typeThing.isType)
    return typeThing;

  throw new Error("Unacceptable type: " + typeThing);
}

function commonTypeTraverseChild(name, childMode) {
  if (!this.type || !("traverseChild" in this.type))
    return null;
  return this.type.traverseChild(name, childMode);
}

function commonTypeTraverseArg(index) {
  if (!("traverseArg" in this.type))
    return null;
  return this.type.traverseArg(index);
}

/**
 * Creates a synthetic type name contributed to the current documentation scope
 *  which is nominally the package's global documentation scope.  This is used
 *  to name conventions; for example a plain JS object with certain expected
 *  attributes, a (potentially nested) with specific ordered elements, etc.
 *
 * Like a C typedef, this instance creates the name; some other tag is used to
 *  define the referenced type.
 *
 * @args[
 *   @param[svals @list[
 *     @param["type name"]
 *     @param["type ref"]
 *   ]]
 * ]
 */
function Typedef(svals, tvals, ctx) {
  this.name = coerceString(svals[0]);
  this.type = chewType(svals[1], ctx);
  this.kids = tvals;
}
Typedef.prototype = {
  isType: true,
  /**
   * Typedefs currently are forbidden from being anonymous, although there is
   *  currently nothing in place to forbid attempted usage as such.
   */
  isAnonymous: false,
  traverseChild: commonTypeTraverseChild,
  traverseArg: commonTypeTraverseArg,
  get isSimple() {
    return this.type.isSimple;
  },
  citeTypeHTML: function(options, expandedNearby) {
    return "<span class='name'>" + this.name + "</span>";
  },
  briefTypeExpansionHTML: function(options) {
    return this.type.briefTypeExpansionHTML(options);
  },
  detailedTypeExpansionHTML: function(options) {
    return this.type.detailedTypeExpansionHTML(options);
  },
  descriptionHTML: function(options) {
    return htmlStreamify(this.kids, options);
  },
  /**
   * This should only be invoked in an inline usage, in which case we want to
   *  announce our type name to the world, farm the type description out to our
   *  referenced type, then close out with the textstream attached to us.
   */
  toHTMLString: function(options) {
    return "<div class='typedef'>\n" +
      "  <span class='name'>" + this.name + "</span>\n" +
      htmlStreamify(this.kids, options) + "</dd>\n" +
      "</div>\n";
  },
};

function Desc(docStream) {
  this.docStream = docStream;
}
Desc.prototype = {
};


function Case(svals, tvals, ctx) {
  this.type = chewType(svals[0], ctx);
  this.textStream = decodeFlow(tvals);
}
Case.prototype = {
  get name() {
    return this.type.name;
  },
  briefTypeExpansionHTML: function(options) {
    return this.type.briefTypeExpansionHTML(options);
  },
  detailedTypeExpansionHTML: function(options) {
    return this.type.detailedTypeExpansionHTML(options);
  },
  descriptionHTML: function(options) {
    return htmlStreamify(this.textStream, options);
  },
};

/**
 * Designates the other/default case in a OneOf populated by Case instances.
 *
 * @args[
 *   @param[svals @list[
 *     @param["type" #:optional]{
 *       If the 'other' case for your OneOf still has some form of constraint,
 *       you can characterize it.  Unsure about this.
 *     }
 *   ]]
 * ]
 */
function DefaultCase(svals, tvals) {
  this.name = "(default)";
  this.textStream = decodeFlow(tvals);
  this.hasDescription = Boolean(this.textStream.length);
}
DefaultCase.prototype = {
  briefTypeExpansionHTML: function(options) {
    return "";
  },
  detailedTypeExpansionHTML: function(options) {
    return "";
  },
  descriptionHTML: function(options) {
    return htmlStreamify(this.textStream, options);
  },
};

function Default(svals, tvals, ctx) {
  this.value = svals.length ? coerceString(svals[0]) : null;
  this.textStream = decodeFlow(tvals);
}
Default.prototype = {
};

/**
 * @args[
 *   @param[svals @list[
 *     @param["this" #:optional ThisContext]
 *     @param["args" #:optional Args]
 *     @param["return" #:optional Retval]
 *   ]]
 * ]
 */
function Func(svals, tvals, ctx) {
  this.kids = svals;
  this.args = findChildByType(svals, Args);
  this.thisContext = findChildByType(svals, ThisContext);
  this.ret = findChildByType(svals, Retval);
}
Func.prototype = {
  isType: true,
  traverseArg: function(index) {
    if (this.arg)
      return this.arg.traverseArg(index);
    return null;
  },
  traverseChild: function() {
    // explicitly documented functions can't have static junk on them.
    return null;
  },

  citeTypeHTML: function(options, expandedNearby) {
    return "Function";
  },

  briefTypeExpansionHTML: function(options) {
    var s = "function(";
    if (this.args) {
      var argKids = this.args.kids;
      for (var i = 0; i < argKids.length; i++) {
        if (i)
          s += ", ";
        s += argKids[i].citeTypeHTML(options, true);
      }
    }
    s += ")";
    if (this.ret) {
      s += " => " + this.ret.citeTypeHTML(options, true);
    }
    return s;
  },

  detailedTypeExpansionHTML: function(options) {
    var s = "";
    if (this.args) {
      var argKids = this.args.kids;
      for (var i = 0; i < argKids.length; i++) {
        s += argKids[i].detailedTypeExpansionHTML(options);
      }
    }
    if (this.ret) {
      s += this.ret.toHTMLString(options);
    }
    return s;
  },

  toHTMLString: function(options) {
    return htmlStreamify(this.kids, options);
  },
};

exports.narscribblusGeneralHooks = {
  htmlDocStaticHookup: function(options) {
    options.namedCssBlocks["jsdoc"] = true;
    options.cssUrls.push(
      $pkginfo.dataDirUrl("narscribblus/css/js-doc-bits.css"));
  }
};

exports.narscribblusPreExecFuncs = {
  dict: function(name, ctx) {
    var dict = new $typerep.Dict();

    ctx.pushNamedContext("dict-all", {});
    ctx.pushNamedContext("lexicalTypeScope", dict);

    return dict;
  },
  dictof: function(name, ctx) {
    var dictOf = new $typerep.DictOf();

    ctx.pushNamedContext("dict-all", {});

    return dictOf;
  },
};

exports.narscribblusExecFuncs = {
  //////////////////////////////////////////////////////////////////////////////
  // Documentation Declaration
  typedef: function(name, svals, tvals, ctx) {
    return new Typedef(svals, tvals, ctx);
  },
  /**
   * @args[
   *   @param[svals @listof[@oneof[Group Key]]]{
   *   }
   *   @param[tvals TextStream]
   *   @param[ctx Context]
   * ]
   */
  dict: function(name, svals, tvals, ctx, dict) {
    dict.keysByName = ctx.popNamedContext("dict-all");
    ctx.popNamedContext("lexicalTypeScope");

    // display ordering of immediate children
    dict.kids = svals;
    return dict;
  },

  /**
   * Semantic grouping operator for use inside Dict instances.
   *
   * @args[
   *   @param[svals @list[
   *     @param["group name"]{
   *       Name the group!
   *     }
   *     @param["desc block" #:optional Desc]{
   *       You may optionally provide some description of the group in-line that
   *       precedes the members using a Desc block.
   *     }
   *     @rest["keys" @listof[Key]]{
   *       A group is filled with keys.
   *     }
   *   ]]
   *   @param[tvals TextStream]
   *   @param[ctx Context]
   * ]
   */
  group: function(name, svals, tvals, ctx) {
    this.groupName = coerceString(svals[0]);
    var idx = 1;
    if (svals[idx] instanceof Desc)
      this.desc = svals[idx++];
    else
      this.desc = null;
    this.kids = svals.slice(idx);
    return new Group(svals, tvals, ctx);
  },
  /**
   * Descriptions are just a markup convenience for groups in order to
   *  describe them.  We produce a local type which our group tag is supposed
   *  to unbox to get the doc stream out of.
   */
  desc: function(name, svals, tvals, ctx) {
    if (ctx.parentToken != "group")
      throw new Error(
        "desc tags can only be used inside groups to describe them");

    return new Desc(ctx.formatTextStream(tvals));
  },
  /**
   * @args[
   *   @param[svals @list[
   *     @param["key" Key]{
   *     }
   *     @param["value" Value]{
   *     }
   *   ]]
   * ]
   */
  dictof: function(name, svals, tvals, ctx, dictOf) {
    dictOf.key = chewType(svals[0], ctx);
    dictOf.key.inDictOf = true;
    dictOf.value = chewType(svals[1], ctx);

    ctx.popNamedContext("dict-all");

    return dictOf;
  },

  /**
   * Documents a specific named key in a Dict or the general key bit in a DictOf.
   *
   * @args[
   *   @param[svals @list[
   *     @param["key name" String]
   *     @param["optional keyword" #:optional]
   *     @param["type"]
   *   ]]
   * ]
   */
  key: function(tagName, svals, tvals, ctx) {
    // the basics are the same for both varieties of keys
    var name = coerceString(svals[0]);
    var idx = 1, optional, defaultDesc;
    if (oneOfKeywords(svals[idx], "optional", "required"))
      optional = (svals[idx++].keyword === "optional");
    else
      optional = false;
    if (svals[idx] instanceof $typerep.ArgDefaultDescriptor)
      defaultDesc = svals[idx++];
    else
      defaultDesc = null;
    var type = chewType((idx < svals.length) ? svals[idx] : "String", ctx);

    var docStream = ctx.formatTextStream(tvals);

    var entry;
    // parameterize based on whether we're in a Dict or a DictOf...
    if (ctx.parentToken == "dictof") {
      if (optional || defaultDesc)
        throw new Error("DictOf keys should not be optional or have defaults.");
      entry = new $typerep.DictOfKeyDesctiptor(name, type, docStream);
      return entry;
    }
    // should be dict/group (inside a dict)
    else if (ctx.parentToken == "dict" || ctx.parentToken == "group") {
      entry = new $typerep.DictEntryDescriptor(
                             name, type, optional, defaultDesc, docStream
                           );
      ctx.namedContextAdd("dict-all", entry, name);
      return entry;
    }
    else {
      throw new Error(ctx.parentToken + " was not the expected parent token");
    }
  },
  /**
   * Documents the value part in a DictOf.
   *
   * @args[
   *   @param[svals @list[
   *     @param["name"]
   *     @param["type"]
   *   ]]
   * ]
   */
  value: function(tagName, svals, tvals, ctx) {
    return new $typerep.DictOfValueDescriptor(
                 coerceString(svals[0]),
                 chewType(svals[1], ctx),
                 ctx.formatTextStream(tvals));
  },
  /**
   * @args[
   *   @param[svals @list[
   *     @param["stuffs" #:oneormore Param]
   *     @param["rest" #:optional Rest]
   *   ]]
   * ]
   */
  list: function(name, svals, tvals, ctx) {
    return new $typerep.List(svals);
  },
  /**
   * @args[
   *   @param[svals @list[
   *     @param["name/description"]
   *     @param["type"]
   *   ]]
   * ]
   */
  listof: function(name, svals, tvals, ctx) {
    return new $typerep.ListOf(svals, tvals, ctx);
  },
  /**
   * Type disjunction; used to say that in a given spot a value can possess one
   *  of type from a given set of types.  It is presumed that the consumer of
   *  the type uses some form of inspection or explicitly documented context to
   *  tell things apart.
   *
   * @args[
   *   @param[svals @listof[@oneof[
   *     @case[Case]
   *     @default[Type]
   *   ]]
   * ]
   */
  oneof: function(name, svals, tvals, ctx) {
    var kids = this.kids = [];
    for (var i = 0; i < svals.length; i++) {
      var v = svals[i];
      if (v instanceof $typepre.CaseDescriptor)
        kids.push(v);
      else
        kids.push(new $typerep.CaseDescriptor(chewType(v, ctx)));
    }
    return new $typerep.OneOf(kids);
  },
  /**
   * Used to annotate type values with documentation inside a OneOf.
   *
   * @args[
   *   @param[svals @list[
   *     @param["type"]
   *   ]]
   * ]
   */
  "case": function(name, svals, tvals, ctx) {
    return new Case(svals, tvals, ctx);
  },
  /**
   * Container that defines we are documenting the argument list for a function.
   *  This does not obey @xref{OutputtableType}; the function owner is
   *  responsible for dealing with our type directly.
   *
   * @args[
   *   @param[svals @listof[Param]]
   * ]
   */
  args: function(name, svals, tvals, ctx) {
    return new $typerep.ArgList(svals);
  },
  /**
   * Documents a named argument to a function or a positional value within a
   *  List.
   *
   * @args[
   *   @param[svals @list[
   *     @param["name"]
   *     @param["multiplicity" #:optional
   *            @default[#:required]
   *            @oneof[#:optional #:required #:oneormore]
   *            ]
   *     @param["default"]
   *     @param["type"]
   *   ]]
   * ]
   *
   * @example["inside an args for a function"]{
   *   Pretend we have the following JavaScript function where
   *   @sjs{waitNoSubtract} is an optional argument:
   *
   *   @js{
   *     function addStuff(a, b, waitNoSubtract) {
   *       if (waitNoSubtract)
   *         return a - b;
   *       return a + b;
   *     }
   *   }
   *
   *   We could document this inside a documentation block like so:
   *
   *   @scribble{
   *     @args[
   *       @param[a Number]
   *       @param[b Number]
   *       @param[waitNoSubtract #:optional]
   *     ]
   *   }
   * }
   *
   * @example["within a list"]{
   * }
   */
  param: function(tagName, svals, tvals, ctx) {
    var name = coerceString(svals[0]);
    var nameKind = (svals[0] instanceof Identifier) ? "identifier" : "string";

    var idx = 1, multiplicity, defaultValue;
    if (oneOfKeywords(svals[idx], "optional", "required", "oneormore"))
      multiplicity = svals[idx++].keyword;
    else
      multiplicity = "required";
    if (svals[idx] instanceof Default)
      defaultValue = svals[idx++];
    else
      defaultValue = null;
     var type = (idx < svals.length) ? chewType(svals[idx], ctx)
                                     : chewType("Object", ctx);

    var textStream = ctx.formatTextStream(tvals);
    return new $typerep.ArgDescriptor();
  },

  /**
   * Tagging interface for explicit callout of a default value in a sexpr
   *  context that you can hang a description off of.  We are intended to be
   *  used in a Param svals context special-cased to describe the default value.
   *  A similar but different class is DefaultCase used in OneOf; it is
   *  differentiated by supporting no svals and that is detected and dispatched
   *  by the factory.
   *
   * @args[
   *   @param[svals @list[
   *     @param["default value"]
   *   ]]
   * ]
   */
  "default": function(name, svals, tvals, ctx) {
    return new $typerep.ArgDefaultDescriptor(
                 chewType(svals[0], ctx),
                 ctx.formatTextStream(tvals));
  },
  /**
   * Variable-argument consumer named after the lispy concept of &rest args.  This
   *  implies that all remaining elements are of the given type (which could be
   *  a typedefed type or a OneOf or something).
   *
   * @args[
   *   @param[svals @list[
   *     @param["name" String]
   *     @param["type"]
   *   ]]
   * ]
   */
  rest: function(name, svals, tvals, ctx) {
    var vararg = new $typerep.VarArgDescriptor(
                       coerceString(svals[0]),
                       chewType(svals[1], ctx),
                       0, null,
                       ctx.formatTextStream(tvals));
    return vararg;
  },
  /**
   * Mark the return value.
   *
   * @args[
   *   @param[svals @list[
   *     @param["type"]
   *   ]]
   * ]
   */
  // We alias "return" to this right after the obj definition too.
  returns: function(name, svals, tvals, ctx) {
    var type = svals.length ? chewType(svals[0], ctx)
                            : chewType("undefined", ctx);
    var docStream = decodeFlow(tvals);

    return new $typeref.RetValDescriptor(type, docStream);
  },
  /**
   * Indicate that a function has a non-obvious 'this' applied to it when it is
   *  invoked.
   *
   * @args[
   *   @param[svals @list[
   *     @param["type"]
   *   ]]
   *   @param[tvals]
   *   @param[ctx]
   * ]
   */
  "this": function(name, svals, tvals, ctx) {
    return new $typerep.ThisDescriptor(chewType(svals[0], ctx),
                                       ctx.formatTextStream(tval));
  },
  func: function(name, svals, tvals, ctx) {
    // Unclear whether we really need a life story for a synthetic type or
    //  not.  Certainly if we start playing dxr and track accesses...
    var life = new $typerep.LifeStory(null, null);
    var func = new $typerep.FuncType(null, null, life);

    func.rawDocStream = func.docStream = tvals;
    var bits = $docstreams.snipeAndFilterSVals(svals,
                                               $typerep.ArgList,
                                               $typerep.RetValDescriptor,
                                               $typerep.ThisDescriptor);
    if (bits[0].length)
      throw new Error("func does not know what to do with extra svals: " +
                      bits[0]);
    func.argList = bits[1];
    func.retDesc = bits[2];
    func.thisDesc = bits[3];

    return func;
  },

  protocol: function(name, svals, tvals, ctx) {
    return new $protocols.Protocol(svals, tvals, ctx);
  },
  obeys: function(name, svals, tvals, ctx){
    return new $protocols.Obeys(svals, tvals, ctx);
  },

  // XXX for now just pass-through the underlying data type
  maybepromise: function(name, svals, tvals, ctx) {
    return svals[0];
  },

  //////////////////////////////////////////////////////////////////////////////
  // Cross-reference mechanisms
  argref: function(name, svals, tvals, ctx) {
    return new $xref.ArgRef(svals, tvals, ctx);
  },

  lxref: function(name, svals, tvals, ctx) {
    return new $xref.LocalXRef(svals, tvals, ctx);
  },
  xref: function(name, svals, tvals, ctx) {
    return new $xref.PackageXRef(svals, tvals, ctx);
  },

  //////////////////////////////////////////////////////////////////////////////
  // Type namespace exposure commands...
  showtypes: function(name, svals, tvals, ctx) {
    return null;
  }
  //////////////////////////////////////////////////////////////////////////////
};
exports.narscribblusExecFuncs["return"] = exports.narscribblusExecFuncs.returns;

}); // end require.def
