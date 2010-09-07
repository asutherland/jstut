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

var syn = require("narscribblus/readers/scribble-syntax");
var Identifier = syn.Identifier, Keyword = syn.Keyword;
var self = require("self");

var man = require("narscribblus/langs/manual");
var decodeFlow = man.decodeFlow;
var html = require("narscribblus/render/html");
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

/**
 * Maintains an indirect type reference; we can't resolve types at expansion
 *  time so we need some form of promise like this.
 *
 * @obeys[HtmlNode]
 */
function TypeRef(s, pkg) {
  this.s = s;
  this.pkg = pkg;
  this.resolved = null;
}
TypeRef.prototype = {
  _resolve: function() {
    if (this.resolved)
      return true;

    this.resolved = this.pkg.resolveInternal(this.s);
    if (this.resolved) {
      console.log("resolved", this.s, "to", this.resolved);
      return true;
    }

    return false;
  },

  traverseChild: function(name, childMode) {
    if (!this._resolve())
      return null;
    return this.resolved.traverseChild(name, childMode);
  },
  traverseArg: function(index) {
    if (!this._resolve())
      return null;
    return this.resolved.traverseArg(index);
  },

  toHTMLString: function(options) {
    return htmlEscapeText(this.s);
  }
};

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
 * @protocol[OutputtableType]
 *
 *
 */
