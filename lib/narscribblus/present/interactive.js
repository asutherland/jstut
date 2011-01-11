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
 * Widgets for the interactive language: collapsey blocks, trace output,
 *  example code, and more.
 **/

define("narscribblus/present/interactive",
  [
    "wmsy/wmsy",
    "narscribblus-plat/skywriter-loader",
    "exports"
  ],
  function(
    $wmsy,
    $skywriterLoader,
    exports
  ) {

var wy = exports.wy = new $wmsy.WmsyDomain({id: "interactive",
                                            domain: "jstut",
                                            clickToFocus: true});

wy.defineStyleBase("general", [
  ".rounded (@color: #888888) {",
  "  border-radius: 4px;",
  "  border: 1px solid @color;",
  "  padding: 2px;",
  "  padding-right: 6px;",
  "}",
  ".headerLabel {",
  "  font-family: sans-serif;",
  "}",
  "@collapser-border: #4e9a06;",
  "@collapser-bg: #73d216;",
  "@traceout-border: #c4a000;",
  "@traceout-bg: #edd400;",
  "@darea-border: #8f5902;",
  "@darea-bg: #e9b96e;",
]);

wy.defineWidget({
  name: "page-control",
  doc: "Magic documentation control in the upper-right corner of the page.",
  constraint: {
    type: "page-control",
  },
  structure: {
  },
});

wy.defineWidget({
  name: "collapser",
  doc: "A named, collapsible container.",
  constraint: {
    type: "stream",
    obj: {kind: "collapser"},
  },
  structure: wy.block({
    header: {
      toggler: {},
      label: wy.bind("label"),
    },
    stream: wy.stream({type: "stream"}, wy.NONE),
  }, {expanded: wy.computed("getExpandedState")}),
  impl: {
    postInit: function() {
      this.expanded = !this.obj.initiallyCollapsed;
    },
    getExpandedState: function() {
      return this.expanded;
    },
    update: function() {
      this.__update();
      if (this.expanded)
        this.stream_set(this.obj.textStream);
      else
        this.stream_set(null);
    },
  },
  events: {
    header: {
      click: function() {
        this.expanded = !this.expanded;
        this.update();
      },
    },
  },
  style: {
    root: {
      _: [
        "display: inline-block;",
        ".rounded(@collapser-border);",
        "background-color: @collapser-bg;",
        "margin-right: 0.2em;",
      ],
      "[expanded=true]": {
        _: [
          "display: block;",
          "margin: 2px 0px;",
        ],
        header: { toggler: [
          "vertical-align: -20%;",
          "background: url(narscribblus/data/images/minus_sign.png) no-repeat 0% 50%;",
        ]},
      },
      "[expanded=false]": {
        header: { toggler: [
          "vertical-align: -20%;",
          "background: url(narscribblus/data/images/plus_sign.png) no-repeat 0% 50%;",
        ]},
      },
    },
    header: [
      "cursor: pointer;",
    ],
    label: ".headerLabel",
    toggler: [
      "display: inline-block;",
      "width: 16px;",
      "height: 16px;",
      "margin-right: 4px;",
    ],
  },
});

wy.defineWidget({
  name: "traceout",
  doc: "Display trace output.",
  constraint: {
    type: "stream",
    obj: {kind: "traceout"},
  },
  structure: {
    header: {
      label: wy.stream({type: "stream"}, "labelStream"),
    },
    out: {},
  },
  impl: {
    postInitUpdate: function() {
      this.obj.youAreBound(this.out_element);
    },
  },
  style: {
    root: [
      "display: block;",
      ".rounded(@traceout-border);",
      "background-color: @traceout-bg;",
    ],
    label: ".headerLabel",
    out: [
      "border-radius: 4px;",
      "background-color: #fff;",
      "padding: 4px;",
    ],
  },
});

wy.defineWidget({
  name: "autocomplete-container",
  doc: "The autocompletion container / list.",
  focus: wy.focus.domain.vertical("completions"),
  constraint: {
    type: "autocomplete-container",
  },
  structure: {
    completions: wy.vertList({type: "autocomplete"}, "completions"),
  },
  style: {
    completions: [
      "display: table;",
      "background-color: white;",
      "padding: 4px;",
    ],
  },
});

wy.defineWidget({
  name: "autocomplete-item",
  doc: "Autocompletion of a named descriptorish thing.",
  focus: wy.focus.item,
  constraint: {
    type: "autocomplete",
  },
  structure: {
    name: wy.bind("name"),
    briefDesc: wy.stream({type: "stream"}, "briefDocStream"),
  },
  style: {
    root: {
      _: [
        "display: table-row;",
        "border: 1px solid transparent;",
      ],
      ":focused": [
        "background-color: lightblue;",
        "border: 1px solid blue;",
      ],
    },
    name: [
      "display: table-cell;",
      "padding-right: 4px;",
    ],
    briefDesc: [
      "display: table-cell;",
      "color: gray;",
    ],
  },
});

wy.defineWidget({
  name: "editable-code",
  doc: "An editable block of code.",
  constraint: {
    type: "stream",
    obj: {kind: "editable-code"},
  },
  popups: {
    autocomplete: {
      popupWidget: wy.libWidget({type: "popup"}),
      constraint: {
        type: "autocomplete-container",
      },
      clickAway: true,
      position: {
        rightof: "root",
        below: "root",
      },
      size: {
        maxHeight: "400px",
        maxWidth: "600px",
      },
    },
  },
  structure: {
    codeDisplay: wy.widget({type: "stream"}, "code"),
    editor: {},
    editButton: wy.button("Edit..."),
    runButton: wy.button("Run"),
  },
  impl: {
    postInit: function() {
      this.domNode.setAttribute("mode", "display");

      this.completionPopup = null;
    },
    postInitUpdate: function() {
      // tell the object about us so it can provide notifications when
      //  the upstream asts change.
      this.obj.binding = this;
      /** The JstutTokenizer instance of the editor, when instantiated. */
      this.jstutTokenizer = null;
      this.editorInitiated = false;
    },

    /**
     * Transition to edit mode if we are not already in edit mode.
     */
    goEdit: function() {
      if (this.domNode.getAttribute("mode") === "edit")
        return;

      var w = this.domNode.clientWidth, h = this.domNode.clientHeight;
      this.domNode.style.width = w + "px";
      this.domNode.style.height = h + "px";

      this.domNode.setAttribute("mode", "edit");
      // webkit is buggy and needs some help to figure out to restyle things:
      this.codeDisplay_element.setAttribute("style", "");
      this.editor_element.setAttribute("style", "");

      if (this.editorInitiated)
        return;
      this.editorInitiated = true;

      // turn the edit box into a skywriter/ace editor
      $skywriterLoader.makeEditor(this, this.editor_element,
                                  this.obj.code.flattenTokenStream());
    },

    /**
     * Triggered by the "jstut-complete" command to cause us to display a
     *  popup with the completion options.
     */
    showAutocomplete: function(cinfo, relDomNode) {
      this.completionPopup = this.popup_autocomplete(
                               cinfo,
                               {domNode: relDomNode},
                               this.autocompleteSelected.bind(this));
    },

    /**
     * Handler invoked when the autocomplete dialog closes; it is possible
     *  nothing will have been selected, check `what`!
     */
    autocompleteSelected: function(what) {

    },
  },
  events: {
    editButton: {
      command: function() {
        this.goEdit();
      },
    },
    runButton: {
      command: function() {
        this.obj.alterCode();
      },
    },
  },
  style: {
    root: {
      _: [
        "display: block;",
        // create a containing block for absolute positioning purposes of kids
        "position: relative;",
        "border: 1px solid black;",
        "border-radius: 2px;",
        "margin: 2px 0px;",
      ],
      "[mode=display]": {
        editor: "display: none;",
        runButton: "display: none;",
      },
      "[mode=edit]": {
        codeDisplay: "display: none;",
        editButton: "display: none;",
      },
    },
    editor: [
      "width: 100%;",
      "height: 100%;",
      "background-color: white;",
    ],
    editButton: [
      "position: absolute;", // thanks to root being position:relative
      "top: 0;",
      "right: 0;",
    ],
    runButton: [
      "position: absolute;", // thanks to root being position:relative
      "top: 0;",
      "right: 0;",
    ],
  },
});


wy.defineWidget({
  name: "example-show",
  doc: "Executes an example and displays the output in a nested div.",
  constraint: {
    type: "stream",
    obj: {kind: "example-block"},
  },
  structure: {
    label: wy.stream({type: "stream"}, "labelStream"),
    outArea: {}
  },
  impl: {
    postInitUpdate: function() {
      this.obj.youAreBound(this, this.outArea_element);
    },
  },
  style: {
    root: [
      "display: block;",
      ".rounded(@darea-border);",
      "background-color: @darea-bg;",
    ],
    label: ".headerLabel",
    outArea: [
      ".rounded(@darea-border);",
      "background-color: white;",
      "padding: 4px;",
    ],
  },
});

}); // end define
