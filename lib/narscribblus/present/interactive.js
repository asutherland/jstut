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
    "narscribblus-plat/bespin-loader",
  ],
  function(
    $wmsy,
    $bespin_loader
  ) {

var wy = new $wmsy.WmsyDomain({id: "interactive",
                               domain: "jstut",
                               clickToFocus: true});

wy.defineStyleBase("general", [
  ".rounded (@color: #888888) {",
  "  border-radius: 4px;",
  "  border: 1px solid @color;",
  "  padding: 2px;",
  "  padding-right: 6px;",
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
        toggler: [
          "vertical-align: -20%;",
          "background: url(narscribblus/data/images/minus_sign.png) no-repeat 0% 50%;",
        ],
      },
      "[expanded=false]": {
        toggler: [
          "vertical-align: -20%;",
          "background: url(narscribblus/data/images/plus_sign.png) no-repeat 0% 50%;",
        ],
      },
    },
    header: [
      "cursor: pointer;",
    ],
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
    out: [
      "border-radius: 4px;",
      "background-color: #fff;",
      "padding: 4px;",
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
  structure: {
    code: wy.widget({type: "stream"}, "code"),
  },
  style: {
    root: [
      "display: block;",
      "border: 1px solid black;",
      "border-radius: 2px;",
      "margin: 2px 0px;",
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
    outArea: [
      ".rounded(@darea-border);",
      "background-color: white;",
      "padding: 4px;",
    ],
  },
});

}); // end define
