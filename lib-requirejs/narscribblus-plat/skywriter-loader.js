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

define("narscribblus-plat/skywriter-loader",
  [
    "narscribblus/utils/pwomise",
    "narscribblus-plat/package-info",
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
var $env, $pluginManager, $editor, $renderer, $document, $undoManager, $theme,
    $aceJsMode;
// dynamically loaded jstut stuff
var $globalTokenizer, $jstutTokenizer;

/**
 * This is a modified version of ace/editor's
 *  Editor.prototype.onDocumentModeChange implementation to cause it to use our
 *  $globalTokenizer.GlobalTokenizer instead of BackgroundTokenizer.
 */
var editorThunkOnDocumentModeChange = function() {
  var mode = this.doc.getMode();
  if (this.mode == mode)
    return;

  this.mode = mode;
  var tokenizer = mode.getTokenizer();

  if (!this.bgTokenizer) {
    var onUpdate = this.onTokenizerUpdate.bind(this);
    this.bgTokenizer =
      new $globalTokenizer.GlobalFallbackTokenizer(tokenizer, this);
    this.bgTokenizer.addEventListener("update", onUpdate);
  } else {
    this.bgTokenizer.setTokenizer(tokenizer);
  }

  this.renderer.setTokenizer(this.bgTokenizer);
};

/**
 * This is a modified version of ace/editor's onDocumentChange method that
 *  also tells the bgTokenizer the last row that changed.
 */
function editorThunkDocumentChange(e) {
  var data = e.data;
  this.bgTokenizer.start(data.firstRow, data.lastRow);
  this.renderer.updateLines(data.firstRow, data.lastRow);

  // update cursor because tab characters can influence the cursor position
  this.renderer.updateCursor(this.getCursorPosition(), this.$overwrite);
};


/**
 * Return a promise that resolves once all the skywriter startup has happened.
 */
exports.loadSkywriter = function loadSkywriter() {
  if (loadPromise)
    return loadPromise;

  var deferred = $pwomise.defer("loadSkywriter");
  loadPromise = deferred.promise;

  require(
    ["pilot/plugin_manager", "pilot/settings", "pilot/environment",
     "ace/editor", "ace/virtual_renderer", "ace/document",
     "ace/undomanager",
     "ace/mode/javascript", "ace/theme/textmate",
     "jstut/skywriter/global_tokenizer",
     "jstut/skywriter/jstut_tokenizer"],
    function(m_pluginManager, $settings, m_env,
             m_editor, m_renderer, m_document,
             m_undoManager,
             m_ace_js_mode, m_theme,
             m_globalTokenizer,
             m_jstutTokenizer) {
      $pluginManager = m_pluginManager;
      $env = m_env;
      $editor = m_editor;
      $renderer = m_renderer;
      $document = m_document;
      $undoManager = m_undoManager,
      $aceJsMode = m_ace_js_mode;
      // we're using textmate until we can convert proton over.
      $theme = m_theme;
      // our skywriter stuff
      $globalTokenizer = m_globalTokenizer;
      $jstutTokenizer = m_jstutTokenizer;

      // thunk editor so our tokenizer can get the info it needs.
      $editor.Editor.prototype.onDocumentModeChange =
        editorThunkOnDocumentModeChange;
      $editor.Editor.prototype.onDocumentChange = editorThunkDocumentChange;

      $pluginManager.catalog.registerPlugins(["pilot/index", "cockpit/index"])
        .then(function() {
          deferred.resolve();
        });
    });

  return loadPromise;
};


exports.makeEditor = function makeEditor(domNode, code) {
  return when(exports.loadSkywriter(),
    function() {
      var env = $env.create();
      $pluginManager.catalog.startupPlugins({env: env}).then(function() {
        env.editor = new $editor.Editor(
                       new $renderer.VirtualRenderer(domNode, $theme));
        var doc = new $document.Document(code);
        var aceJsMode = new $aceJsMode.Mode();
        var jstutTokenizer = new $jstutTokenizer.JstutTokenizer(
                               aceJsMode.getTokenizer());
        // leave $tokenizer intact for getNextLineIndent.
        aceJsMode.getTokenizer = function() {
          return jstutTokenizer;
        };
        doc.setMode(aceJsMode);
        doc.setUndoManager(new $undoManager.UndoManager());
        env.editor.setDocument(doc);
        env.editor.focus();
        env.editor.resize();
      });
    },
    null, "makeEditor");
};

}); // end define
