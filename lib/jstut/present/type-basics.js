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
 * Our general navigation and display strategy is to display something no larger
 *  than a single 'page' by default.  It should be optimized for skimming to
 *  find what you are looking for or to easily discover new things.  We favor
 *  collapsing and expanding information related to a single topic rather than
 *  using separate pages for everything.
 *
 * We have a few supported levels of detail:
 * @itemize[
 *   @item{
 *     cite (types/descriptors): Provide their name with optional minor
 *     decoration and perhaps be clickable.
 *   }
 *   @item{
 *     signature (types): Provide a shallow overview of the type.  For a
 *     function this means its name, arguments, and return value.  For a
 *     heterogeneous dictionary this means its (potentially grouped) keys, a
 *     homogeneous dictionary's key/value, a list's ordered arguments, etc.
 *   }
 *   @item{
 *     expanded: Fully expanded details on a type or descriptor.
 *   }
 *   @item{
 *     expandable: Collapsed by default, expandable to full details when
 *     commanded.
 *   }
 * ]
 *
 * Behaviour in response to clicks is context-dependent and handled via use
 * of the emit/receive/relay mechanism.  The general rule is that a full
 * type expansion should handle clicks by checking if the thing that is clicked
 * on is defined in the type expansion and can be focused and expanded.  If
 * it can't be and in the general case, a pop-up and/or hyperlinking behaviour
 * should occur.
 **/

