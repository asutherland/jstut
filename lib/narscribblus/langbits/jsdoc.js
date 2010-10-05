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
    "narscribblus/langs/manual",
    "narscribblus/render/html",
    "narscribblus-plat/package-info",
  ],
  function(
    exports,
    syn,
    man,
    html,
    pkginfo
  ) {

var Identifier = syn.Identifier, Keyword = syn.Keyword;

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

/**
 * Helper function to expand a type.
 */
function htmlifyContainerTypeOrSym(type, options) {

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

/**
 * A heterogeneous dictionary type where each attribute has its own semantics
 *  as documented by Key instances.  Keys may possibly be grouped using Group
 *  instances.
 *
 * @args[
 *   @param[svals @listof[@oneof[Group Key]]]{
 *   }
 *   @param[tvals TextStream]
 *   @param[ctx Context]
 * ]
 */
function Dict(ctx) {
  ctx.pushNamedContext("dict-all", {});
  ctx.pushNamedContext("lexicalTypeScope", this);
}
Dict.prototype = {
  isType: true,
  keysByName: null,
  kids: null,

  _exec: function(svals, tvals, ctx) {
    this.keysByName = ctx.popNamedContext("dict-all");
    ctx.popNamedContext("lexicalTypeScope");

    // display ordering of immediate children
    this.kids = svals;
  },

  traverseChild: function(name) {
    if (name in this.keysByName)
      return this.keysByName[name];
    return undefined;
  },

  /**
   * Dicts are inherently anonymous, although they can be wrapped in a typedef
   *  which is exposed as not-anonymous.
   */
  isAnonymous: true,
  /**
   * Hard to image a simple dict...
   */
  isSimple: false,
  /**
   * Our terse description has to just be a generic object with stuff in it; the
   *  good news is we can at least hyperlink down to ourselves probably.
   */
  citeTypeHTML: function(options, expandedNearby) {
    return "<span class='dict'>{...}</span>";
  },

  briefTypeExpansionHTML: function(options) {
    var s = "{";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      if (i)
        s += ", ";
      s += kids[i].citeTypeHTML(options);
    }
    return s + "}";
  },

  detailedTypeExpansionHTML: function(options) {
    var s = "";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      s += kids[i].detailedTypeExpansionHTML(options);
    }
    return s;
  },

  descriptionHTML: function(options) {
    // the description should be on the typedef or param, not us.
    return null;
  },

  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

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
function Group(svals, tvals, ctx) {
  this.groupName = coerceString(svals[0]);
  var idx = 1;
  if (svals[idx] instanceof Desc)
    this.desc = svals[idx++];
  else
    this.desc = null;
  this.kids = svals.slice(idx);
}
Group.prototype = {
  citeTypeHTML: function(options) {
    var s = "<div class='citeGroup'>" +
      "<span class='citeGroupName'>" + htmlEscapeText(this.groupName) +
      "</span>: ";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      if (i)
        s += ", ";
      var kid = this.kids[i];
      s += kid.citeTypeHTML(options);
    }
    return s + "</div>";
  },
  briefTypeExpansionHTML: function(options) {
    var s = "<div class='briefGroup'>" +
      "<span class='briefGroupName'>" + htmlEscapeText(this.groupName) +
      "</span>: ";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      if (i)
        s += ", ";
      var kid = this.kids[i];
      s += kid.briefTypeExpansionHTML(options);
    }
    return s + "</div>";
  },
  detailedTypeExpansionHTML: function(options) {
    var s = "<div class='group'>\n" +
      "  <div class='groupName'>" + this.groupName + "</div>\n" +
      (this.desc ?
       ("<div class='groupDesc'>"+ this.desc.toHTMLString(options) + "</div>") :
       "") +
      "  <div class='groupContents'>\n";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      s += kids[i].detailedTypeExpansionHTML(options);
    }
    s +=  "  </div>\n" +
      "</div>\n";
    return s;
  },
};

function Desc(tvals, ctx) {
  this.textStream = decodeFlow(tvals);
}
Desc.prototype = {
  toHTMLString: function(options) {
    return htmlStreamify(this.textStream, options);
  }
};

