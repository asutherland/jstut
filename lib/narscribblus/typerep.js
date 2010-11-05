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
 * Unified type representation scheme for the two big produces of types:
 * @itemize[
 *   @item{
 *     Explicit document parsing, including documentation blocks found inside
 *     of source code.
 *   }
 *   @item{
 *     Abstract intepretation munging.  We traverse the object model and
 *     produce types.  This can act in concert with source documentation
 *     blocks.
 *   }
 * ]
 *
 *
 * @typedef["RawDocStream" @listof[HtmlNode]]{
 *   A raw docstream for an object provides the documentation stream as-parsed
 *   with structured nodes left in the places they were defined.  This is in
 *   contrast to a (description) docstream where certain node types (ex: args,
 *   return value, 'this' context) are removed from the stream because the
 *   responsibility for rendering those bits is given to the rest of the
 *   Typish hierarchy.
 * }
 *
 * @typedef["DocStream"] @listof[HtmlNode]]{
 *   A list of nodes that can be converted to html output where it is
 *   assumed that any structured/content-bearing tags that the owner of the
 *   DocStream cares about (and will render via other means) have been removed
 *   from the DocStream.  Compare with @xref{RawDocStream} where those nodes
 *   have been left in.
 * }
 *
 * @protocol["DocDescriptor" Object]{
 *   A doc descriptor binds a usage of a type to documentation for that usage.
 *   For example, the documentation of a specific argument in a function's call
 *   list is a DocDescriptor.  Likewise, the return value of a function/method
 *   uses a DocDescriptor to bind the description to the type.
 *
 *   It is common for a DocDescriptor to also hold specific data about the
 *   'slot' that it defines.  For example, an function argument description also
 *   captures whether the argument is optional/required and what the default
 *   value, if any, might be.
 * }
 *
 * @protocol["Traversable" @dict[
 *   @key[traverseArg @function[
 *     @args[
 *     ]
 *   ]]
 *   @key[traverseChild @function[
 *     @args[
 *       @param[name]
 *       @param[staticOrInstance #:optional @oneof["constructor" "instance"]]{
 *         Tells us whether the request is being made against the constructor or
 *         an instance of the type, if known.  Omit/pass undefined if you don't
 *         know and want us to check both places.
 *       }
 *     ]
 *   ]]
 * ]]
 *
 **/

