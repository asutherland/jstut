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
 * Straightforward document display; we render the document stream with the
 *  control widget in the upper right.
 **/

define("narscribblus/present/app-doc",
  [
    // Historian stuff:
    "narscribblus/utils/pwomise",
    "narscribblus-plat/package-info",
    "narscribblus-plat/utils/env",
    "narscribblus/doc-loader",
    // UI stuff:
    "wmsy/wmsy",
    "narscribblus/present/type-basics",
    "narscribblus/present/code-blocks",
    "narscribblus/present/manual",
    "narscribblus/present/interactive",
    "require",
    "exports",
  ],
  function(
    $pwomise,
    $pkginfo,
    $env,
    $loader,
    // UI stuff:
    $wmsy,
    $ui_type_basics,
    $ui_code_blocks,
    $ui_manual,
    $ui_interactive,
    require,
    exports
  ) {

var when = $pwomise.when;

var wy = exports.wy = new $wmsy.WmsyDomain({id: "app-doc",
                                            domain: "jstut",
                                            clickToFocus: true});

////////////////////////////////////////////////////////////////////////////////
// Historian

/**
 * Interact with window.history and in-document user-triggered navigation.
 *
 * There is currently a lot of overlap with web-loader.js.  This is really the
 *  better place for it to be, but ideally we would move this into its own
 *  source file at least.
 */
function Historian(doc, binding) {
  this.doc = doc;
  this.win = doc.defaultView;
  this.history = this.win.history;
  var self = this;
  this._popStateWrapped = function() {
    self._loadFromDocumentLocation();
  };
  this.win.addEventListener("popstate", this._popStateWrapped, false);

  this.binding = binding;

  /**
   * For debugging promises, keep the promise that kicked off the document load
   *  around in case we want to visualize what happened after the fact.  This
   *  has some GC impact because we are keeping all the promises and all of
   *  their closures and return values around, so we only keep one of these
   *  around and should consider only doing that when explicitly opted in.
   */
  this._lastLoadPromise = null;

}
Historian.prototype = {
  KIND_TO_LOADER: {
    "doc": "loadData",
    "src": "loadSource",
    "srcdoc": "loadDoc",
  },
  /**
   * Navigate to a new document as a result of explicit user action, generating
   *  a new history entry.
   *
   * @args[
   *   @param[kind @oneof["doc" "src" srcdoc"]]
   *   @param[target String]{
   *     A relative path to the document.
   *   }
   * ]
   */
  navigate: function(kind, target) {
    var args = {};
    args[kind] = target;
    var searchSpec = "?" + $env.buildSearchSpec(args);
    this.history.pushState(null, "", searchSpec);
    this._load(kind, target, {});
  },

  /**
   * Bring ourselves up-to-speed with location.search.
   */
  _loadFromDocumentLocation: function() {
    var env = $env.getEnv(this.win);

    var usingKey = null;
    for (var key in this.KIND_TO_LOADER) {
      if (key in env) {
        usingKey = key;
        break;
      }
    }
    if (!usingKey) {
      console.warn("historian tried to update document using location but" +
                   " could not find any document info.  aborting load" +
                   " attempt.");
      return;
    }


    var opts = {};
    // only copy across specific attributes that are intended to user-sourced.
    if ("mode" in env)
      opts.mode = env.mode;
    if ("forcelang" in env)
      opts.forcelang = env.forcelang;

    this._load(usingKey, env[usingKey], opts);
  },

  /**
   * Asynchronously load a document.
   */
  _load: function(kind, path, opts) {
    this._lastLoadPromise = $pwomise.wrap(
      when($pkginfo[this.KIND_TO_LOADER[kind]](path),
           this._gotDoc.bind(this, kind, path, opts),
           this._notFound.bind(this, kind, path, opts)),
      "historian-load", path);

    // -- debugging support
    // expose a method to trigger visualization of the load promise tree on the
    //  document.
    this.doc.jstutVisualizeDocLoad = function visDocLoad(showBoring) {
      require(["narscribblus/utils/pwomise-vis"], function ($pvis) {
                if (self._lastLoadPromise)
                  $pvis.visualizePromise(self.doc, self._lastLoadPromise,
                                         showBoring);
              });
    };
  },
  /**
   * Continuation of _load when we receive the contents of the URL.
   */
  _gotDoc: function(kind, path, opts, contents) {
    if (kind == "src" && !("lang" in opts))
      opts.lang = "narscribblus/js";

    when($loader.parseDocument(contents, path, opts),
         this._parsed.bind(this, kind, path, opts),
         this._parseProblem.bind(this, kind, path, opts));
  },
  /**
   * Failure mode of _load when the loader could not find the file/doc.
   */
  _notFound: function(kind, path, opts, contents) {
    this.binding.obj.appData = {
      app: "404",
      kind: kind,
      path: path,
    };
    this.binding.update();
  },
  /**
   * Failure mode of _gotDoc's parseDocument invocation (from success of
   *  _load.)
   */
  _parseProblem: function(kind, path, opts, parseEx) {
    this.binding.obj.appData = {
      app: "parse-failure",
      kind: kind,
      path: path,
      ex: parseEx,
    };
    this.binding.update();
  },
  /**
   * Successful conclusion of _gotDoc's parseDocument invocation (from _load).
   */
  _parsed: function(kind, path, opts, parsed) {
    this.binding.obj.appData = parsed;
    this.binding.update();
  },

  /**
   * Unregister our "popstate" listener when being destroyed.
   */
  destroy: function() {
    this.win.removeEventListener("popstate", this._popStateWrapped, false);
  },
};

////////////////////////////////////////////////////////////////////////////////
// App Top-Level
//
// The app root acts as a vessel for the actual document display or for a
//  variety of error explanations explaining why we could not display the
//  document.

wy.defineWidget({
  name: "app-root",
  doc: "The whole app enchilada; control thing in the upper right",
  constraint: {
    type: "app-root",
  },
  focus: wy.focus.domain.vertical("app"),
  structure: {
    //control: wy.widget({type: "page-control"}),
    app: wy.widget({type: "app"}, "appData"),
  },
  impl: {
    postInit: function() {
      this.historian = new Historian(this.domNode.ownerDocument, this);
    },
    destroy: function() {
      this.historian.destroy();
      this.__destroy();
    },
  },
  receive: {
    navigate: function(kind, target) {
      console.log("want to navigate to", kind, target);
      this.historian.navigate(kind, target);
    },
  },
});

wy.defineWidget({
  name: "app-doc",
  doc: "Render the document stream; popup king.",
  focus: wy.focus.container.vertical("stream"),
  constraint: {
    type: "app",
    obj: {app: "doc"},
  },
  popups: {
    browse: {
      popupWidget: wy.libWidget({type: "popup"}),
      constraint: {type: "popup-root"},
      clickAway: true,
      position: {
        centerOn: "root",
      },
      size: {
        // size based on the visible area
        width: 0.9,
        //height: 0.7,
        // but cap the dimensions at something reasonable
        maxWidth: "800px",
        maxHeight: "800px",
      }
    },
  },
  structure: {
    stream: wy.stream({type: "stream"}, "textStream"),
  },
  receive: {
    browse: function browse(browseTarget, originBinding, originDomNode) {
      var browseObj = {
        crumbs: [],
        content: browseTarget,
      };
      var fakeOrigin = {
        domNode: originDomNode,
      };
      this.popup_browse(browseObj,
                        fakeOrigin, // origin for positioning only
                        null, // no callback
                        null); // no indirect parenting; root at the top
    },
  },
});

wy.defineWidget({
  name: "app-404",
  doc: "Throw up an error message when we can't find a document",
  constraint: {
    type: "app",
    obj: {app: "404"},
  },
  structure: {
    header: "Unable to locate requested document!",
    pathBits: [wy.bind("kind"), ": ", wy.bind("path")],
  },
});

/**
 * All-singing, all-dancing parse failure widget.  This is to be the widget
 *  we use for *all* parse failures, so it should be migrated as appropriate.
 *
 * The strategy for parse errors is to try and describe the error in human
 *  readable terms and then display the
 */
wy.defineWidget({
  name: "app-parse-failure",
  doc: "Throw up an error message when we experience a parse failure.",
  constraint: {
    type: "app",
    obj: {app: "parse-failure"},
  },
  structure: {
    header: "Parse Failure!",
    forceRawButton:
      wy.button("Force narscribblus/raw to see a syntax-highlighted view."),
    pathBits: [wy.bind("kind"), ": ", wy.bind("path")],
    lineAndColumn: ["Line: ", wy.bind(["ex", "lineNumber"]),
                    " Column: ", wy.bind(["ex", "column"])],
    exception: wy.bind("ex"),
    contentsDesc: "The line with the error has a red background!",
    fileContents: {},
  },
  impl: {
    postInitUpdate: function() {
      var ex = this.obj.ex;
      // -- popuplate fileContents if our exception has a "sourceLines" attr
      if (("sourceLines" in ex) && ex.sourceLines) {
        var node = this.fileContents_element;
        var doc = node.ownerDocument;
        // Create a plain text node for the text before the line, decorated text
        //  node for the line, and then a plain text node for what comes after.
        //  This allows us to avoid having to do any escaping.  Go us!
        node.appendChild(
          doc.createTextNode(
            ex.sourceLines.slice(0, ex.lineNumber - 1).join("\n") + "\n"));

        var decorated = doc.createElement("span");
        decorated.setAttribute("style", "background-color: red;");
        decorated.appendChild(
          doc.createTextNode(
            ex.sourceLines.slice(ex.lineNumber - 1, ex.lineNumber) + "\n"));
        node.appendChild(decorated);

        node.appendChild(
          doc.createTextNode(
            ex.sourceLines.slice(ex.lineNumber).join("\n")));
      }
    },
  },
  events: {
    forceRawButton: {
      command: function goRaw() {
        // add forcelang=narscribblus/raw to the location.
        // do not use any AJAXy stuff; force a complete load since it is safest
        //  and this is an arguably exceptional situation.
        window.location.search += "&forcelang=narscribblus/raw";
      },
    },
  },
  style: {
    header: [
      "font-family: sans-serif;",
      "font-size: 200%;",
      "color: red;",
      "text-align: center;",
      "display: block;",
    ],
    exception: [
      "display: block;",
      "margin-top: 1em;",
    ],
    contentsDesc: [
      "display: block;",
      "margin-top: 1em;",
    ],
    fileContents: [
      "margin-top: 1em;",
      "font-family: monospace;",
      "white-space: pre;",
    ],
  },
});

////////////////////////////////////////////////////////////////////////////////
// Popup Top-Level
//
// The popup-root provides an ephemeral "browse" receiving mechanism.  Browsing
//  within the popup does not affect the document history, but does update a
//  bread-crumb display at the top of the pop-up.
//
// A "pop-out" mechanism to open a new tab with the current contents of the
//  pop-up would be a good future enhancement.

wy.defineWidget({
  name: "popup-root",
  doc: "Browsing popup; navigation without abandoning the true document.",
  constraint: {
    type: "popup-root",
  },
  structure: {
    padder: {
      crumbContainer: {
        crumbLabel: "Recently Seen: ",
        crumbs: wy.horizList({type: "stream"}, "breadcrumbs"),
      },
      explicitClose: wy.button("X"),
      contents: wy.widget({type: "present"}, "content"),
    },
  },
  focus: wy.focus.domain.vertical("explicitClose", "contents"),
  receive: {
    browse: function browse(browseTarget, originBinding) {
      console.log("nested browse", browseTarget);
    },
  },
  events: {
    explicitClose: {
      command: function() {
        this.done();
      },
    },
  },
  style: {
    root: [
      "background-color: white;",
      "border-radius: 4px;",
    ],
    padder: [
      "padding: 4px;",
    ],
    crumbLabel: [
      "font-size: 80%;",
      "font-style: italic;",
    ],
    crumbContainer: [
      "display: inline-block;",
      "float: left;",
      "margin-bottom: 2px;",
    ],
    explicitClose: [
      "float: right;",
      "cursor: pointer;",
    ],
    contents: [
      "clear: both;",
    ],
  },
});

////////////////////////////////////////////////////////////////////////////////

/**
 * Show the contents of a single document, processing the output stream for
 *  types and directly binding each
 */
exports.showDoc = function(parsed, doc, packageBaseRelPath) {
  wy.setPackageBaseRelPath(packageBaseRelPath);
  var emitter = wy.wrapElement(document.getElementById("body"));

  var objRoot = {
    appData: parsed,
  };

  emitter.emit({type: "app-root", obj: objRoot});
};

});
