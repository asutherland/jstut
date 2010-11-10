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
 *     cite (types): Provide their name with optional minor decoration and be
 *     clickable.
 *   }
 *   @item{
 *     decorated-name (descriptors): Provide the name of their slot (argument
 *     name, dictionary entry name, etc.) with a little icon to briefly convey
 *     type information without getting into a whole thing about the type.
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
  ".typeTitle {",
  "  font-size: 200%;",
  "}",
  ".heading {",
  "  border-radius: 4px;",
  "  padding: 4px;",
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
]);

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
// Descriptor names

wy.defineWidget({
  name: "arg-descriptor-name",
  doc: "Function argument descriptor name with iconic type.",
  constraint: {
    type: "descriptor",
    detail: "decorated-name",
  },
  structure: wy.flow({
    name: wy.bind("name"),
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
    args: wy.widgetFlow({type: "descriptor", detail: "decorated-name"},
                        ["argList", "argDescs"],
                        {separator: ", "}),
    closeParen: ")",
    retMarker: " => ",
    retType: wy.widget({type: "type", detail: "cite"}, "retDesc"),
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
    ungrouped: wy.widgetFlow({type: "descriptor", detail: "decorated-name"},
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
    entries: wy.widgetFlow({type: "descriptor", detail: "decorated-name"},
                           wy.dictAsList("childrenByName"),
                           {separator: ", "}),
  }),
  style: {
    name: ".flowHeading",
  },
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

    optionalThisDesc: wy.widget({type: "descriptor", detail: "expanded"}),

    // function argument expansion
    arguments: wy.vertList({type: "descriptor", detail: "expanded"},
                           ["argList", "argDescs"]),

    // function return value expansion
    retVal: wy.widget({type: "descriptor", detail: "expanded"}, "retDesc"),
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
    name: ".heading",
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
  },
  structure: {
    name: wy.bind("name"),
    typeSignature: wy.widget({type: "type", detail: "signature"},
                             "resolvedType"),
    briefDesc: wy.stream({type: "stream"}, "briefDocStream"),
  },
  style: {
    name: ".descriptorName",
    typeSignature: "display: inline-block;",
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
    name: wy.bind("name"),
    expanded: wy.widget({type: "type", detail: "expanded"}, wy.SELF),
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
    name: ".typeTitle",

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