require.def("narscribblus/typerep",
  [
    "exports",
    "narscribblus/render/typeout",
  ],
  function(
    exports,
    $typeout
  ) {

/**
 * @protocol
 *
 *
 */
var Typish = {
};

/**
 * An overkill location/usage marker whose rules are fused because this stuff
 *  is not particularly straightforward in JS.  Its knows/should know:
 * @itemize[
 *   @item{The point of definition for the thing.  Module name, line number.}
 *   @item{All owners...}
 * ]
 *
 * Everything is namespaced in terms of CommonJS modules.  Although the
 *  docfusion mechanism attempts to create conceptual namespaces, they are not
 *  known to us.
 */
function LifeStory(modInfo, line) {
  this.originModule = modInfo;
  this.originLine = line;
  this.originName = null;
  this.originOwner = null;
  /**
   * @listof[@list[
   *   @param["name" String]{
   *     Our name within the context of our owner.}
   *   @param["owner"]{
   *     The Sym-ish owner of us for whom we were a named child with the
   *     given name.
   *   }
   * ]]
   */
  this.owners = [];
}
LifeStory.prototype = {
  noteOwner: function(name, owner) {
    if (this.originName === null) {
      this.originName = name;
      this.originOwner = owner;
    }
    this.owners.push([name, owner]);
  },
};
exports.LifeStory = LifeStory;

/**
 * A function protocol.  Characterized by arguments, return value, and the
 *  'this' used during its execution.
 */
function FuncType(name, debugName, life) {
  this.name = name;
  this.debugName = debugName;
  this.life = life;

  this.argList = null;
  this.thisDesc = null;
  this.retDesc = null;

  this.docStream = null;
  this.rawDocStream = null;
}
FuncType.prototype = {
  kind: "function",
  isType: true,
  isSingleton: false,
  autoNew: false,

  toObjRep: function() {
    var o = {
      name: this.name,
      debugName: this.debugName,
      kind: this.kind,
      args: null,
      ret: null,
    };
    if (this.argList) {
      o.args = this.argList.toObjRep();
    }
    if (this.retDesc) {
      o.ret = this.retDesc.toObjRep();
    }
    return o;
  },
};
exports.FuncType = FuncType;

/**
 * A specific function; can be thought of as a singleton type.
 */
function FuncInstance(/* superclass handles: name, debugName, life */) {
  FuncType.apply(this, arguments);
}
FuncInstance.prototype = {
  __proto__: FuncType.prototype,
  isSingleton: true,
};
exports.FuncInstance = FuncInstance;

/**
 * A specific function that is part of a class and operates using the `this`
 *  of the class.
 */
function Method(/* superclass handles: name, debugName, life */) {
  FuncType.apply(this, arguments);
}
Method.prototype = {
  __proto__: FuncType.prototype,
  isSingleton: true,
  isType: false,
};
exports.Method = Method;

function Constructor() {
  FuncType.apply(this, arguments);
}
Constructor.prototype = {
  __proto__: FuncType.prototype,
  autoNew: false,
};
exports.Constructor = Constructor;

/**
 * Describes the default value for an argument.  We would expect that the type
 *  is either a singleton/type refinement or that we have a good description
 *  in the docstream.
 */
function ArgDefaultDescriptor(type, docStream) {
  this.type = type;
  this.docStream = docStream;
}
ArgDefaultDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, ArgDefaultDescriptor.prototype);
exports.ArgDefaultDescriptor = ArgDefaultDescriptor;

/**
 * Argument descriptor.  Holds the type and documentation for an argument as
 *  well as whether it is optional/required and what the default might be.
 */
function ArgDescriptor(name, type, defaultDesc) {
  this.name = name;
  this.type = type;
  this.defaultDesc = defaultDesc;
}
ArgDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, ArgDescriptor.prototype);
exports.ArgDescriptor = ArgDescriptor;

/**
 * A positional argument descriptor where the argument can occur a variable
 *  number of times.  Contrast with `ArgDescriptor` where the argument must
 *  occur exactly once.  Note that an optional argument is still an
 *  ArgDescriptor because our default semantics are that optional arguments
 *  still maintain their position, it is just left as undefined or never
 *  specified.
 */
function VarArgDescriptor(name, type, minCount, maxCount, docStream) {
  this.name = name;
  this.type = type;
  this.minCount = minCount;
  this.maxCount = maxCount;
  this.docStream = docStream;
}
VarArgDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, VarArgDescriptor.prototype);
exports.VarArgDescriptor = VarArgDescriptor;

/**
 * Holds a list of ArgDescriptors/VarArgDescriptors.  This gets to be its own
 *  object so that we can have normalized handling of variable arguments and
 *  ideally reuse that logic in similar cases (lists in data structures, etc.).
 */
function ArgList(argDescs) {
  this.argDescs = argDescs;
}
ArgList.prototype = {
  traverseArg: function(index) {
    // If it's a numeric index, just try and directly index.
    // XXX optional arguments should really come into play
    if ((typeof(index) === "number") && index < this.argTypes.length) {
      return this.argTypes[index];
    }

    // If it's a string, try and find an argument by that name.
    if (typeof(index) === "string") {
      for (var i = 0; i < this.argTypes.length; i++) {
        var arg = this.argTypes[i];
        if (arg.name === index)
          return arg;
      }
    }

    return null;
  },

  toObjRep: function() {
  },
};
exports.ArgList = ArgList;

/**
 * Return value descriptor.  This class mainly exists for tagging purposes;
 *  it makes it easier to fish it out of a doc block without use of a tagging
 *  wrapper class.
 */
function RetValDescriptor(type, docStream) {
  this.type = type;
  this.docStream = this.docStream;
}
RetValDescriptor.prototype = {
  name: "(return value)",
};
$typeout.mix($typeout.descriptorMixin, RetValDescriptor.prototype);
exports.RetValDescriptor = RetValDescriptor;