/**
 * A homogeneous dictionary type where all attributes have the same semantics
 *  and therefore where the name and value form an informative tuple.  We
 *  expect to have one Key and one Value child.
 *
 * @args[
 *   @param[svals @list[
 *     @param["key" Key]{
 *     }
 *     @param["value" Value]{
 *     }
 *   ]]
 * ]
 */
function DictOf(ctx) {
  ctx.pushNamedContext("dict-all", {});
}
DictOf.prototype = {
  _exec: function(svals, tvals, ctx) {
    this.key = chewType(svals[0], ctx);
    this.key.inDictOf = true;
    this.value = chewType(svals[1], ctx);
    ctx.popNamedContext("dict-all");
  },
  isType: true,
  traverseChild: function() {
    // XXX it would be good if we could distinguish the key from the value,
    //  but for now it's simplest to just pretend we don't have children.
    return null;
  },
  citeTypeHTML: function(options, expandedNearby) {
    return "{" + this.key.citeTypeHTML(options) + ": " +
      this.value.citeTypeHTML(options) + "*}";
  },
  briefTypeExpansionHTML: function(options) {
    return "{" + this.key.briefTypeExpansionHTML(options) + ": " +
      this.value.briefTypeExpansionHTML(options) + "*}";
  },
  detailedTypeExpansionHTML: function(options) {
    // break out the key and the value specifically...
    return this.key.detailedTypeExpansionHTML(options) +
      this.value.detailedTypeExpansionHTML(options);
  },
  descriptionHTML: function(options) {
    // we shouldn't have anything interesting to say; we should be owned by a
    //  typedef or param that should have the interesting comments.
    return null;
  },
  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

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
function Key(svals, tvals, ctx) {
  this.inDictOf = false;
  this.keyName = coerceString(svals[0]);
  var idx = 1;
  if (oneOfKeywords(svals[idx], "optional", "required"))
    this.optional = (svals[idx++].keyword === "optional");
  else
    this.optional = false;
  if (svals[idx] instanceof Default)
    this.defaultValue = svals[idx++];
  else
    this.defaultValue = null;
  this.type = chewType((idx < svals.length) ? svals[idx] : "String", ctx);

  this.textStream = decodeFlow(tvals);

  ctx.namedContextAdd("dict-all", this, this.keyName);
}
Key.prototype = {
  isType: true,
  traverseChild: commonTypeTraverseChild,
  traverseArg: commonTypeTraverseArg,
  // just show our name and type
  citeTypeHTML: function(options) {
    var s = htmlEscapeText(this.keyName) + " " +
            this.type.citeTypeHTML(options);
    return s;
  },
  // elaborate on optional and default values...
  briefTypeExpansionHTML: function(options) {
    var s = htmlEscapeText(this.keyName) + " " +
            this.type.briefTypeExpansionHTML(options);
    return s;
  },
  detailedTypeExpansionHTML: function(options) {
    var s = "<div class='attrName'>" + htmlEscapeText(this.keyName) +
      "</div>\n";
    s += "<div class='typeBrief'>" +
         this.type.briefTypeExpansionHTML(options) +
         "</div>";
    s += "<div class='typeDetail'>" +
         this.type.detailedTypeExpansionHTML(options) +
         "</div>";
    s += "<div class='attrDesc'>" + htmlStreamify(this.textStream, options) +
      "</div>";
    return s;
  },
  descriptionHTML: function(options) {
    // (it goes just on the detailed type expansion)
    return null;
  },
  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

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
function Value(svals, tvals, ctx) {
  this.name = coerceString(svals[0]);
  this.type = chewType(svals[1], ctx);
  this.textStream = decodeFlow(tvals);
}
Value.prototype = {
  isType: true,
  citeTypeHTML: function(options) {
    var s = htmlEscapeText(this.name) + " " +
            this.type.citeTypeHTML(options);
    return s;
  },
  briefTypeExpansionHTML: function(options) {
    var s = htmlEscapeText(this.name) + " " +
            this.type.briefTypeExpansionHTML(options);
    return s;
  },
  detailedTypeExpansionHTML: function(options) {
    var s = "<div class='attrName'>" + htmlEscapeText(this.name) +
      "</div>\n";
    s += "<div class='typeBrief'>" +
         this.type.briefTypeExpansionHTML(options) +
         "</div>";
    s += "<div class='typeDetail'>" +
         this.type.detailedTypeExpansionHTML(options) +
         "</div>";
    s += "<div class='attrDesc'>" + htmlStreamify(this.textStream, options) +
      "</div>";
    return s;
  },
  descriptionHTML: function(options) {
    // (it goes just on the detailed type expansion)
    return null;
  },
  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

/**
 * Heterogeneous list where each positional parameter has a distinct
 *  semantic purpose named by a Param or a Rest (as the last element).
 *
 * @args[
 *   @param[svals @list[
 *     @param["stuffs" #:oneormore Param]
 *     @param["rest" #:optional Rest]
 *   ]]
 * ]
 */
function List(svals, tvals, ctx) {
  this.params = svals;
}
List.prototype = {
  isType: true,
  /**
   * Lists are inherently anonymous, although they can be wrapped in a typedef
   *  which is exposed as not-anonymous.
   */
  isAnonymous: true,
  /**
   * Hard to image a simple heterogeneous list.
   */
  isSimple: false,
  /**
   * Our terse description has to just be a generic object with stuff in it; the
   *  good news is we can at least hyperlink down to ourselves probably.
   */
  citeTypeHTML: function(options, expandedNearby) {
    return "<span class='list'>[...]</span>";
  },

  briefTypeExpansionHTML: function(options) {
    var s = "<div class='typeBrief'>[";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      s += kids[i].briefTypeExpansionHTML(options);
    }
    return s + "]</div>\n";
  },

  detailedTypeExpansionHTML: function(options) {
    var s = "";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      s += kids[i].detailedTypeExpansionHTML(options);
    }
    return s;
  },

  descriptionHTML: function(options) {
    return null;
  },

  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

/**
 * Homogeneous list where all parameters have the same semantics.
 *
 * @args[
 *   @param[svals @list[
 *     @param["name/description"]
 *     @param["type"]
 *   ]]
 * ]
 */
function ListOf(svals, tvals, ctx) {
  this.name = coerceString(svals[0]);
  this.type = chewType(svals[1], ctx);
}
ListOf.prototype = {
  isType: true,
  citeTypeHTML: function(options, expandedNearby) {
    return "[" + htmlEscapeText(this.name) + " : " +
      this.type.citeTypeHTML(options) + "...]";
  },
  briefTypeExpansionHTML: function(options) {
    return "[" + htmlEscapeText(this.name) + " : " +
      this.type.briefTypeExpansionHTML(options) + "...]";
  },
  detailedTypeExpansionHTML: function(options) {
    var s = "<div class='attrName'>" + htmlEscapeText(this.name) + "</div>\n" +
      "<div class='typeBrief'>" + this.type.briefTypeExpansionHTML(options) +
      "</div>\n" +
      "<div class='typeDetail'>" + this.type.detailedTypeExpansionHTML(options)+
      "</div>\n";
  },
  descriptionHTML: function(options) {
    return null;
  },
  toHTMLString: function(options) {
    return this.detailedTypeExpansionHTML(options);
  },
};

/**
 * Type disjunction; used to say that in a given spot a value can possess one
 *  of type from a given set of types.  It is presumed that the consumer of the
 *  type uses some form of inspection or explicitly documented context to tell
 *  things apart.
 *
 * @args[
 *   @param[svals @listof[@oneof[
 *     @case[Case]
 *     @case[DefaultCase]
 *     @default[Type]
 *   ]]
 * ]
 */
function OneOf(svals, tvals, ctx) {
  var kids = this.kids = [];
  for (var i = 0; i < svals.length; i++) {
    var v = svals[i];
    if (v instanceof Case || v instanceof DefaultCase)
      kids.push(v);
    else
      kids.push(chewType(v, ctx));
  }
}
OneOf.prototype = {
  isType: true,
  citeTypeHTML: function(options, expandedNearby) {
    return "(union)";
  },
  briefTypeExpansionHTML: function(options) {
    var s = "";
    var kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      if (i)
        s += " | ";
      s += kids[i].citeTypeHTML(options);
    }
    return s;
  },
  detailedTypeExpansionHTML: function(options) {
    var bits = [], kids = this.kids;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      // We only care about kids wrapped in some form of description.
      if (!(kid instanceof Case) && !(kid instanceof DefaultCase))
        continue;
      var desc = kid.descriptionHTML(options);
      bits.push(
        "<div class='attrName'>" + kid.name + "</div>" +
        "<div class='typeBrief'>" + kid.briefTypeExpansionHTML(options) +
          "</div>" +
        "<div class='typeDetail'>" + kid.detailedTypeExpansionHTML(options) +
          "</div>" +
        (desc ? ("<div class='attrDesc'>" + desc + "</div>") : "")
      );
    }
    return bits.join("");
  },
  toHTMLString: function(options) {
    var s = "<dl class='oneof'>\n";
    for (var i = 0; i < this.kids; i++) {
      var kid = this.kids[i];
      if (kid instanceof Case || kid instanceof DefaultCase)
        s += kid.toHTMLString(options);
      else
        s += "<dt>" + coerceString(kid) + "</dt>\n";
    }
    s += "</dl>";
    return s;
  },
};

