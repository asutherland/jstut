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
 *   Fabian Jakobs <fabian AT ajax DOT org>
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
 * Load skywriter/ACE and hook it up to jstut's syntaxer and what not.  We
 *  do not load any of the skywriter modules until loadSkywriter is called or
 *  makeEditor causes it to be called.
 **/

define(
  [
    "jstut/utils/pwomise",
    "jstut-plat/package-info",
    "exports"
  ],
  function (
    $pwomise,
    $pkginfo,
    exports
  ) {

var when = $pwomise.when;

var loadPromise;
// dynamically loaded ace deps.
var $editor, $renderer, $document, $undoManager, $theme,
    $editSession, $aceJsMode, $interp;
// dynamically loaded jstut stuff
var $abstractHookup, $globalTokenizer, $jstutTokenizer;


/**
 * Return a promise that resolves once all the skywriter startup has happened.
 */
exports.loadSkywriter = function loadSkywriter() {
  if (loadPromise)
    return loadPromise;

  var deferred = $pwomise.defer("loadSkywriter");
  loadPromise = deferred.promise;

  require(
    ["ace/editor", "ace/virtual_renderer", "ace/document", "ace/edit_session",
     "ace/undomanager",
     "ace/mode/javascript", "ace/theme/textmate",
     "jstut/skywriter/abstract_hookup",
     "jstut/skywriter/global_tokenizer",
     "jstut/skywriter/jstut_tokenizer",
     "jstut/ctags/interp"],
    function(m_editor, m_renderer, m_document, m_edit_session,
             m_undoManager,
             m_ace_js_mode, m_theme,
             m_abstractHookup,
             m_globalTokenizer,
             m_jstutTokenizer,
             m_interp) {
      $editor = m_editor;
      $renderer = m_renderer;
      $document = m_document;
      $editSession = m_edit_session;
      $undoManager = m_undoManager,
      $aceJsMode = m_ace_js_mode;
      // we're using textmate until we can convert proton over.
      $theme = m_theme;
      // our skywriter stuff
      $abstractHookup = m_abstractHookup;
      $globalTokenizer = m_globalTokenizer;
      $jstutTokenizer = m_jstutTokenizer;
      $interp = m_interp;

      deferred.resolve();
    });

  return loadPromise;
};


exports.makeEditor = function makeEditor(binding, domNode, code,
                                         docFusion) {

  return when(exports.loadSkywriter(),
    function() {
      var editor = new $editor.Editor(
                     new $renderer.VirtualRenderer(domNode, $theme));
      editor.wmsyBinding = binding;

      // - create mode, perform general hookup
      var aceJsMode = new $aceJsMode.Mode();
      var editSession = new $editSession.EditSession(code, aceJsMode);

      var interpbox = new $interp.InterpSandbox(docFusion);
      var jstutTokenizer = new $jstutTokenizer.JstutTokenizer(
                             aceJsMode.getTokenizer(), interpbox);
      // Tell the binding about the tokenizer so that it can tell the
      //  tokenizer about updated preAsts.
      binding.jstutTokenizer = jstutTokenizer;
      // Also snapshot the current state of the preAsts.
      jstutTokenizer.preAsts = binding.obj.preAsts;
      // The binding also needs to know about the editor to shunt focus back
      //  to it.
      binding.editor = editor;
      // Leave $tokenizer intact for getNextLineIndent, but make the mode
      //  report the jstutTokenizer as its tokenizer.
      aceJsMode.getTokenizer = function() {
        return jstutTokenizer;
      };

      // - kill bgTokenizer, replace it with our global fallback one
      editSession.bgTokenizer.stop();
      editSession.bgTokenizer = new $globalTokenizer.GlobalFallbackTokenizer(
                                  jstutTokenizer, editor);
      editSession.bgTokenizer.addEventListener(
        "update", function(e) {
          editSession._emit("tokenizerUpdate", e);
        });

      editSession.bgTokenizer.setDocument(editSession.getDocument());
      editSession.bgTokenizer.start(0);

      //doc.setMode(aceJsMode);
      editSession.setUndoManager(new $undoManager.UndoManager());
      editor.setSession(editSession);
      editor.focus();
      editor.resize();

      $abstractHookup.injectIntoEditor(editor);
    },
    null, "makeEditor");
};

}); // end define
