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

define("jstut/langbits/jsdoc",
  [
    "jstut/readers/scribble-syntax",
    "jstut/mcstreamy",
    "jstut/langs/manual",
    "jstut-plat/package-info",
    "jstut/typerep",
    "jstut/typeref",
    "jstut/xref",
    "jstut/protocols",
    "jstut/langbits/jslang-global-refs",
    "exports"
  ],
  function(
    syn,
    $docstreams,
    $man,
    $pkginfo,
    $typerep,
    $typeref,
    $xref,
    $protocols,
    $jslang_types,
    exports
  ) {

var Identifier = syn.Identifier, Keyword = syn.Keyword;
var coerceString = syn.coerceString;

var TypeRef = $typeref.TypeRef;

var decodeFlow = $man.decodeFlow;


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

/**
 * Attempt to coerce `valueThing` into a usable value.
 */
function chewValue(optionalName, valueThing, ctx) {
  var kind = null;

  switch (typeof(valueThing)) {
    case "string":
      kind = "String";
      break;
    case "boolean":
      kind = "Boolean";
      break;
    case "number":
      kind = "Number";
      break;
    case "object":
      if (valueThing instanceof Identifier) {
        switch (valueThing.identifier) {
          case "true":
            kind = "Boolean";
            valueThing = true;
            break;
          case "false":
            kind = "Boolean";
            valueThing = false;
            break;
          // otherwise it probably is a type reference/global that needs
          //  resolution.
        }
      }
  }
  if (kind) {
    return new $typerep.NamedValue(optionalName, valueThing, kind,
                                   new $typerep.LifeStory());
  }
  // just use chewType for everything else.
  return chewType(optionalName, valueThing, ctx);
}

/**
 * Attempt to coerce `typeThing` into a usable type.
 *
 * @args[
 *   @param[optionalName]{
 *     If the thing ends up being a value, this would be a name that it would
 *     make sense to associate with the value.
 *   }
 *   @param[typeThing]
 *   @param[ctx]
 * ]
 */
function chewType(optionalName, typeThing, ctx) {
  if (typeThing == null)
    throw new Error("null typeThing!");

  if (typeThing instanceof TypeRef)
    return typeThing;

  var pkg = ctx.options.pkg;

  // textual references that will be resolved on-demand
  if (typeof(typeThing) === "string")
    return new TypeRef(typeThing, pkg);
  if (typeof(typeThing) === "number")
    // XXX need to do a better audit in this file of when we should actually
    //  be passing a vaue for optionalName and when not; right now it was
    //  a quick hack-job.
    return new $typerep.NamedValue(optionalName,
                                   typeThing,
                                   "Number",
                                   new $typerep.LifeStory());
  if (typeThing instanceof Keyword)
    return new TypeRef(typeThing.keyword, pkg);
  if (typeThing instanceof Identifier)
    return new TypeRef(typeThing.identifier, pkg);

  // inline jsdoc types...
  if (("isType" in typeThing) && typeThing.isType)
    return typeThing;

  throw new Error("Unacceptable type: " + typeThing);
}

/**
 * This is just a tagging structure for simplified markup for groups/dicts.
 */
function Desc(rawDocStream) {
  this.rawDocStream = rawDocStream;
}
Desc.prototype = {
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
};

exports.jstutPreExecFuncs = {
  dict: function(tagName, ctx) {
    var dict = new $typerep.Dict();

    // The dict-all/dict-group stuff could be equally well accomplished via
    //  children walking.  But since we have it, let's use it.
    ctx.pushNamedContext("dict-all", {});
    ctx.pushNamedContext("groups-container", {});
    ctx.pushNamedContext("dict-group", {}); // ungrouped...
    ctx.pushNamedContext("lexicalTypeScope", dict);

    return dict;
  },
  group: function(tagName, ctx) {
    ctx.pushNamedContext("dict-group", {});
    return new $typerep.Group(null, null);
  },
  dictof: function(tagName, ctx) {
    var dictOf = new $typerep.DictOf(null, null);

    return dictOf;
  },
};

exports.jstutExecFuncs = {
  //////////////////////////////////////////////////////////////////////////////
  // Documentation Declaration

  /**
   * @args[
   *   @param[svals @list[
   *     @param["type name"]
   *     @param["type ref"]
   *   ]]
   * ]
   */
  typedef: function(tagName, svals, tvals, ctx) {
    var name = coerceString(svals[0]);
    var type = chewType(name, svals[1], ctx);

    return new $typerep.Typedef(name, type, ctx.formatTextStream(tvals));
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
    var idx = 1;
    if (svals[idx] instanceof Desc)
      dict.docStream = svals[idx++];
    else
      dict.docStream = ctx.formatTextStream(tvals);

    var key;
    dict.childrenByName = ctx.popNamedContext("dict-all");
    for (key in dict.childrenByName) dict.childCount++;

    dict.groups = ctx.popNamedContext("groups-container");
    for (key in dict.groups) dict.groupCount++;

    dict.ungroupedChildrenByName = ctx.popNamedContext("dict-group");
    ctx.popNamedContext("lexicalTypeScope");

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
  group: function(tagName, svals, tvals, ctx, group) {
    group.name = coerceString(svals[0]);
    ctx.namedContextAdd("groups-container", group, group.name);
    var idx = 1;
    if (svals[idx] instanceof Desc)
      group.rawDocStream = svals[idx++].rawDocStream;
    else
      group.rawDocStream = tvals;

    // extract out any topic links
    var docBits = $docstreams.snipeAndFilterTextStreamToArrays(
                    group.rawDocStream,
                    $man.TopicLink);
    group.docStream = ctx.formatTextStream(docBits[0]);
    group.topicLinks = docBits[1];

    group.childrenByName = ctx.popNamedContext("dict-group");
    for (var key in group.childrenByName) group.childCount++;
    return group;
  },
  /**
   * Descriptions are just a markup convenience for groups in order to
   *  describe them.  We produce a local type which our group tag is supposed
   *  to unbox to get the doc stream out of.
   */
  desc: function(name, svals, tvals, ctx) {
    if (ctx.parentToken != "group" &&
        ctx.parentToken != "dict")
      throw new Error(
        "desc tags can only be used inside dicts/groups to describe them");

    return new Desc(tvals);
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
    // coerce to a key descriptor if required...
    if (!(svals[0] instanceof $typerep.DictOfKeyDescriptor))
      throw new Error("First argument to dictof must be a @key!");
    dictOf.keyDesc = svals[0];

    // coerce to a value descriptor and/or default if required
    if (svals.length < 2 ||
        !(svals[1] instanceof $typerep.DictOfValueDescriptor))
      throw new Error("Second argument to dictof must be a @value!");
    dictOf.valueDesc = svals[1];

    return dictOf;
  },

  /**
   * Documents a specific named key in a Dict or the general key bit in a DictOf.
   *
   * @args[
   *   @param[svals @list[
   *     @param["key name" String]
   *     @param["optional keyword" #:optional]
   *     @param["default keyword" #:optional]
   *     @param["default payload" #:optional]
   *     @param["type"]
   *   ]]
   * ]
   */
  key: function(tagName, svals, tvals, ctx) {
    // the basics are the same for both varieties of keys
    var name = coerceString(svals[0]);
    var idx = 1, optional, defaultDesc = null;
    while (oneOfKeywords(svals[idx], "optional", "required", "default")) {
      var keyword = svals[idx++].keyword;
      switch (keyword) {
        case "optional":
        case "required":
          optional = (keyword === "optional");
          break;

        case "default":
          if (idx < svals.length)
            defaultDesc = new $typerep.ArgDefaultDescriptor(
                            chewValue(name, svals[idx++], ctx));
          break;
      }
    }

    if (svals[idx] instanceof $typerep.ArgDefaultDescriptor)
      defaultDesc = svals[idx++];

    var type = chewType(name, (idx < svals.length) ? svals[idx] : "String",
                        ctx);

    var docStream = ctx.formatTextStream(tvals);

    var entry;
    // parameterize based on whether we're in a Dict or a DictOf...
    if (ctx.parentToken == "dictof") {
      if (optional || defaultDesc)
        throw new Error("DictOf keys should not be optional or have defaults.");
      entry = new $typerep.DictOfKeyDescriptor(name, type, docStream);
      return entry;
    }
    // should be dict/group (inside a dict)
    else if (ctx.parentToken == "dict" || ctx.parentToken == "group") {
      entry = new $typerep.DictEntryDescriptor(
                             name, type, optional, defaultDesc, docStream
                           );
      ctx.namedContextAdd("dict-all", entry, name);
      ctx.namedContextAdd("dict-group", entry, name);
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
    var name = coerceString(svals[0]);
    return new $typerep.DictOfValueDescriptor(
                 name,
                 chewType(name, svals[1], ctx),
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
  listof: function(tagName, svals, tvals, ctx) {
    var name = coerceString(svals[0]);
    var type = chewType(name, svals.length >= 2 ? svals[1] : "Object", ctx);
    return new $typerep.ListOf(name, type, ctx.formatTextStream(tvals));
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
      if (v instanceof $typerep.CaseDescriptor)
        kids.push(v);
      else
        kids.push(new $typerep.CaseDescriptor(chewType(null, v, ctx),
                                              false,
                                              []));
    }
    return new $typerep.OneOf(kids, ctx.formatTextStream(tvals));
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
  "case": function(tagName, svals, tvals, ctx) {
    var type = chewType(null, svals[0], ctx);
    return new $typerep.CaseDescriptor(type, false,
                                       ctx.formatTextStream(tvals));
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
     var type = (idx < svals.length) ? chewType(null, svals[idx], ctx)
                                     : chewType(null, "Object", ctx);

    var textStream = ctx.formatTextStream(tvals);
    return new $typerep.ArgDescriptor(name, type, defaultValue, textStream);
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
                 chewType(null, svals[0], ctx),
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
                       chewType(null, svals[1], ctx),
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
    var type = svals.length ? chewType(null, svals[0], ctx)
                            : chewType(null, "undefined", ctx);
    var docStream = decodeFlow(tvals);

    return new $typerep.RetValDescriptor(type, docStream);
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
    return new $typerep.ThisDescriptor(chewType(null, svals[0], ctx),
                                       ctx.formatTextStream(tval));
  },
  func: function(name, svals, tvals, ctx) {
    // Unclear whether we really need a life story for a synthetic type or
    //  not.  Certainly if we start playing dxr and track accesses...
    var life = new $typerep.LifeStory(null, null);
    var func = new $typerep.FuncType(life);

    func.rawDocStream = func.docStream = tvals;
    var bits = $docstreams.snipeAndFilterSVals(svals,
                                               $typerep.ArgList,
                                               $typerep.RetValDescriptor,
                                               $typerep.ThisDescriptor);
    if (bits[0].length)
      throw new Error("func does not know what to do with extra svals: " +
                      bits[0]);
    func.argList = bits[1];
    // omitted return descriptor implies Object.
    func.retDesc = bits[2] ||
      new $typerep.RetValDescriptor($jslang_types.globals.Object, []);
    func.thisDesc = bits[3];

    return func;
  },

  /**
   * Used in one of two ways:
   * @itemize[
   *   @item{
   *     A tag that says the object we're commenting on is a protocol and this
   *     is its name.
   *   }
   *   @item{
   *     A name and a type that it names.  Not a tag, in that case.
   *   }
   * ]
   */
  protocol: function(tagName, svals, tvals, ctx) {
    var name = coerceString(svals[0]);
    var type = (svals.length >= 2) ? chewType(null, svals[1], ctx) : null;
    return new $protocols.Protocol(name, type, ctx.formatTextStream(tvals));
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

  docsplice: function(name, svals, tvals, ctx) {
    return new $xref.DocSplice(svals, tvals, ctx);
  },

  //////////////////////////////////////////////////////////////////////////////
  // Type namespace exposure commands...
  showtypes: function(name, svals, tvals, ctx) {
    return null;
  }
  //////////////////////////////////////////////////////////////////////////////
};
exports.jstutExecFuncs["return"] = exports.jstutExecFuncs.returns;

}); // end define
