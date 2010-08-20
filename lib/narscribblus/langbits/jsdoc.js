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
var Identity = syn.Identity, Keyword = syn.Keyword;

var man = require("narscribblus/langs/manual");
var htmlStreamify = man.htmlStreamify, decodeFlow = man.decodeFlow;

function coerceString(st) {
  if (typeof(st) === "string")
    return st;
  if (st instanceof Keyword)
    return st.keyword;
  if (st instanceof Identity)
    return st.identity;
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
 *     @param[""]
 *   ]]
 * ]
 */
function Typedef(svals, tvals, ctx) {
  this.typeName = coerceString(svals[0]);
  this.kids = svals.slice(1);
}
Typedef.prototype = {
  toHTMLString: function(options) {
    return "<dl class='typedef'>\n" +
      "  <dt class='typename'>" + this.typeName + "</dt>\n" +
      "  <dd>" + htmlStreamify(this.kids, options) + "</dd>\n" +
      "</dl>\n";
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
function Dict(svals, tvals, ctx) {
  this.keysByName = ctx.popNamedContext("dict-all");

  // display ordering of immediate children
  this.kids = svals;
}
Dict.prototype = {
  toHTMLString: function(options) {
    return "<dl class='dict'>\n  " +
      htmlStreamify(this.kids, options) +
      "</dl>\n";
  }
};

/**
 * Semantic grouping operator for use inside Dict instances.
 *
 * @args[
 *   @param[svals @list[
 *     @param["group name"]{
 *       Name the group!
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
  this.kids = svals.slice(1);
}
Group.prototype = {
  toHTMLString: function(options) {
    return "<dl class='group'>\n" +
      "  <dt>" + this.groupName + "</dt>\n" +
      "  <dd>" + htmlStreamify(this.kids, options) + "</dd>\n" +
      "</dl>\n";
  },
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
  this.key = svals[0];
  this.value = svals[1];
}
DictOf.prototype = {
  toHTMLString: function(options) {
    return "<dl class='dictof'>\n" +
      this.key.toHTMLString(options) +
      this.value.toHTMLString(options) +
      "</dl>";
  },
};

/**
 * Documents a specific named key in a Dict or the general key bit in a DictOf.
 */
function Key(svals, tvals, ctx) {
  this.keyName = coerceString(svals[0]);
  var idx = 1;
  if (oneOfKeywords(svals[idx], "optional", "required"))
    this.optional = (svals[idx++].keyword === "optional");
  else
    this.optional = false;
  this.typeName = coerceString(svals[idx]);

  this.textStream = decodeFlow(tvals);

  ctx.namedContextAdd("dict-all", this, this.keyName);
}
Key.prototype = {
  toHTMLString: function(options) {
    return "<dt>" + this.keyName + "</dt>\n" +
      "<dd>" + htmlStreamify(this.textStream, options) + "</dd>\n";
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
  this.type = coerceString(svals[1]);
  this.textStream = decodeFlow(tvals);
}
Value.prototype = {
  toHTMLString: function(options) {
    return "<dt>" + this.name + ": " + this.type + "</dt>\n" +
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
  /**
   * We want to see an illustrational fake list followed by a breakout of the
   *  contents of the list.  We want the fake list to be aware of the 'rest'
   *  bit.
   *
   * To support potential fancification, we push the responsibility for
   *  generating the fake list components down to our constrained set of
   *  children.
   */
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
  this.type = coerceString(svals[1]);
}
ListOf.prototype = {
  toHTMLString: function(options) {
    return "[" + this.name + ": " + this.type + "...]";
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
function OneOf(svals, tvals) {
  this.kids = svals;
}
OneOf.prototype = {
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
  this.type = coerceString(svals[0]);
  this.textStream = decodeFlow(tvals);
}
Case.prototype = {
  toHTMLString: function(options) {
    return "<dt>" + this.type + "</dt>\n" +
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
 *
 * @args[
 *   @param[svals @listof[Param]]
 * ]
 */
function Args(svals) {
  this.kids = svals;
}
Args.prototype = {
  toHTMLString: function(options) {
    return "<dl class='args'>\n" +
      htmlStreamify(this.kids, options) +
    "</dl>\n";
  },
};

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
 *     @param["default"
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
  if (sval[idx] instanceof Default)
    this.defaultValue = sval[idx++];
  else
    this.defaultValue = null;
  this.type = idx < svals.length ? coerceString(svals[idx]) : "Object";

  this.textStream = decodeFlow(tvals);
}
Param.prototype = {
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
    return "<dt>" + this.name + "</dt>\n" +
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
  this.type = coerceString(svals[1]);
  this.textStream = decodeFlow(tvals);
}
Rest.prototype = {
  listHTMLSnippet: function(options) {
    return "<span class='rest'>" + this.name + "...</span>";
  },
  toHTMLString: function(options) {
    return "<dt>" + this.name + "... " + this.type + "</dt>\n" +
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
  this.type = coerceString(svals[0]);
  this.textStream = decodeFlow(tvals);
}
Retval.prototype = {
  toHTMLString: function(options) {
    return "<b>Returns:</b> " + this.type + " " +
      htmlStreamify(this.textStream, options);
  },
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
function LocalXRef() {

}
LocalXRef.prototype = {

};

/**
 * Package global cross-reference; the term is assumed to start from the
 *  package's documentation global namespace.
 */
function PackageXRef() {

}
PackageXRef.prototype = {

};

exports.narscribblusExecFuncs = {
  typedef: function(name, svals, tvals, ctx) {
    return new Typedef(svals, tvals, ctx);
  },
  dict: function(name, svals, tvals, ctx) {
    return new Dict(svals, tvals, ctx);
  },
  group: function(name, svals, tvals, ctx) {
    return new Group(svals, tvals, ctx);
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
  case: function(name, svals, tvals, ctx) {
    return new Case(svals, tvals, ctx);
  },
  args: function(name, svals, tvals, ctx) {
    return new Args(svals, tvals, ctx);
  },
  param: function(name, svals, tvals, ctx) {
    return new Param(svals, tvals, ctx);
  },
  default: function(name, svals, tvals, ctx) {
    return new Default(svals, tvals, ctx);
  },
  rest: function(name, svals, tvals, ctx) {
    return new Rest(svals, tvals, ctx);
  },
  return: function(name, svals, tvals, ctx) {
    return new Retval(svals, tvals, ctx);
  },

  lxref: function(name, svals, tvals, ctx) {
    return new LocalXRef(svals, tvals, ctx);
  },
};

exports.narscribblusPreExecFuncs = {
  dict: function(name, ctx) {
    ctx.pushNamedContext("dict-all", false);
  }
};