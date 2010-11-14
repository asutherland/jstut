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

require.def("narscribblus/present/type-basics",
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
  },
  structure: {
  },
});

wy.defineWidget({
  name: "traceout",
  doc: "Display trace output.",
  constraint: {
    type: "stream",
  },
  structure: {
  },
});

wy.defineWidget({
  name: "editable-code",
  doc: "An editable block of code.",
  constraint: {
    type: "stream",
  },
  structure: {
  },
});

wy.defineWidget({
  name: "display-area",
  doc: "Output area for executed code",
  constraint: {
    type: "stream",
  },
  structure: {
  },
});


wy.defineWidget({
  name: "example-block",
  doc: "Display trace output.",
  constraint: {
    type: "stream",
  },
  structure: {
  },
});

}); // end require.def