/**
 * Used to annotate type values with documentation inside a OneOf.
 *
 * @args[
 *   @param[svals @list[
 *     @param["type"]
 *   ]]
 * ]
 */
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

/**
 * Container that defines we are documenting the argument list for a function.
 *  This does not obey @xref{OutputtableType}; the function owner is responsible
 *  for dealing with our type directly.
 *
 * @args[
 *   @param[svals @listof[Param]]
 * ]
 */
function Args(svals) {
  this.kids = svals;
}
Args.prototype = {
  /**
   * (This should only be used in debug output-ish modes where comment blocks
   *  are being rendered as dumb text streams.)
   */
  toHTMLString: function(options) {
    return htmlStreamify(this.kids, options);
  },
};
exports.Args = Args;

/**
 * Documents a named argument to a function or a positional value within a List.
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
function Param(svals, tvals, ctx) {
  this.name = coerceString(svals[0]);
  this.nameKind = (svals[0] instanceof Identifier) ? "identifier" : "string";

  var idx = 1;
  if (oneOfKeywords(svals[idx], "optional", "required", "oneormore"))
    this.multiplicity = svals[idx++].keyword;
  else
    this.multiplicity = "required";
  if (svals[idx] instanceof Default)
    this.defaultValue = svals[idx++];
  else
    this.defaultValue = null;
  this.type = (idx < svals.length) ? chewType(svals[idx], ctx)
                                   : chewType("Object", ctx);

  this.textStream = decodeFlow(tvals);
}
Param.prototype = {
  traverseChild: function(name, staticOrInstance) {
    // Just defer to our underlying type. (We pierce this on-demand rather than
    //  having our caller pierce all for all-time so that when they are talking
    //  about a specific argument they also get the details on the param.)
    return this.type.traverseChild(name, staticOrInstance);
  },
};

/**
 * Tagging interface for explicit callout of a default value in a sexpr context
 *  that you can hang a description off of.  We are intended to be used in a
 *  Param svals context special-cased to describe the default value.  A similar
 *  but different class is DefaultCase used in OneOf; it is differentiated by
 *  supporting no svals and that is detected and dispatched by the factory.
 *
 * @args[
 *   @param[svals @list[
 *     @param["default value"]
 *   ]]
 * ]
 */