define("jstut/present/type-basics",
  [
    "wmsy/wmsy",
    "text!./type-basics.css",
  ],
  function(
    $wmsy,
    $_css
  ) {

var wy = new $wmsy.WmsyDomain({id: "type-basic", domain: "jstut",
                               css: $_css});

////////////////////////////////////////////////////////////////////////////////
// Unusual stream behavior

wy.defineWidget({
  name: "stream-raw-docnode",
  doc: "Raw doc nodes render their sub-stream in a div; for debug purposes.",
  constraint: {
    type: "stream",
    obj: {kind: "docnode"},
  },
  structure: {
    stream: wy.stream({type: "stream"}, "formattedStream"),
  }
});


////////////////////////////////////////////////////////////////////////////////
// Stream implies Citation

wy.defineWidget({
  name: "stream-cite-null",
  doc: "XXX Just treat null objects as empty strings.",
  constraint: {
    type: "stream",
    obj: null,
  },
  structure: "",
});


wy.defineWidget({
  name: "stream-cite-wild",
  doc: "Generic type citation.",
  constraint: {
    type: "stream",
    obj: {kind: wy.WILD},
  },
  structure: wy.bind("name"),
});

wy.defineWidget({
  name: "stream-cite-constructor-this",
  doc: "The return value of a constructor, which is definitively 'this'.",
  constraint: {
    type: "stream",
    obj: {kind: "descriptor", genus: "constructor-this"},
  },
  structure: "this",
});


wy.defineWidget({
  name: "stream-cite-retval",
  doc: "Return values have no name and so only the type makes sense to cite.",
  constraint: {
    type: "stream",
    obj: {kind: "descriptor", genus: "retval"},
  },
  structure: wy.bind(["resolvedType", "name"]),
});


wy.defineWidget({
  name: "stream-cite-function",
  doc: "Citation of a function type.",
  constraint: {
    type: "stream",
    obj: {kind: "function"},
  },
  structure: wy.flow({
    name: wy.bind("name"),
    funcDecoration: "()",
  }),
});

wy.defineWidget({
  name: "stream-cite-descriptor",
  doc: "Descriptor citations with a name should use it.",
  constraint: {
    type: "stream",
    obj: {kind: "descriptor", genus: wy.WILD},
  },
  structure: wy.bind("name", {optional: "optional"}),
});

wy.defineWidget({
  name: "stream-doc-splice",
  doc: "Nested stream-ing of doc splices.",
  constraint: {
    type: "stream",
    obj: {kind: "splice"},
  },
  structure: wy.stream({type: "stream"}, "docStream"),
});

wy.defineWidget({
  name: "stream-default-desc",
  doc: "Nested stream-ing of doc splices.",
  constraint: {
    type: "stream",
    obj: {kind: "descriptor", genus: "argdefault"},
  },
  structure: [" default: ", wy.bind(["resolvedType", "formattedValue"])],
});


// not really crazy about having this widget just unbox the type...
wy.defineWidget({
  name: "stream-cite-oneof-case",
  doc: "oneof cases recursively cite using their type; they have no name",
  constraint: {
    type: "stream",
    obj: {kind: "descriptor", genus: "case"},
  },
  // we can't do a sub-widget at our root; it has to be nested
  structure: wy.flow({
    citedType: wy.widget({type: "stream"}, "resolvedType"),
  }),
});



////////////////////////////////////////////////////////////////////////////////
// Brief Type Details (Signature)

wy.defineWidget({
  name: "generic-signature",
  doc: "Catch-all signature is just the name of the type.",
  constraint: {
    type: "type",
    detail: "signature",
    obj: {kind: wy.WILD},
  },
  structure: wy.bind("name"),
});

wy.defineWidget({
  name: "function-signature",
  doc: "Function signature with argument names and their iconic types.",
  constraint: {
    type: "type",
    detail: "signature",
    obj: {kind: "function"},
  },
  structure: wy.flow({
    funcLabel: "function",
    openParen: "(",
    args: wy.widgetFlow({type: "stream"}, ["argList", "argDescs"],
                        {separator: ", "}),
    closeParen: ")",
    retMarker: " => ",
    retType: wy.widget({type: "stream"}, "retDesc"),
  }),
});

wy.defineWidget({
  name: "dict-signature-simple",
  doc: "Simple dictionary signature all on one line, no grouping.",
  constraint: {
    type: "type",
    detail: "signature",
    obj: {kind: "dict", hasGroups: false},
  },
  structure: {
    openSquiggle: "{",
    ungrouped: wy.widgetFlow({type: "stream"},
                             wy.dictAsList("childrenByName"),
                             {separator: ", "}),
    closeSquiggle: "}",
  },
});

wy.defineWidget({
  name: "dict-signature-complex",
  doc: "Dictionary signature, group aware.",
  constraint: {
    type: "type",
    detail: "signature",
    obj: {kind: "dict", hasGroups: true},
  },
  structure: {
    openSquiggle: "{",
    ungrouped: wy.widgetFlow({type: "stream"},
                             wy.dictAsList("ungroupedChildrenByName"),
                             {separator: ", "}),
    grouped: wy.vertList({type: "group", detail: "signature"},
                         wy.dictAsList("groups")),
    closeSquiggle: "}",
  },
});

wy.defineWidget({
  name: "group-signature",
  doc: "Dictionary group signature widget",
  constraint: {
    type: "group",
    detail: "signature",
  },
  structure: wy.flow({
    name: wy.bind("name"),
    nameDelim: ": ",
    entries: wy.widgetFlow({type: "stream"},
                           wy.dictAsList("childrenByName"),
                           {separator: ", "}),
  }),
});

wy.defineWidget({
  name: "dictof-signature",
  doc: "Homogeneous dictionary (dictof) signature.",
  constraint: {
    type: "type",
    detail: "signature",
    obj: {kind: "dictof"},
  },
  structure: wy.flow({
    openSquiggle: "{",
    keySignature: wy.widget({type: "stream"}, "keyDesc"),
    delimitKeyAndValue: ": ",
    valueSignature: wy.widget({type: "stream"}, "valueDesc"),
    suggestMore: ", ...",
    closeSquiggle: "}",
  }),
});

wy.defineWidget({
  name: "list-signature",
  doc: "Heterogeneous list (list) signature.",
  constraint: {
    type: "type",
    detail: "signature",
    obj: {kind: "list"},
  },
  structure: wy.flow({
    openBracket: "[",
    name: wy.widgetFlow({type: "stream"}, "kids"),
    suggestMore: ", ...",
    closeBracket: "]",
  }),
});

wy.defineWidget({
  name: "listof-signature",
  doc: "Homogeneous list (listof) signature.",
  constraint: {
    type: "type",
    detail: "signature",
    obj: {kind: "listof"},
  },
  structure: wy.flow({
    openBracket: "[",
    name: wy.bind("name"),
    typeDelim: ": ",
    type: wy.bind(["type", "name"]),
    suggestMore: ", ...",
    closeBracket: "]",
  }),
});


wy.defineWidget({
  name: "oneof-signature",
  doc: "Oneof signature; looks like: a | b | c | ...",
  constraint: {
    type: "type",
    detail: "signature",
    obj: {kind: "oneof"},
  },
  structure: wy.flow({
    // we just want to cite the types like in a stream
    cases: wy.widgetFlow({type: "stream"}, "caseDescriptors",
                         {separator: " | "}),
  }),
});


////////////////////////////////////////////////////////////////////////////////
// Detailed Type Expansions

wy.defineWidget({
  name: "unresolved-typeref",
  doc: "We can't expand a typeref that we can't resolve :(",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "unresolved"},
  },
  structure: {
  },
});

