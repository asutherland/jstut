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

require.def("narscribblus/present/type-basics",
  [
    "wmsy/wmsy",
  ],
  function(
    $wmsy
  ) {

var wy = new $wmsy.WmsyDomain({id: "type-basic",
                               domain: "jstut",
                               clickToFocus: true});

////////////////////////////////////////////////////////////////////////////////
// Styling Base

// Currently putting the style inline to eliminate additional asynchrony,
//  but we need to be able to deal with that.
wy.defineStyleBase("types", [
  ".presentContainer {",
  "  margin-bottom: 2em;",
  "}",
  ".typeTitle {",
  "  display: block;",
  "  padding: 0.1em 0.3em;",
  "  border-radius: 0.2em;",
  "  font-family: sans-serif;",
  "  font-size: 200%;",
  "  background-color: #729fcf;",
  "}",
  ".heading {",
  "  display: block;",
  "  border-radius: 4px;",
  "  padding: 4px;",
  "  margin-top: 1em;",
  "  margin-bottom: 2px;",
  "  background-color: #dddddd;",
  "  font-weight: bold;",
  "  font-family: sans-serif;",
  "}",
  ".flowHeading {",
  "  font-weight: bold;",
  "}",
  ".descriptorName {",
  "  display: inline-block;",
  "  width: 16em;",
  "  color: #204a87;",
  "  font-family: sans-serif;",
  "}",
  ".expandableBlock {",
  "  background-color: #e4ecf5;",
  "  border-bottom: 1px solid #3465a4;",
  "  padding: 0.2em 0em;",
  "}",
]);

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
  name: "stream-cite-wild",
  doc: "Generic type citation.",
  constraint: {
    type: "stream",
    obj: {kind: wy.WILD},
  },
  structure: wy.bind("name"),
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
  style: {
    root: {
      "[optional=true]": [
        "font-style: italic;",
      ],
    }
  },
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
  name: "dict-signature",
  doc: "Dictionary signature, group aware.",
  constraint: {
    type: "type",
    detail: "signature",
    obj: {kind: "dict"},
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
  style: {
    openSquiggle: "display: block;",
    ungrouped: [
      "margin-left: 1em;",
    ],
    grouped: [
      "margin-left: 1em;",
    ],
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
  style: {
    name: ".flowHeading;",
  },
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
  name: "namespace-roster",
  doc: "Dump the entire contents of a namespace.",
  constraint: {
    type: "type",
    detail: "expanded",
    obj: {kind: "namespace"},
  },
  structure: {
    contents: wy.vertList({type: "type", detail: "expanded"},
                          wy.dictAsList("childrenByName")),
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
  structure: {
    // function signature in brief
    signature: wy.widget({type: "type", detail: "signature"}, wy.SELF),

    // description
    description: wy.stream({type: "type", detail: "cite"}, "docStream"),

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
  structure: {
    signature: wy.widget({type: "type", detail: "signature"}, wy.SELF),

    description: wy.stream({type: "type", detail: "cite"}, "docStream"),

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
  structure: {
    name: wy.bind("name"),
    entries: wy.vertList({type: "descriptor", detail: "expandable"},
                         wy.dictAsList("childrenByName")),
  },
  style: {
    name: ".heading;",
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
  structure: {
    keyDesc: wy.widget({type: "descriptor", detail: "expandable"},
                       "keyDesc"),

    valueDesc: wy.widget({type: "descriptor", detail: "expandable"},
                         "valueDesc"),
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
  structure: {
    // function signature in brief
    signature: wy.widget({type: "type", detail: "signature"}, wy.SELF),

    // description
    description: wy.stream({type: "type", detail: "cite"}, "docStream"),

    // case expansion
    cases: wy.vertList({type: "descriptor", detail: "expandable"},
                       "caseDescriptors"),
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
  structure: {
    name: wy.bind("nameOrTypeName"),
    typeSignature: wy.widget({type: "type", detail: "signature"},
                             "resolvedType"),
    desc: wy.stream({type: "stream"}, "briefDocStream"),
    // not auto-bound; we set this on expansion.
    expanded: wy.widget({type: "type", detail: "expanded"}, wy.NONE),
  },
  impl: {
    postInit: function() {
      // by default, be collapsed
      this.isExpanded = false;
    },
  },
  events: {
    name: {
      command: function() {
        this.isExpanded = !this.isExpanded;
        // use the full or brief doc stream
        this.desc_set(this.isExpanded ? this.obj.docStream
                                      : this.obj.briefDocStream);

        // expand or kill information about the type
        this.expanded_set(this.isExpanded ? this.obj.resolvedType : null);
        this.name_element.setAttribute("expanded", this.isExpanded);
      }
    }
  },
  style: {
    root: {
      _: ".expandableBlock;",
    },
    name: {
      _: [
        ".descriptorName;",
        "background: url(narscribblus/data/images/section_collapsed.png) no-repeat 0% 50%;",
        "padding-left: 20px;",
      ],
     "[expanded=true]": [
        "background: url(narscribblus/data/images/section_expanded.png) no-repeat 0% 50%;",
     ],
    },
    typeSignature: "display: inline-block;",
    desc: [
      "display: block;",
      "margin-left: 2em;",
    ],
    expanded: [
      "margin-left: 3em;",
    ],
  },
});

/*
wy.defineWidget({
  name: "descriptor-expanded",
  doc: "A generic expandable descriptor in its expanded form.",
  constraint: {
    type: "descriptor",
    detail: "expandable",
    obj: {genus: wy.WILD},
    UISTATE: {expanded: true},
  },
  structure: {
    name: wy.bind("nameOrTypeName"),
    typeSignature: wy.widget({type: "type", detail: "signature"},
                             "resolvedType"),
    briefDesc: wy.stream({type: "stream"}, "briefDocStream"),
  },
  style: {
    root: [
      ".expandableBlock;",
    ],
    name: [
      ".descriptorName;",
      "background: url(narscribblus/data/images/section_collapsed.png) no-repeat 0% 50%;",
      "padding-left: 20px;",
    ],
    typeSignature: "display: inline-block;",
    briefDesc: [
      "display: block;",
      "margin-left: 2em;",
    ],
  },
});
*/

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
    name: wy.bind("name"),
    expanded: wy.widget({type: "type", detail: "expanded"}, wy.SELF),
  },
  style: {
    root: ".presentContainer;",
    name: ".typeTitle;",
  },
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
    docStream: wy.stream({type: "type", detail: "cite"}, "docStream"),
    expanded: wy.widget({type: "type", detail: "expanded"}, "resolvedType"),
  },
  style: {
    root: ".presentContainer;",
    name: ".typeTitle;",
  },
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

}); // end require.def