/**
 * Describes the 'this' context for functions.  Intended to be used in those
 *  cases where it's not what you would assume / the documentation system
 *  would infer.
 */
function ThisDescriptor(type, docStream) {
  this.type = type;
  this.docStream = this.docStream;
}
ThisDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, ThisDescriptor.prototype);
exports.ThisDescriptor = ThisDescriptor;

/**
 * Groups are an optional way of looking at container types.  Each type exposes
 *  all of its children in `childrenByName`.  Each child may also belong to
 *  a (mutually exclusive) group or no group.  Grouped children are found in the
 *  `childrenByName` attribute of the groups in the `groups` attribute.
 *  Ungrouped children are found in the `ungroupedChildrenByName` dictionary.
 *
 * Groups are characterized by a name and a docStream.  They may potentially
 *  have other meta-data hung off of them in the future.
 */
function Group(name, docStream) {
  this.name = name;
  this.docStream = docStream;

  this.childrenByName = {};
}
Group.prototype = {
};
exports.Group = Group;

/**
 * A class is a composite of a constructor (which can have static attributes),
 *  a prototype, and an instance type (which references the prototype but may
 *  introduce new attributes that are not explicitly on the prototype.)
 */
function ClassType(name) {
  this.name = name;

  /// @param[Constructor]
  this.constructor = null;
  /// @param[ObjectType]
  this.prototype = null;
}
ClassType.prototype = {
  kind: "class",
  isType: true,

  /**
   * Since we are an aggregation, our life is that of our constructor.
   */
  get life() {
    return this.constructor && this.constructor.life;
  },

  traverseArg: function() {
    if (this.constructor)
      return this.constructor.traverseArg.apply(this.constructor, arguments);
    return null;
  },

  traverseChild: function(name, constructorOrInstance) {
    var result;

    // check the instance first
    if (constructorOrInstance !== "constructor" && this.prototype) {
      result = this.prototype.traverseChild(name);
      if (result)
        return result;
    }

    // check the constructor second
    if (constructorOrInstance !== "instance" && this.constructor) {
      result = this.constructor.traverseChild(name);
      if (result)
        return result;
    }

    // couldn't find it! so sad!
    return null;
  },

  toString: function() {
    return "[ClassType " + this.name + "]";
  },
  toObjRep: function() {
    return {
      name: this.name,
      kind: this.kind,
      constructor: null,
      prototype: null,
    };
  },
};
exports.ClassType = ClassType;

/**
 * An instantiated class.
 */
function ClassInstance(classType) {
}
ClassInstance.prototype = {
  kind: "instance",
  // it has a type though... semantics for isType are perhaps too fuzzy...
  isType: false,
};
exports.ClassInstance = ClassInstance;

/**
 * Abstract implementation of an object, used by other things but should not
 *  be directly used otherwise.  This is supposed to generally capture the
 *  idea of a typed object which is such a generic concept that more specific
 *  types should always instead be used.  Alternatively, this might want to
 *  just be refactored out of existence.
 *
 * XXX I think my point was that this should only be used internally in this
 *  file, which is why I am creating GenericObj for public exposure.  This
 *  class/comment block will need to be revisited once I've tightened a few
 *  more constraints.
 */
function ObjectType(name, life) {
  this.name = name;
  this.life = life;

  this.childrenByName = {};

  this.groups = {};
  this.ungroupedChildrenByName = {};
}
ObjectType.prototype = {
  kind: "object",
  isType: true,
};

/**
 * An object for which we can attribute no higher purpose.
 */
function GenericObj() {
  ObjectType.apply(this, arguments);
}
GenericObj.prototype = {
  kind: "object",
};
exports.GenericObj = GenericObj;

/**
 * An object serving as a singleton class.
 */
function ObjectSingleton() {
  ObjectType.apply(this, arguments);
}
ObjectSingleton.prototype = {
  kind: "object",
};
exports.ObjectSingleton = ObjectSingleton;

/**
 * Describes a read/write attribute on an object.
 */
function FieldDescriptor(name, life) {
  this.name = name;
  this.life = life;
}
FieldDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, FieldDescriptor.prototype);
exports.FieldDescriptor = FieldDescriptor;

/**
 * Describes an attribute on an object that is implemented using a getter and/or
 *  setter.
 */