wy.defineWidget({
  name: "named-value-expanded",
  doc: "NamedValue details",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "value"},
  },
  structure: {
    value: wy.bind("formattedValue"),
  },
});

wy.defineWidget({
  name: "namespace-roster",
  doc: "Brief summaries of the contents of a namespace.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "namespace"},
  },
  focus: wy.focus.container.vertical("contents"),
  structure: {
    contents: wy.vertList({type: "descriptor", detail: "expandable"},
                          wy.dictAsList("childrenByName")),
  },
});

wy.defineWidget({
  name: "class-expanded",
  doc: "Full expansion of a class.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "class"},
  },
  focus: wy.focus.container.vertical("constructor", "description",
                                     "arguments", "ungrouped", "groups"),
  structure: {
    // constructor signature in brief
    constructor: wy.widget({type: "type", detail: "signature"}, "constructor"),

    // the description is on the class proper
    description: wy.stream({type: "stream"}, "docStream"),

    constructorLabel: "Constructor:",

    // constructor argument expansion
    arguments: wy.vertList({type: "descriptor", detail: "expandable"},
                           ["constructor", "argList", "argDescs"]),

    prototypeLabel: "Prototype:",

    // - prototype
    ungrouped: wy.vertList({type: "descriptor", detail: "expandable"},
                           wy.dictAsList(["proto", "ungroupedChildrenByName"])),
    groups: wy.vertList({type: "group", detail: "expanded"},
                        wy.dictAsList(["proto", "groups"])),
  },
});

wy.defineWidget({
  name: "function-expanded",
  doc: "Full expansion of a function type.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "function"},
  },
  focus: wy.focus.container.vertical("signature", "description",
                                     "optionalThisDesc", "arguments", "retVal"),
  structure: {
    // function signature in brief
    signature: wy.widget({type: "type", detail: "signature"}, wy.SELF),

    // description
    description: wy.stream({type: "stream"}, "docStream"),

    optionalThisDesc: wy.widget({type: "descriptor", detail: "expandable"}),

    // function argument expansion
    arguments: wy.vertList({type: "descriptor", detail: "expandable"},
                           ["argList", "argDescs"]),

    // function return value expansion
    retVal: wy.widget({type: "descriptor", detail: "expandable"}, "retDesc"),
  },
});

wy.defineWidget({
  name: "grouped-dict-details",
  doc: "Group-aware detailed contents of a dictionary.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "dict"},
  },
  focus: wy.focus.container.vertical("signature", "description",
                                     "ungrouped", "groups"),
  structure: {
    signature: wy.widget({type: "type", detail: "signature"}, wy.SELF),

    description: wy.stream({type: "stream"}, "docStream"),

    ungrouped: wy.vertList({type: "descriptor", detail: "expandable"},
                           wy.dictAsList("ungroupedChildrenByName")),
    groups: wy.vertList({type: "group", detail: "expanded"},
                        wy.dictAsList("groups")),
  },
});

wy.defineWidget({
  name: "group-expanded",
  doc: "A group",
  constraint: {
    type: "group",
    detail: "expanded",
  },
  focus: wy.focus.container.vertical("topicLinks", "description", "entries"),
  structure: {
    header: wy.flow({
      name: wy.bind("name"),
      topicLinks: wy.widgetFlow({type: "stream"}, "topicLinks"),
    }),
    description: wy.stream({type: "stream"}, "docStream"),
    entries: wy.vertList({type: "descriptor", detail: "expandable"},
                         wy.dictAsList("childrenByName")),
  },
});

wy.defineWidget({
  name: "dictof-expanded",
  doc: "Homogeneous dictionary expansion.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "dictof"},
  },
  focus: wy.focus.container.vertical("keyDesc", "valueDesc"),
  structure: {
    keyDesc: wy.widget({type: "descriptor", detail: "expandable"},
                       "keyDesc"),

    valueDesc: wy.widget({type: "descriptor", detail: "expandable"},
                         "valueDesc"),
  },
});

wy.defineWidget({
  name: "list-expanded",
  doc: "Full expansion of a list.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "list"},
  },
  focus: wy.focus.container.vertical("description", "cases"),
  structure: {
    // description
    description: wy.stream({type: "stream"}, "docStream"),

    // list expansion
    cases: wy.vertList({type: "descriptor", detail: "expandable"},
                       "kids"),
  },
});

wy.defineWidget({
  name: "listof-expanded",
  doc: "Full expansion of a listof.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "listof"},
  },
  focus: wy.focus.container.vertical("signature", "description", "cases"),
  structure: {
    // listof signature in brief; make it clear it's a listof!
    signature: wy.widget({type: "type", detail: "signature"}, wy.SELF),

    // description
    description: wy.stream({type: "stream"}, "docStream"),

    // type expansion
    cases: wy.widget({type: "type", detail: "expanded"}, "type"),
  },
});


