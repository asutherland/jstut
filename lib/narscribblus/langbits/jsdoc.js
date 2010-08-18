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
var htmlStreamify = man.htmlStreamify;

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
 *
 * ]
 */
function DictOf(svals, tvals, ctx) {

}
DictOf.prototype = {
  toHTMLString: function(options) {

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
}
Key.prototype = {
  toHTMLString: function(options) {

  },
};

/**
 * Documents the value part in a DictOf.
 */
function Value() {

}

/**
 * Heterogeneous list where each positional parameter has a distinct
 *  semantic purpose.
 */
function List() {

}

/**
 * Homogeneous list where all parameters have the same semantics.
 */
function ListOf() {

}

/**
 * Type disjunction; used to say that in a given spot a value can possess one
 *  of type from a given set of types.  It is presumed that the consumer of the
 *  type uses some form of inspection or explicitly documented context to tell
 *  things apart.
 */
function OneOf() {

}

/**
 * Used to annotate type values with documentation inside a OneOf.
 */
function Case() {

}

/**
 * Container that defines we are documenting the argument list for a function.
 */
function Args() {

}

/**
 * Variable-argument consumer named after the lispy concept of &rest args.  This
 *  implies that all remaining elements are of the given type (which could be
 *  a typedefed type or a OneOf or something).
 */
function Rest() {

}

function Retval() {

}

exports.narscribblusExecFuncs = {
  typedef: function(name, svals, tvals, ctx) {
    return new Typedef(svals, tvals, ctx);
  },
  dict: null,
  group: null,
  dictof: null,
  key: null,
  value: null,
  list: null,
  listof: null,
  oneof: null,
  case: null,
  args: null,
  param: null,
  rest: null,
  return: null,
};

exports.narscribblusPreExecFuncs = {
  dict: function(name, ctx) {

  }
};
