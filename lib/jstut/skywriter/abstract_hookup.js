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
 * Implement commands that provide a hookup to the abstract interpretation
 *  annotated parsed code.
 **/

define(
  [
    "jstut/traverser",
    "exports"
  ],
  function(
    $traverser,
    exports
  ) {

var traverser = new $traverser.SynTraverser;

/**
 * Dump info on the token at the cursor location.
 */
var CMD_JSTUT_INFO = {
  name: "jstut-info",
  bindKey: "Ctrl-/",
  exec: function(editor) {
    var pos = editor.getCursorPosition(); // {row, column}
    var parser = editor.session.bgTokenizer.parser;
    var token = parser.getTokenInfoAt(pos.row, pos.column);
    if (token) {
      var docInfo = traverser.traverse(token);
      console.log("token", token, "docInfo:", docInfo);
    }
  },
};

var CMD_JSTUT_COMPLETE = {
  name: "jstut-complete",
  bindKey: "Alt-/",
  exec: function(editor) {
    // - figure out where the cursor is
    var pos = editor.getCursorPosition(); // {row, column}

    // - get the parent context and child-typed-so-far info
    var parser = editor.session.bgTokenizer.parser;
    var cinfo = parser.getAutocompleteInfoAt(pos.row, pos.column);
    console.log("complete info", cinfo);

    // - show a popup!
    var cursorNode = editor.renderer.$cursorLayer.cursor;
    console.log("cursorNode", cursorNode);
    editor.wmsyBinding.showAutocomplete(cinfo, cursorNode);
  },
};

/**
 * Cram our keybinding into the editor no matter what.
 */
exports.injectIntoEditor = function injectIntoEditor(editor) {
  editor.commands.addCommand(CMD_JSTUT_INFO);
  editor.commands.addCommand(CMD_JSTUT_COMPLETE);
};

});
