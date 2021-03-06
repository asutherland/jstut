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

define(
  [
    "wmsy/wmsy",
    "jstut-plat/skywriter-loader",
    "text!./interactive.css",
    "exports"
  ],
  function(
    $wmsy,
    $skywriterLoader,
    $_css,
    exports
  ) {

var wy = exports.wy = new $wmsy.WmsyDomain({id: "interactive",
                                            domain: "jstut",
                                            css: $_css});

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
  focus: wy.focus.nestedItem.vertical("stream"),
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
      this.FOCUS.bindingResized(this);
    },
    toggleExpanded: function() {
      this.expanded = !this.expanded;
      this.update();
    },
  },
  events: {
    root: {
      enter_key: function() {
        this.toggleExpanded();
      },
    },
    header: {
      click: function() {
        this.toggleExpanded();
      },
    },
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
      this.FOCUS.updateFocusRing();
    },
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
  events: {
    completions: {
      command: function(completionBinding) {
        this.done(completionBinding.obj);
      },
    },
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
});

/**
 *
 */
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
  focus: wy.focus.item,
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
      this.editor = null;
      this.editorInitiated = false;
    },

    __complexKeyBehavior: true,
    __handleComplexKeyBehavior: function(aEvent) {
      // leave it to wmsy if the editor is not active (returning shouldHandle)
      return this.editorInitiated == false;
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
                                  this.obj.code.flattenTokenStream(),
                                  this.__context.docFusion);
    },

    /**
     * Triggered by the "jstut-complete" command to cause us to display a
     *  popup with the completion options.
     *
     * Because relDomNode is likely to be the cursor and it likes to be
     *  removed from the DOM tree when a blur event is sent, we retrieve
     *  its positioning info ahead of time.
     */
    showAutocomplete: function(cinfo, relDomNode) {
      this.cinfo = cinfo;

      var bounds = relDomNode.getBoundingClientRect();
      var fakeDomNode = {
        ownerDocument: relDomNode.ownerDocument,
        getBoundingClientRect: function() { return bounds; },
      };
      var fakeBinding = {domNode: fakeDomNode};
      this.completionPopup = this.popup_autocomplete(
                               cinfo,
                               fakeBinding,
                               this.autocompleteSelected.bind(this));
    },

    /**
     * Handler invoked when the autocomplete dialog closes; it is possible
     *  nothing will have been selected, check `what`!
     */
    autocompleteSelected: function(what) {
      // focus the editor again
      // XXX should we instead be marking this widget as focusable and
      //  implementing the focus so we work within the system
      this.editor.focus();

      if (what)
        this.editor.onTextInput(
          what.name.substring(this.cinfo.typedSoFar.length));
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
        if (!this.jstutTokenizer) {
          console.error("trying to run code without editor parser");
          return;
        }
        if (!this.jstutTokenizer.lastGoodTokenLines) {
          console.warn("attempt to run code that has never edit-parsed");
          return;
        }
        this.obj.alterCode(this.jstutTokenizer.lastGoodLines.join("\n"));
      },
    },
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
      this.FOCUS.updateFocusRing();
    },
  },
});

}); // end define
