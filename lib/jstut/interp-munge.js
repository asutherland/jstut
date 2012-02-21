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
 * Munge the information generated by the abstract interpreter into the
 *  docfusion unified representation.
 *
 * Symbols always track the point of definition.
 *
 * Names are tricky, we have a few varieties:
 * @itemize[
 *   @item{Accessible name via object initializer.}
 *   @item{Accessible name via assignment.}
 *   @item{Accessible name via function declaration syntax.}
 *   @item{Function names.}
 * ]
 *
 * The good news is that idioms that assign to prototype that don't involve
 *  mix-ins are pretty straightforward; the value being named is initially
 *  assigned to its proper name or equivalent embeded via object initializer.
 *  Helper OO functions / mix-ins can be more troublesome but tractable.  If
 *  the abstract interpreter can learn to not fear __proto__ we may also be
 *  good for explicit inheritance via prototype chain there.  Lexical/this
 *  OO may just be out of reach.
 *
 * In any event, if we track the 'names' a value is assigned to, we can probably
 *  figure out what is interesting after the fact.
 **/

define("jstut/interp-munge",
  [
    "jstut/render/html",
    "jstut/typerep",
    "jstut/typeref",
    "jstut/mcstreamy",
    "jstut/protocols",
    "jstut/langbits/jslang-global-refs",
    "exports"
  ],
  function(
    html,
    $typerep,
    $typeref,
    $docstreams,
    $protocols,
    $jslang_types,
    exports
  ) {

var htmlEscapeText = html.htmlEscapeText;
var LifeStory = $typerep.LifeStory;

/**
 * Munging recursively traverses interp nodes, creating typerep instances when
 *  they do not already exist.  The exception is pre-existing Namespace nodes;
 *  we don't attempt to traverse them since they should be read-only constructs
 *  we have already traversed.
 *
 * @args[
 *   @param[interpNode]
 *   @param[modInfo]
 *   @param[attrName]
 *   @param[ownerStack @listof[Typish]]
 *   @param[doNotNoteOwner #:optional Boolean]{
 *     Used to allow munging in autocompletion that avoids accumulating
 *     useless usage information.
 *   }
 * ]
 * @return[@dict[
 *   @key[sym Typish]
 *   @key[grouping Grouping]
 * ]]
 */
function munge(interpNode, modInfo, attrName, ownerStack, doNotNoteOwner) {
  var owner = ownerStack[ownerStack.length - 1];
  // we're at the top level if the only owner is the namespace
  var topLevel = ownerStack.length == 1;

  var key, sym;

  // if the underlying node was already munged into a symbol, use it.
  if ("node" in interpNode &&
      ("symbol" in interpNode.node) &&
      !doNotNoteOwner) {
    sym = interpNode.node.symbol;
    sym.life.noteOwner(attrName, owner);
  }

  // check for recursion on the ownerStack...
  if (ownerStack.length > 1) {
    if (ownerStack.indexOf(owner) != ownerStack.length - 1) {
      console.error("recursion; good to know.", ownerStack);
      return {sym: sym, grouping: null};
    }
  }

  var life, grouping = null;
  if (!sym) {
    life = new LifeStory(modInfo,
                         ("node" in interpNode) ? interpNode.node.lineno : null);
    life.noteOwner(attrName, owner);

    // Try and find a docNode so we can have it on hand when creating the
    //  type.
    var docNode, docBits;
    if (interpNode.node && ("docNode" in interpNode.node))
      docNode = interpNode.node.docNode;
    // failing that, the parser node should have an interpObj on it which
    //  references the originating attribute's parse node which could then have
    //  the docNode on it...
    else if ((interpNode.node && ("interpObj" in interpNode.node)) &&
             (interpNode.node.interpObj[0] === "attrval") &&
             ("docNode" in interpNode.node.interpObj[1].attr))
      docNode = interpNode.node.interpObj[1].attr.docNode;
    else
      docNode = null;

    switch (interpNode.type) {
      case "function":
        // if it has anything in its prototype we call it a class...
        var hasProtoStuff = ("explicitProto" in interpNode);
        for (key in interpNode.proto.data) {
          hasProtoStuff = true;
          break;
        }
        var funcSym;
        if (hasProtoStuff) {
          sym = new $typerep.ClassType(interpNode.node.name);
          funcSym = sym.constructor =
            new $typerep.Constructor(sym.name, sym.name, life);
          // try and pull the definition point of the prototype out of its
          //  object initializer if we can.
          var protoLife = life;
          // XXX no guarantee the object actually came from modInfo's module
          if (("node" in interpNode.proto) && interpNode.proto.node)
            protoLife = new LifeStory(modInfo, interpNode.proto.node.lineno);
          sym.proto = new $typerep.ObjectType(sym.name, protoLife);
        }
        // otherwise it's a straight-up function or method
        // (we could do this peeking or something clever, but let's just punt
        //  for now and figure if we are being evaluated in the context of a
        //  something that's naming us that we are a method...)
        else if (!topLevel) {
          funcSym = sym =
            new $typerep.Method(attrName, interpNode.node.name, life);
        }
        else {
          funcSym = sym =
            new $typerep.FuncInstance(attrName, interpNode.node.name, life);
        }

        if (docNode) {
          docBits = $docstreams.snipeAndFilterTextStream(
                                  docNode.rawStream,
                                  $typerep.ArgList,
                                  $typerep.RetValDescriptor,
                                  $typerep.ThisDescriptor);
          sym.docStream = modInfo.formatTextStream(docBits[0]);
          funcSym.argList = docBits[1];
          // We know the argument names,so let's provide sane-ish defaults
          //  of assuming they are all objects so at least the names are there.
          if (!funcSym.argList)
            funcSym.argList = makeFailoverArgList(interpNode.node);
          // (don't assign a retDesc to a Class)
          if (sym === funcSym) {
            sym.retDesc = docBits[2];
            if (!sym.retDesc)
              sym.retDesc = makeFailoverRetval();
          }
          // (This can make sense in the method case too, since sometimes we
          //  may assume something is a method when it is just a function
          //  hanging off the prototype for ease of access.)
          sym.thisDesc = docBits[3];

          grouping = docNode.grouping;
        }
        break;

      case "object":
        // if the object is marked as a protocol => protocol
        if (docNode && docNode.hasTag($protocols.Protocol)) {
          docBits = $docstreams.snipeAndFilterTextStream(
                                  docNode.rawStream,
                                  $protocols.Protocol);
          sym = docBits[1];
          sym.docStream = modInfo.formatTextStream(docBits[0]);
        }
        else {
          sym = new $typerep.GenericObj(attrName, life);
        }
        if (docNode)
          sym.docStream = modInfo.formatTextStream(docNode.rawStream);
        break;

      case "number":
      case "string":
      case "regexp":
      case "boolean":
      case "null":
      case "unresolved":
      case "undefined":
        sym = new $typerep.NamedValue(attrName,
                                      interpNode.data, interpNode.type,
                                      life);
        if (docNode) {
          sym.docStream = modInfo.formatTextStream(docNode.rawStream);
          grouping = docNode.grouping;
        }
        break;

      // the contents don't matter, just note that it's an array
      case "list":
        sym = new $typerep.NamedValue(attrName, [], "Array", life);
        if (docNode) {
          sym.docStream = modInfo.formatTextStream(docNode.rawStream);
          grouping = docNode.grouping;
        }
        break;

      case "activation":
        // we cannot/do not process activation records.
        return {sym: null, grouping: null};

      default:
        throw new Error("unsupported munge type: " + interpNode.type);
    }
    if ("node" in interpNode)
      interpNode.node.symbol = sym;
  }

  // XXX we used to do docNode processing here.  I am assuming this was not
  //  because docNodes would show up later in life, but simply an unintentional
  //  control flow artifact that never posed a problem because the docNode
  //  check would only try and do stuff if docNodes were not already assigned.
  //  Remove this comment when it turns out this comment is proved right or
  //  wrong.

  if (sym.kind in mungersByKind) {
    mungersByKind[sym.kind](sym, interpNode, modInfo, ownerStack);
  }

  return {sym: sym, grouping: grouping};
}
exports.munge = munge;

/**
 * Map the typerep's "kind" to the appropriate munging function.  The last
 *  implementation (Symish) put the munge methods on the class, but that was
 *  prior to unification with non-munging representations.
 */
var mungersByKind = {
  // we are treating objects the same as dicts for now.
  "dict": function(sym, interpNode, modInfo, ownerStack) {
    var odata = interpNode.data, key, kidInfo;
    var meStack = ownerStack.concat([sym]);
    for (key in odata) {
      kidInfo = munge(odata[key], modInfo, key, meStack);
      if (kidInfo)
        groupyLogic(sym, key, kidInfo);
    }

    if ("accessors" in interpNode)
      accessorLogic(sym, interpNode.accessors, modInfo);
  },

  "class": function(sym, interpNode, modInfo, ownerStack) {
    var sdata = interpNode.data, pdata = interpNode.proto.data;
    var meStack = ownerStack.concat([sym]);

    var key, kidInfo;

    // - static
    for (key in sdata) {
      kidInfo = munge(sdata[key], modInfo, key, meStack);
      if (kidInfo)
        groupyLogic(sym.constructor, key, kidInfo);
    }

    // - instance
    for (key in pdata) {
      kidInfo = munge(pdata[key], modInfo, key, meStack);
      if (kidInfo)
        groupyLogic(sym.proto, key, kidInfo);
    }

    if ("accessors" in interpNode.proto)
      accessorLogic(sym.proto, interpNode.proto.accessors, modInfo);
  },

  "method": function(sym, interpNode, modInfo, ownerStack) {
    // XXX people could decorate crap onto our function
  },

};

/**
 * @args[
 *   @param[funcDef FunctionDefinition]
 * ]
 */
function makeFailoverArgList(funcDef) {
  var argDescs = [];

  var objRef = $jslang_types.globals.Object;

  // params is an array of strings, aka the parameter names
  for (var i = 0; i < funcDef.params.length; i++) {
    var argDesc = new $typerep.ArgDescriptor(funcDef.params[i], objRef,
                                             null, []);
    argDescs.push(argDesc);
  }
  return new $typerep.ArgList(argDescs);
}

function makeFailoverRetval() {
  return new $typerep.RetValDescriptor($jslang_types.globals.Object, []);
}

function mungeNamespace(name, interpDict, modInfo) {
  var life = new LifeStory(modInfo, 0);
  life.noteOwner(name, modInfo);
  var ns = new $typerep.Namespace(modInfo.name + ":" + name, life);

  var ownerStack = [ns];
  for (var key in interpDict) {
    var munged = munge(interpDict[key], modInfo, key, ownerStack);
    if (munged)
      ns.childrenByName[key] = munged.sym;
  }
  return ns;
}
exports.mungeNamespace = mungeNamespace;

function htmlifyDictSortingKeys(o, options) {
  var bits = [];
  var keys = [], key;
  for (key in o) {
    keys.push(key);
  }
  bits.push("<dl class='group'>\n");
  for (var i = 0; i < keys.length; i++) {
    key = keys[i];
    var sym = o[key];
    bits.push("  <dt>" + htmlEscapeText(key) + "</dt>\n");
    bits.push("  <dd>" + sym.toHTMLString(options) + "</dd>\n");
  }
  bits.push("</dl>\n");
  return bits.join("");
}

function htmlifyKidsUsingGroups(container, options) {
  var s = htmlifyDictSortingKeys(container.ungroupedChildrenByName, options);
  for (var groupName in container.groups) {
    var group = container.groups[groupName];
    s += "<span class='groupName'>" + group.grouping.name + "</span>\n";
    s += htmlifyDictSortingKeys(group.childrenByName, options);
  }
  return s;
}

/**
 * Common logic for Class/Object symbols to perform grouping. refactoringsmell.
 */
function groupyLogic(container, key, kidInfo) {
  var sym = kidInfo.sym, grouping = kidInfo.grouping;

  // nop if the child was already known to us
  if (key in container.childrenByName)
    return;
  container.childrenByName[key] = sym;
  container.childCount++;

  // the docNode should already be hooked up; see if it belongs to a group
  if (grouping) {
    var group;
    if (grouping.name in container.groups) {
      group = container.groups[grouping.name];
    }
    else {
      group = container.groups[grouping.name] =
        new $typerep.Group(grouping, grouping.docNode.formattedStream);
      container.groupCount++;
    }
    group.childrenByName[key] = sym;
    group.childCount++;
  }
  else {
    container.ungroupedChildrenByName[key] = sym;
  }
}

/**
 * Helper logic to transform accessors; they don't get `InterpNode` instances
 *  so munging is not really appropriate.  Might be worth rethinking that.
 */
function accessorLogic(container, accessors, modInfo) {

  function accessorMunge(parseNode) {
    var life = new LifeStory(modInfo, parseNode.lineno);
    life.noteOwner(key, container);
    var sym = new $typerep.FuncInstance(key, key, life);
    if ("docNode" in parseNode)
      sym.docStream = parseNode.docNode.formattedStream;
    return sym;
  }

  var sym;
  for (var key in accessors) {
    // skip already-known getters.  because of the syntactic specialness
    //  of getters/setters (and this path is currently only for said syntax)
    //  there is no possibility for needing to track the life story across
    //  other sites.
    if (key in container.childrenByName)
      continue;

    var accNodes = accessors[key]; // [getter Node, setter Node]
    var getter = null, setter = null, propType = null;
    if (accNodes[0]) {
      getter = accessorMunge(accNodes[0]);
      if (!getter.retDesc)
        getter.retDesc = makeFailoverRetval();
      propType = getter.retDesc.type;
    }
    if (accNodes[1]) {
      setter = accessorMunge(accNodes[1]);
      if (setter.argList && setter.argList.argDescs.length &&
          setter.argList.argDescs[0])
        propType = setter.argList.argDescs[0].type;
    }
    if (!propType)
      propType = makeFailoverRetval().type;

    sym = new $typerep.PropertyDescriptor(key, propType, getter, setter);
    groupyLogic(container, key, { grouping: null, sym: sym });
  }
}

/**
 * An instantiated @xref{Grouping} that exists just so each container type can
 *  ensure that its list of children in that group does not get intertangled
 *  with other containers' caught up in the same @xref{Grouping}.
 */
function InstantiatedGroup(grouping) {
  this.grouping = grouping;
  this.childrenByName = {};
}
InstantiatedGroup.prototype = {
};

}); // end define