wy.defineWidget({
  name: "oneof-expanded",
  doc: "Full expansion of a oneof enumeration.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "oneof"},
  },
  focus: wy.focus.container.vertical("signature", "description", "cases"),
  structure: {
    // function signature in brief
    signature: wy.widget({type: "type", detail: "signature"}, wy.SELF),

    // description
    description: wy.stream({type: "stream"}, "docStream"),

    // case expansion
    cases: wy.vertList({type: "descriptor", detail: "expandable"},
                       "caseDescriptors"),
  },
});

wy.defineWidget({
  name: "descriptor-expanded",
  doc: "An expanded descriptor for top-level display.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "descriptor"},
  },
  focus: wy.focus.container.vertical("description", "realType"),
  structure: {
    // description
    description: wy.stream({type: "stream"}, "docStream"),

    // actual type expansion
    realType: wy.widget({type: "type", detail: "expanded"}, "resolvedType"),
  },
});


////////////////////////////////////////////////////////////////////////////////
// Expandable Descriptors

wy.defineWidget({
  name: "descriptor-expandable",
  doc: "A generic expandable descriptor",
  constraint: {
    type: "descriptor",
    detail: "expandable",
    obj: {genus: wy.WILD},
  },
  focus: wy.focus.nestedItem.vertical("expanded"),
  emit: ["resizePopup"],
  structure: {
    nameAndTypeRow: {
      name: wy.bind("nameOrTypeName"),
      typeAndDefault: wy.flow({ // (we want these in the same table cell)
        typeSignature: wy.widget({type: "type", detail: "signature"},
                                 "resolvedType"),
        defaultValue: wy.widget({type: "stream"},
                                "defaultValue"),
      }),
    },
    desc: wy.stream({type: "stream"}, "briefDocStream"),
    // not auto-bound; we set this on expansion.
    expanded: wy.widget({type: "type", detail: "expanded"}, wy.NONE),
  },
  impl: {
    postInit: function() {
      // check if we are fully expanded even already collapsed:
      if (this.obj.resolvedType.isBoring &&
          this.obj.briefStreamIsFullStream) {
        this.name_element.setAttribute("full", "true");
        this.isExpanded = null;
      }
      // otherwise, by default, be collapsed
      else {
        this.isExpanded = false;
        this.nameAndTypeRow_element.setAttribute("expandable", "true");
      }
    },
    toggle: function() {
      // nothing to do if we're fully expanded when collapsed
      if (this.isExpanded == null)
        return;
      this.isExpanded = !this.isExpanded;
      // use the full or brief doc stream
      this.desc_set(this.isExpanded ? this.obj.docStream
                                    : this.obj.briefDocStream);

      // expand or kill information about the type
      this.expanded_set(this.isExpanded ? this.obj.resolvedType : null);
      this.name_element.setAttribute("expanded", this.isExpanded);

      this.emit_resizePopup();
      this.FOCUS.bindingResized(this);
    }
  },
  events: {
    root: {
      enter_key: function() {
        this.toggle();
      },
    },
    nameAndTypeRow: {
      click: function() {
        this.toggle();
      }
    }
  },
});


////////////////////////////////////////////////////////////////////////////////
// Root Presentations
//
// (The widgets that bring us into a proper documentation view.)

wy.defineWidget({
  name: "present-type",
  doc: "Show what we're assuming is a named type.",
  constraint: {
    type: "present",
  },
  structure: {
    header: wy.flow({
      name: wy.bind("name"),
      kind: [" ", wy.bind(["resolvedType", "kind"])],
    }),
    expanded: wy.widget({type: "type", detail: "expanded"}, wy.SELF),
  },
  focus: wy.focus.container.vertical("expanded"),
});

wy.defineWidget({
  name: "present-typedef",
  doc: "Show a typedef",
  constraint: {
    type: "present",
    obj: {genus: "typedef"},
  },
  structure: {
    name: wy.bind("name"),
    docStream: wy.stream({type: "stream"}, "docStream"),
    expanded: wy.widget({type: "type", detail: "expanded"}, "resolvedType"),
  },
  focus: wy.focus.container.vertical("expanded"),
});


////////////////////////////////////////////////////////////////////////////////

/*
wy.defineWidget({
  name: "",
  doc: "",
  constraint: {
  },
  structure: {
  },
});
*/

}); // end define