var OutputtableType = {
  /**
   * Indicates whether the type is anonymous and must therefore be recursively
   *  expanded (true), or can just be hyperlinked.
   */
  isAnonymous: null,
  /**
   * Indicates whether the type is sufficiently simple that it makes sense to
   *  expand it inline rather than require the user to take some action to
   *  see it in its (short) entirety.
   */
  isSimple: null,

  /**
   * Provide a snippet of HTML for use where you only want the type name without
   *  a discourse on the type.
   *
   * @args[
   *   @param[options]
   *   @param[expandedNearby Boolean]{
   *     Will the type be expanded in its entirety somewhere close by?  This
   *     affects whether we emit a global link or a local scrolling link.
   *   }
   * ]
   * @return[String]
   */
  citeTypeHTML: function(options, expandedNearby) {
  },

  /**
   * Provide a snippet of HTML that briefly describes the type.  Examples:
   * @itemize[
   *   @item{
   *     A function would include the function signature with all arguments
   *     named and their type names cited, but no expansions of the type or
   *     descriptions of the purposes of the arguments unless they are
   *     anonymous.
   *    }
   *   @item{
   *     A heterogeneous dictionary object would name the list of keys and cite
   *     their types (potentially still clustering by groups) but not expand
   *     the types or their descriptions.
   *   }
   * ]
   * @return[String]
   */
  briefTypeExpansionHTML: function(options) {
  },

  /**
   * Provides a detailed HTML expansion of the type.  Non-anonymous, non-simple
   *  sub-types should be at most briefly described, anonymous or simple types
   *  should be expanded.
   *
   * Examples of what this might entail:
   * @itemize[
   *   @item{
   *     A function would provide description of its arguments and return value.
   *     The only difference for expanded/unexpanded sub-types is whether we
   *     invoke detailedTypeExpansionHTML and create a div for it or not.
   *   }
   *   @item{
   *     A heterogeneous dictionary object would expand the list of keys,
   *     grouping as appropriate, in a similar fashion to the function case.
   *   }
   * ]
   */
  detailedTypeExpansionHTML: function(options) {
  },

  /**
   * HTML description of the type;
   *
   * @return[String]
   */
  descriptionHTML: function(options) {
  },
};

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
  this.kids = svals.slice(1);
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
  terseHTMLSnippet: function(options, expandedNearby) {
    return "<span class='name'>" + this.name + "</span>";
  },
  briefHTMLSnippet: function(options) {
    return this.type.briefHTMLSnippet(options);
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
    return "<div class='typeBrief'>{" +
      htmlStreamify(this.kids, options, ",") +
      "}</div>\n";
  },

  detailedTypeExpansionHTML: function(options) {

  },

  toHTMLString: function(options) {
    // streamify once with brief type mode...
    //
    return "<div class='typeDetail'>" +
      htmlStreamify(this.kids, options) +
      "</div>\n";
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
  citeTypeHTML: function() {
    throw new Error("we are not actually a type; you should not be doing this");
  },
  briefTypeExpansionHTML: function(options) {
    return "<div class='briefGroup'>" +
      "<span class='briefGroupName'>" + htmlEscapeText(this.groupName) +
      "</span>" +
      htmlStreamify(this.kids, options) +
      "</div>";
  },
  detailedTypeExpansionHTML: function(options) {
    var s = "<div class='group'>\n" +
      "  <div class='groupName'>" + this.groupName + "</div>\n" +
      (this.desc ?
       ("<div class='groupDesc'>"+ this.desc.toHTMLString(options) + "</div>") :
       "") +
      "  <div class='groupContents'>\n" +
      htmlStreamify(this.kids, options) +
      "  </div>\n" +
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
function DictOf(svals, tvals, ctx) {
  this.key = chewType(svals[0], ctx);
  this.value = chewType(svals[1], ctx);
}
DictOf.prototype = {
  isType: true,
  toHTMLString: function(options) {
    if (options.brief) {
      return "{" + this.key.toHTMLString(options) + ": " +
        this.value.toHTMLString(options) + ", ...};";
    }
    var s = "A dictionary whose elements are made of:" +
      "<div class='attrName'>key</div>";
    options.brief = 1;
    s += "<div class='typeBrief'>" + this.key.toHTMLString(options) + "</div>";
    options.brief = 0;
    s += "<div class='typeDetail'>" + this.key.toHTMLString(options) + "</div>";

    //  "<div class='typeBrief'>" + this.value.toHTMLString(options) + "</div>"

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
  this.keyName = coerceString(svals[0]);
  var idx = 1;
  if (oneOfKeywords(svals[idx], "optional", "required"))
    this.optional = (svals[idx++].keyword === "optional");
  else
    this.optional = false;
  this.type = chewType((idx < svals.length) ? svals[idx] : "Object", ctx);

  this.textStream = decodeFlow(tvals);

  ctx.namedContextAdd("dict-all", this, this.keyName);
}
Key.prototype = {
  traverseChild: commonTypeTraverseChild,
  traverseArg: commonTypeTraverseArg,
  toHTMLString: function(options) {
    var s = "<div class='attrName'>" + htmlEscapeText(this.keyName) +
      "</div>\n";
    options.brief = true;
    s += "<div class='typeBrief'>" + this.type.toHTMLString(options) +
      "</div>";
    options.brief = false;
    s += "<div class='typeDetail'>" + this.type.toHTMLString(options) +
      "</div>";
    s += "<div class='attrDesc'>" + htmlStreamify(this.textStream, options) +
      "</div>";
    return s;
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
  toHTMLString: function(options) {
    return "<dt>" + this.name + " : " +
      this.type.toHTMLString(options) + "</dt>\n" +
      "<dd>" + htmlStreamify(this.textStream, options) + "</dd>\n";
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
    return "<span class='dict'>[...]</span>";
  },

  briefTypeExpansionHTML: function(options) {
    return "<div class='typeBrief'>[" +
      htmlStreamify(this.kids, options, ",") +
      "]</div>\n";
  },

  toHTMLString: function(options) {
    return "<dd class='list'>\n" +
      htmlStreamify(this.params, options) +
      "</dd>\n";
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
  toHTMLString: function(options) {
    return "[" + this.name + " : " +
      this.type.toHTMLString(options) + "...]";
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
  toHTMLString: function(options) {
    return "<dt>" + this.type.toHTMLString(options) + "</dt>\n" +
      "<dd>" + htmlStreamify(this.textStream, options) + "</dd>";
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
  this.textStream = decodeFlow(tvals);
}
DefaultCase.prototype = {
  toHTMLString: function(options) {
    return "<dt>Default</dt>\n" +
      "<dd>" + htmlStreamify(this.textStream, options) + "</dd>\n";
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
    return "<dl class='args'>\n" +
      htmlStreamify(this.kids, options) +
    "</dl>\n";
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

  listHTMLSnippet: function(options) {
    var wrapPre = "", wrapPost = "";
    if (this.multiplicity === "optional") {
      wrapPre = "[";
      wrapPost = "]";
    }
    else if (this.multiplicity === "oneormore") {
      wrapPost = "+";
    }

    return "<span class='" + this.nameKind + "'>" +
      wrapPre + this.name + wrapPost +
      "</span>";
  },
  toHTMLString: function(options) {
    return "<dt>" + this.name + " : " +
      this.type.toHTMLString(options) + "</dt>\n" +
      "<dd>" + htmlStreamify(this.textStream, options) +
      (this.defaultValue ?
         ("<p>" + this.defaultValue.toHTMLString(options) + "</p>") : "") +
      "</dd>\n";
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
  toHTMLString: function() {
    return "<b>Default: " + this.value + "</b> " +
      htmlStreamify(this.textStream, options);
  }
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
  listHTMLSnippet: function(options) {
    return "<span class='rest'>" + this.name + "...</span>";
  },
  toHTMLString: function(options) {
    return "<dt>" + this.name + "... " +
      this.type.toHTMLString(options) + "</dt>\n" +
      "<dd>" + htmlStreamify(this.textStream, options) +
      "</dd>\n";
  },
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
  this.type = svals.length ? chewType(svals[0], ctx) : null;
  this.textStream = decodeFlow(tvals);
}
Retval.prototype = {
  toHTMLString: function(options) {
    if (!this.type)
      return "<b>Void Return</b>";
    return "<b>Returns:</b> " + this.type.toHTMLString(options) + " " +
      htmlStreamify(this.textStream, options);
  },
};

/**
 * @args[
 *   @param[svals @list[
 *     @param["args" #:optional Args]
 *     @param["return" #:optional Retval]
 *   ]]
 * ]
 */
function Func(svals, tvals, ctx) {
  this.kids = svals;
  this.args = findChildByType(svals, Args);
  this.ret = findChildByType(svals, Retval);
}
Func.prototype = {
  isType: true,
  traverseArg: function(index) {
    if (this.arg)
      return this.arg.traverseArg(index);
    return null;
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
}
ArgRef.prototype = {

};

function ShowTypes(svals, tvals, ctx) {

}
ShowTypes.prototype = {

};

exports.narscribblusGeneralHooks = {
  htmlDocStaticHookup: function(options) {
    options.namedCssBlocks["jsdoc"] = true;
    options.cssBlocks.push(self.data.load("css/js-doc-bits.css"));
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
  dictof: function(name, svals, tvals, ctx) {
    return new DictOf(svals, tvals, ctx);
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
  }
};
