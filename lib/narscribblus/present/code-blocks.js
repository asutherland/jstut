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

define("narscribblus/present/code-blocks",
  [
    "wmsy/wmsy",
    "narscribblus/render/js",
  ],
  function(
    $wmsy,
    $render_js
  ) {

var wy = new $wmsy.WmsyDomain({id: "code-blocks",
                               domain: "jstut",
                               clickToFocus: true});

////////////////////////////////////////////////////////////////////////////////
// Styling Base

// XXX do something about the syntax style sheet stuff once we figure out the
//  asynchrony strategy for this.  (RequireJS plugins w/jetpack equivalent?)
wy.referenceExternalStylesheet("narscribblus/data/css/syntax-js-proton.css");


////////////////////////////////////////////////////////////////////////////////
// JS Code!

/**
 * Exposes a block of syntax-highlighted JS code as a single wmsy widget while
 *  still allowing for clickable contents.  From a performance and sanity
 *  perspective it is unacceptable to bind everything that might be clickable
 *  into a wmsy widget, so we do the flyweight thing and just handle the clicks
 *  when they bubble up to us.
 */
wy.defineWidget({
  name: "code-block-js",
  doc: "JS code block, with or without magic.",
  constraint: {
    type: "stream",
    obj: {kind: "jsblock"},
  },
  emit: ["browse"],
  structure: {
  },
  impl: {
    postInitUpdate: function() {
      var options = {
        linkifySyntax: true,
      };
      var rendered = $render_js.htmlifyJSBlock(this.obj, options);
      this.domNode.innerHTML = rendered.html;
      this.linkmap = rendered.linkmap;
    },
  },
  events: {
    root: {
      click: function(targetBinding, event) {
        var targ = event.target;
        while (targ && !targ.hasAttribute("u") && !("binding" in targ)) {
          targ = targ.parentNode;
        }
        if (!targ || !targ.hasAttribute("u"))
          return;
        var linked = this.linkmap[targ.getAttribute("u")];

        this.emit_browse(linked, this, targ);
      },
    }
  },
});

////////////////////////////////////////////////////////////////////////////////

}); // end define