function Default(svals, tvals, ctx) {
  this.value = svals.length ? coerceString(svals[0]) : null;
  this.textStream = decodeFlow(tvals);
}
Default.prototype = {
};

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
function Rest(svals, tvals, ctx) {
  this.name = coerceString(svals[0]);
  this.type = chewType(svals[1], ctx);
  this.textStream = decodeFlow(tvals);
}
Rest.prototype = {
};

/**
 * Mark the return value.
 *
 * @args[
 *   @param[svals @list[
 *     @param["type"]
 *   ]]
 * ]
 */
function Retval(svals, tvals, ctx) {
  this.type = svals.length ? chewType(svals[0], ctx) : chewType("undefined", ctx);
  this.textStream = decodeFlow(tvals);
}
Retval.prototype = {
  citeTypeHTML: function(options, expandedNearby) {
    return this.type.citeTypeHTML(options, expandedNearby);
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
  toHTMLString: function(options) {
    return "<div class='attrName retVal'>(return value)</div>\n" +
      "<div class='typeBrief'>" + this.briefTypeExpansionHTML(options) +
      "</div>\n" +
      "<div class='typeDetail'>" + this.detailedTypeExpansionHTML(options)+
      "</div>\n" +
      "<div class='attrDesc'>" + this.descriptionHTML(options) +
      "</div>\n";
  }
};
exports.Retval = Retval;

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
function ThisContext(svals, tvals, ctx) {
  this.type = chewType(svals[0], ctx);
  this.textStream = decodeFlow(tvals);
}
ThisContext.prototype = {
  citeTypeHTML: function(options, expandedNearby) {
    return this.type.citeTypeHTML(options, expandedNearby);
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
  toHTMLString: function(options) {
    return this.type.toHTMLString(options);
  },
};
exports.ThisContext = ThisContext;

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

/**
 * Associates a specific protocol name with whatever object's documentation
 *  block it is declared in the context of.  We might also consider allowing
 *  this to be used in a standalone block with a specifically named type as
 *  the second argument.
 *
 * XXX not actually implemented!
 */
function Protocol(svals, tvals, ctx) {

}
Protocol.prototype = {
  isType: true,
  toHTMLString: function(options) {
    return "";
  }
};

/**
 * Declares that an object obeys the explicitly named protocols.  Goes on the
 *  doc block of the type in question.
 *
 * XXX not actually implemented!
 */
function Obeys(svals, tvals, ctx) {

}
Obeys.prototype = {
  toHTMLString: function(options) {
    return "";
  }
};

/**
 * Local cross-reference.  We walk up the 'type' hierarchy looking for a place
 *  where the given term has meaning.
 *
 * @itemize[
 *   @item{Dictionary key names.}
 *   @item{Function arguments.}
 *   @item{Class methods / fields.}
 *   @item{Global type names.}
 * ]
 */
function LocalXRef(svals, tvals, ctx) {
  this.name = tvals.toString();
  this.scopeStack = ctx.snapshotNamedContextStack("lexicalTypeScope");
}
LocalXRef.prototype = {
  /**
   * Resolve the cross-reference.  You ideally want to call this as late as
   *  possible to ensure that all types have been fully loaded.
   */
  resolve: function() {
    var scopeStack = this.scopeStack;
    // - check the explicit lexical stack (tops out at the module scope)...
    for (var i = scopeStack.length - 1; i >= 0; i--) {
      var scope = scopeStack[i];
      var thing;
      if ("traverseChild" in scope)
        thing = scope.traverseChild(this.name);
      if (!thing && ("traverseArg" in scope))
        thing = scope.traverseArg(this.name);
      if (thing)
        return thing;
    }
    // - fail over to the package doc namespace

  },
  toHTMLString: function(options) {

  },
};

/**
 * Package global cross-reference; the term is assumed to start from the
 *  package's documentation global namespace.
 */
function PackageXRef() {

}
PackageXRef.prototype = {

};

/**
 * Cross-reference an argument of a constructor/function for type referencing
 *  purposes.  The general idea is that if you are just passing an argument
 *  through to some function/constructor that uses a one-off anonymous type,
 *  there is no real need for you to go through the effort of making it an
 *  explicitly named type and the extra confusion that might entail.
 *
 * And before you ask, yes, in theory we could magically determine such things,
 *  but this is one of those "not bloody likely in practice" theories.
 */
function ArgRef(svals, tvals, ctx) {
  this.resolved = null;
  this.s = coerceString(svals[0]);
  this.pkg = ctx.options.pkg;
  if (!this.pkg)
    throw new Error("I need a package!");
}
ArgRef.prototype = {
  __proto__: TypeRef.prototype,

  isType: true,
  _resolve: function() {
    if (this.resolved)
      return true;

    // pierce the type; we don't want to discuss the name of the other argument!
    this.resolved = this.pkg.traverse(this.s).type;
    if (this.resolved)
      return true;
    return false;
  },
};

function ShowTypes(svals, tvals, ctx) {

}
ShowTypes.prototype = {

};

exports.narscribblusGeneralHooks = {
  htmlDocStaticHookup: function(options) {
    options.namedCssBlocks["jsdoc"] = true;
    options.cssUrls.push(pkginfo.dataDirUrl("narscribblus/css/js-doc-bits.css"));
  }
};

exports.narscribblusExecFuncs = {
  //////////////////////////////////////////////////////////////////////////////
  // Documentation Declaration
  typedef: function(name, svals, tvals, ctx) {
    return new Typedef(svals, tvals, ctx);
  },
  dict: function(name, svals, tvals, ctx, preVal) {
    preVal._exec(svals, tvals, ctx);
    return preVal;
  },
  group: function(name, svals, tvals, ctx) {
    return new Group(svals, tvals, ctx);
  },
  desc: function(name, svals, tvals, ctx) {
    return new Desc(tvals, ctx);
  },
  dictof: function(name, svals, tvals, ctx, preVal) {
    preVal._exec(svals, tvals, ctx);
    return preVal;
  },
  key: function(name, svals, tvals, ctx) {
    return new Key(svals, tvals, ctx);
  },
  value: function(name, svals, tvals, ctx) {
    return new Value(svals, tvals, ctx);
  },
  list: function(name, svals, tvals, ctx) {
    return new List(svals, tvals, ctx);
  },
  listof: function(name, svals, tvals, ctx) {
    return new ListOf(svals, tvals, ctx);
  },
  oneof: function(name, svals, tvals, ctx) {
    return new OneOf(svals, tvals, ctx);
  },
  "case": function(name, svals, tvals, ctx) {
    return new Case(svals, tvals, ctx);
  },
  args: function(name, svals, tvals, ctx) {
    return new Args(svals, tvals, ctx);
  },
  param: function(name, svals, tvals, ctx) {
    return new Param(svals, tvals, ctx);
  },
  "default": function(name, svals, tvals, ctx) {
    return new Default(svals, tvals, ctx);
  },
  rest: function(name, svals, tvals, ctx) {
    return new Rest(svals, tvals, ctx);
  },
  "return": function(name, svals, tvals, ctx) {
    return new Retval(svals, tvals, ctx);
  },
  // If I can't remember which one is right, no one can!
  // Also, if you can, I hate you...
  // in the sense where hate = envy your ability to remember such things, but
  //  where I overcompensate for an inability to remember things with an
  //  overdeveloped hyperbole gland and an undeveloped sense of what a gland is.
  returns: function(name, svals, tvals, ctx) {
    return new Retval(svals, tvals, ctx);
  },
  "this": function(name, svals, tvals, ctx) {
    return new ThisContext(svals, tvals, ctx);
  },
  func: function(name, svals, tvals, ctx) {
    return new Func(svals, tvals, ctx);
  },

  protocol: function(name, svals, tvals, ctx) {
    return new Protocol(svals, tvals, ctx);
  },
  obeys: function(name, svals, tvals, ctx){
    return new Obeys(svals, tvals, ctx);
  },

  // XXX for now just pass-through the underlying data type
  maybepromise: function(name, svals, tvals, ctx) {
    return svals[0];
  },

  //////////////////////////////////////////////////////////////////////////////
  // Cross-reference mechanisms
  argref: function(name, svals, tvals, ctx) {
    return new ArgRef(svals, tvals, ctx);
  },

  lxref: function(name, svals, tvals, ctx) {
    return new LocalXRef(svals, tvals, ctx);
  },
  xref: function(name, svals, tvals, ctx) {
    return new PackageXRef(svals, tvals, ctx);
  },

  //////////////////////////////////////////////////////////////////////////////
  // Type namespace exposure commands...
  showtypes: function(name, svals, tvals, ctx) {
    return new ShowTypes(svals, tvals, ctx);
  }
  //////////////////////////////////////////////////////////////////////////////
};

exports.narscribblusPreExecFuncs = {
  dict: function(name, ctx) {
    return new Dict(ctx);
  },
  dictof: function(name, ctx) {
    return new DictOf(ctx);
  },
};

}); // end require.def