function PropertyDescriptor() {
}
PropertyDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, PropertyDescriptor.prototype);
exports.PropertyDescriptor = PropertyDescriptor;

/**
 * Type disjunction; used to say that in a given spot a value can possess one
 *  of type from a given set of types.  It is presumed that the consumer of the
 *  type uses some form of inspection or explicitly documented context to tell
 *  things apart.
 */
function OneOf(cases) {
  this.caseDescriptors = cases;
}
OneOf.prototype = {
  kind: "oneof",
  isType: true,
};
exports.OneOf = OneOf;

/**
 * Describes a specific type in a OneOf instance.
 */
function CaseDescriptor(type, isDefault, docStream) {
  this.type = type;
  this.isDefault = Boolean(isDefault);
  this.docStream = docStream;
}
CaseDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, CaseDescriptor.prototype);
exports.CaseDescriptor = CaseDescriptor;

/**
 * A heterogeneous dictionary type where each attribute has its own semantics
 *  as documented by Key instances.  Keys may possibly be grouped using Group
 *  instances.
 */
function Dict() {
  this.childrenByName = {};

  this.groups = {};
  this.ungroupedChildrenByName = {};
}
Dict.prototype = {
  isType: true,

  traverseChild: function(name) {
    if (name in this.childrenByName)
      return this.childrenByName[name];
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
};
$typeout.mix($typeout.dictMixin, Dict.prototype);
exports.Dict = Dict;

/**
 * An entry in a heterogeneous dictionary.
 */
function DictEntryDescriptor(name, type, optional, defaultDesc, docStream) {
  this.name = name;
  this.type = type;
  this.optional = optional;
  this.defaultDesc = defaultDesc;
  this.docStream = docStream;
}
DictEntryDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, DictEntryDescriptor.prototype);
exports.DictEntryDescriptor = DictEntryDescriptor;

/**
 * A homogeneous dictionary type where all attributes have the same semantics
 *  and therefore where the name and value form an informative tuple.  We
 *  expect to have one Key and one Value child.
 *
 */
function DictOf(keyDesc, valueDesc) {
  this.keyDesc = keyDesc;
  this.valueDesc = valueDesc;
}
DictOf.prototype = {
  isType: true,
  traverseChild: function() {
    // XXX it would be good if we could distinguish the key from the value,
    //  but for now it's simplest to just pretend we don't have children.
    return null;
  },
};
$typeout.mix($typeout.dictOfMixin, DictOf.prototype);
exports.DictOf = DictOf;

function DictOfKeyDescriptor(name, type, docStream) {
  this.name = name;
  this.type = type;
  this.docStream = docStream;
}
DictOfKeyDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, DictOfKeyDescriptor.prototype);
exports.DictOfKeyDescriptor = DictOfKeyDescriptor;

function DictOfValueDescriptor() {
}
DictOfValueDescriptor.prototype = {
};
$typeout.mix($typeout.descriptorMixin, DictOfValueDescriptor.prototype);
exports.DictOfValueDescriptor = DictOfValueDescriptor;

/**
 * Heterogeneous list where each positional parameter has a distinct
 *  semantic purpose named by a Param or a Rest (as the last element).
 *
 */
function List(kids) {
  this.kids = kids;
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
};
$typeout.mix($typeout.listMixin, List.prototype);
exports.List = List;

/**
 * Homogeneous list where all parameters have the same semantics.
 *
 */
function ListOf(name, type, docStream) {
  this.name = name;
  this.type = type;
  this.docStream = docStream;
}
ListOf.prototype = {
  isType: true,

  traverseChild: function(index) {
    // it's a homogenous list, so it's always the same thing!
    return this.type;
  }
};
$typeout.mix($typeout.listOfMixin, ListOf.prototype);
exports.ListOf = ListOf;

/**
 * A non-Object terminal value; number, string, regex, boolean, etc.
 *
 * This is being brought into existence for interp-munge.js's use.
 */
function Value(value, type, life) {
  this.value = value;
  this.type = type;
  this.life = life;
  this.docStream = null;
}
Value.prototype = {
};
exports.Value = Value;

}); // end require.def
