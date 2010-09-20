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
 * Interactive documents have support for exposing editable source code into
 *  the page using bespin as well as allowing for results to be dynamically
 *  displayed on the page somehow.
 *
 * ---
 * The horrible question and ambiguity of this goal is the relationship between
 *  the parse pass and the actual interactive 'document'.  This is made even
 *  more complex if we have chrome/content separation happening with jetpack.
 *
 * We definitely have the goal of supporting non-privileged interactive
 *  documents.  That can be accomplished either by a self-generating strategy
 *  that does the document parsing/loading as part of the presentation, or
 *  where we generate an offline document which is then loaded.
 * The offline strategy doesn't really seem to offer anything to us.  Although
 *  we do want an 'inert' document option, that would imply no JS activity
 *  at all which implies we generate it by running the 'active' version and
 *  then serializing the results by just outputting the generated static-able
 *  HTML and using canvas to render the 'show' DOM nodes into images.
 *
 * Right, so a reasonable 'kickoff' might be:
 * - have the loader have a liveLoadIntoDOMNode() mechanism which initiates
 *    and performs the parses and kicks some DOM nodes into existence under
 *    the given DOM node.  It then further hooks up JS things to make everything
 *    alive.
 * We can break our implementation up into a few passes which are aligned with
 *  the static stuff too:
 * - toHTMLString() could be just generating the 'static' bits.
 * - liveject() could then be given access to the DOM tree to poke and prod:
 *   - cause bespin() To turn the code blocks into bespin blocks and add the
 *      "apply" buttons to trigger rebuilds.
 *   - create the sandbox for the show and invoke it, while also adding the
 *      other "apply" impact.
 *   - code block and sandbox rendezvous can be accomplished through the context
 *      where the code blocks define their names and current payloads and
 *      create a list of listeners.  the 'show' can then register itself as
 *      listeners to trigger the rebuild logic when those guys have 'apply'
 *      hit on them.
 *
 * Er, of course, the potential gotcha is the issue of generating
 *  cross-reference-able documentation.  But I don't see this posing a problem
 *  because for cross-reference generation purposes we can just load the
 *  document with all of the execution/show stuff being nop'ed out since
 *  the actual documentation that we would link to is not dynamic.
 *
 **/

require.def("narscribblus/langs/interactive",
  [
    "exports",
    // core
    "narscribblus-plat/package-info",
    "narscribblus/utils/pwomise",
    // syntax related
    "narscribblus/readers/scribble-syntax",
    "narscribblus/readers/js",
    // document processing / emission
    "narscribblus/langs/manual",
    "narscribblus/langbits/jsdoc",
    "narscribblus/render/html",
    "narscribblus/render/js",
    "narscribblus/docfusion",
    // JS semantics
    "narscribblus/ctags/interp",
    // runtime
    "narscribblus-plat/bespin-loader",
    "narscribblus-plat/sandboxer",
    "narscribblus/narcissus/jsparse",
    "narscribblus/ui-junk",
  ],
  function(
    exports,
    // core
    pkginfo,
    pwomise,
    // syntax related
    syn,
    reader_js,
    // document processing / emission
    man,
    jsdoc,
    html,
    render_js,
    docfusion,
    // JS semantics
    astinterp,
    // runtime
    bespinLoader,
    sandboxer,
    jsparse,
    uijunk
  ) {

var when = pwomise.when;

var Identifier = syn.Identifier, Keyword = syn.Keyword;

var decodeFlow = man.decodeFlow;
var htmlDocify = html.htmlDocify, htmlStreamify = html.htmlStreamify,
    htmlEscapeText = html.htmlEscapeText;

var docFusion = docfusion.docFusion;

exports.parse = function parse(nodes, ctx) {
  function parseItUp() {
    ctx.options.exampleBlockContributions = {};
    return man.parse(nodes, ctx);
  }

  // If we don't already know the package for ourselves, get it and let it
  //  bootstrap.
  if (!("pkg" in ctx.options)) {
    return when(docFusion.getPackage(ctx.packageName),
                function(pkgInfo) {
                  ctx.options.pkg = pkgInfo;
                  return parseItUp();
                });
  }
  return parseItUp();
};

exports.expand = function expand(nodes, ctx) {
  // The sandbox needs something that implements requireModule and returns
  //  a ModuleInfo.  We pass it in directly because we are a stone's throw from
  //  death by circular dependency; no better reason.
  ctx.interpbox = new astinterp.InterpSandbox(docFusion);

  // create a group so that any nodes that need to do something async can do
  //  so and we will defer the completion of this phase until they complete
  //  their async chains.
  var group = pwomise.joinableGroup("expand", ctx.name);
  ctx.joinPhase = group.join;
  ctx.options.codeClearingHouse = new CodeClearingHouse();

  var expanded = man.textStreamChewer(nodes, ctx);
  // only if we are in non-meta mode should we decodeFlow.
  if (!("mode" in ctx.options) || (ctx.options.mode !== "meta"))
    expanded = decodeFlow(expanded);

  // all code blocks should be resolved at this point; get unhappy if some
  //  remain.
  ctx.options.codeClearingHouse.explodeOnOutstandingPromises();

  group.lockIfEmpty();
  return when(group.promise, function() {
    return expanded;
  });
};

/**
 * Provide UI for things that would otherwise require typing random arguments
 *  into the location bar (or invoking the program with a different command
 *  line, etc.).
 *
 * Currently this means:
 * @itemize[
 *   @item{View syntax highlighted source.}
 * ]
 */
function PageControlNode(ctx) {
  this.ctx = ctx;
}
PageControlNode.prototype = {
  toHTMLString: function(options) {
    return "<div class='danet'>" +
      "<a" + options.makeDocLink(this.ctx.packageRelPath,
                                 this.ctx.packageName,
                                 {forcelang: "narscribblus/raw"}) + ">" +
      "\u03c0</a>" +
      "</div>";
  }
};

/**
 * Process phase; build the skeleton of an HTML document accompanied by a
 *  liveject method which has the brains to turn the document into the
 *  interactive page we so desire.
 *
 * The HTML building not only provides us with the static page but also,
 *  as a side-effect, populates the list of livejecters with functions to
 *  invoke when creating the live page.
 */
exports.process = function process(nodes, ctx) {
  // meta mode is for docfusion purposes...
  if (("mode" in ctx.options) && (ctx.options.mode === "meta")) {
    return {
      textStream: nodes,
    };
  }

  ctx.options.livejecters = [];
  // We use the constructor name to indicate whether we've seen something or
  //  not.  it's on the language to make sure it has no collisions in the
  //  emergent namespace.
  ctx.options.oneOffLivejectersSeen = {};

  ctx.options.linkifySyntax = true;
  ctx.options.popupManager = new uijunk.PopupManager();

  return {
    body: htmlDocify([new PageControlNode(ctx)].concat(nodes),
                     ctx,
                     [ctx.options.popupManager.getCssUrl()]),
    liveject: function(doc, win) {
      // -- load bespin in and queue up the livejecters to run once loaded
      function runLivejecters() {
console.log("allegedly bespin is all loaded...");
        var livejecters = ctx.options.livejecters;
        for (var i = 0; i < livejecters.length; i++) {
          livejecters[i].liveject(doc, ctx.options);
        }
      }
      bespinLoader.loadBespin(doc, runLivejecters);
    },
  };
};

function countLinesInString(s) {
  var idx = -1, count = 1;
  while ((idx = s.indexOf("\n", idx + 1)) != -1) {
    count++;
  }
  return count;
}

/**
 * Tracks the (editable) code blocks in the document.
 *
 * This primarily exists so that we can hand out promises for code blocks that
 *  have not yet been registered.
 */
function CodeClearingHouse() {
  this._codeBlocksByName = {};
  this._issuedDeferredsByName = {};
}
CodeClearingHouse.prototype = {
  register: function(codeBlock) {
    this._codeBlocksByName[codeBlock.name] = codeBlock;
    if (codeBlock.name in this._issuedDeferredsByName) {
      this._issuedDeferredsByName[codeBlock.name].resolve(codeBlock);
      this._issuedDeferredsByName[codeBlock.name] = null;
    }
  },

  /**
   * It is possible for issue promises that will never be resolved because there
   *  was a typo involved somewhere.
   */
  explodeOnOutstandingPromises: function() {
    for (var name in this._issuedDeferredsByName) {
      var deferred = this._issuedDeferredsByName[name];
      if (deferred === null)
        continue;
      console.error("Promised code block", name, "never showed up.");
      deferred.reject();
    }
    this._issuedDeferredsByName = null;
  },

  /**
   * Retrieve the named code blocks or a promise that resolves to the code
   *  blocks.
   *
   * @args[
   *   @param[names @listof["code block name"]]
   * ]
   * @return[@maybepromise[@listof[EditableCode]]]
   */
  getNamedCodeBlocks: function(names) {
    var deferred = null, self = this, results = [], pendingCount = 0;
    names.forEach(function (name, index) {
      if (name in self._codeBlocksByName) {
        results.push(self._codeBlocksByName[name]);
        return;
      }
      pendingCount++;
      results.push(null);
      if (!(name in self._issuedDeferredsByName)) {
        self._issuedDeferredsByName[name] =
          pwomise.defer("codeBlock", name);
      }
      when(self._issuedDeferredsByName[name].promise, function(codeBlock) {
        results[index] = codeBlock;
        pendingCount--;
        if (pendingCount === 0)
          deferred.resolve(results);
      });
    });
    console.log("getNamed:", results, "pending", pendingCount);
    if (pendingCount)
      return (deferred = pwomise.defer("getNamedCodeBlocks")).promise;
    return results;
  },
};

/**
 * An editable block of code.
 */
function EditableCode(svals, ctx) {
  if (typeof(svals[0]) !== "string")
    throw new Error("first sval to EditableCode needs to be a name");

  this.name = svals[0];
  var depBlockNames = this.depBlockNames = [];
  this.highlightTerms = [];

  var idx = 1;
  // check explicit keywords
  while (svals[idx] instanceof Keyword) {
    switch (svals[idx++].keyword) {
      // dependency names
      case "deps":
        while (typeof(svals[idx]) === "string")
          depBlockNames.push(svals[idx++]);
        break;

      case "highlight":
        if (!(svals[idx] instanceof Identifier))
          throw new Error("#:highlight expects an identifier argument");
        this.highlightTerms.push(svals[idx++].identifier);
      console.log("hlTerms", this.highlightTerms);
        break;

      default:
        throw new Error("don't know what to do with keyword: " +
                        svals[idx-1].keyword);
    }
  }
  if (!(svals[idx] instanceof reader_js.JSBlock))
    throw new Error("first non-keyword tagged arg sval to EditableCode " +
                    "needs to be js code");
  this.code = svals[idx];
  this.updateListeners = [];

  this._interpreted = false;

  ctx.options.codeClearingHouse.register(this);
  this._interpret(ctx);
}
EditableCode.prototype = {
  alterCode: function(newCode) {
    this.code.text = newCode;
    this._interpreted = false;

    for (var i = 0; i < this.updateListeners.length; i++) {
      this.updateListeners[i].codeUpdated(this);
    }
  },

  _interpret: function(ctx) {
    var self = this;
    ctx.joinPhase(when(
      ctx.options.codeClearingHouse.getNamedCodeBlocks(this.depBlockNames),
      function(codeBlocks) {
//        console.log("^^^ abstract interpreting", self.name, codeBlocks);
        var preAsts = [];
        for (var i = 0; i < codeBlocks.length; i++) {
          preAsts.push(codeBlocks[i].code.script);
        }
//        console.log("preAsts:", preAsts);
        return when(
          ctx.interpbox.processAnonSnippet(preAsts,
                                           self.code.script,
                                           self.name),
          function() {
            console.log("$$$$$ abstract intrep done", self.name);
            self._interpreted = true;
          });
      }));
  },

  htmlDontWrapInPara: true,
  /**
   * Generate an empty div to be the editor and the span for our apply button.
   *  (We start the div empty mainly so I can avoid needing to escape the
   *   text.)
   */
  toHTMLString: function(options) {
    var height = (countLinesInString(this.code.flattenTokenStream()) + 2) * 22;
    options.cssBlocks.push("#edcode-editor-" + this.name + " { " +
                           "height: " + height + "px; " +
                           "border: 1px solid gray; " +
                           "}");
    options.livejecters.push(this);
    // create a nice big container div to hold the display/edit area and buttons
    var s = '<div id="edcode-container-' + this.name +
            '" class="edcode-container" mode="display">\n';
    options.highlightTerms = this.highlightTerms;
    s += render_js.htmlifyJSBlock(this.code, options);
    options.highlightTerms = null;
    s += '  <textarea id="edcode-editor-' + this.name +
           '" class="edcode-editor"></textarea>\n';
    s += '  <div id="edcode-error-' + this.name +
           '" style="display: none;" class="edcode-error">' +
           '</div>\n';
    s += "  <input id='edcode-doedit-" + this.name + "' type='button' " +
           "class='edcode-doedit' " +
           "value='Edit Code'>\n";
    s += "  <input id='edcode-apply-" + this.name + "' type='button' " +
           "class='edcode-apply' " +
           "value='Apply Changes'>\n";
    s += '</div>\n';
    return s;
  },
  /**
   * Turn our div into a bespin editor, hook up our span to update our fellows.
   */
  liveject: function(doc, win) {
    var dis = this;
    this.bespinEnv = null;
    // fill in the text
    var editBtn = doc.getElementById("edcode-doedit-" + this.name);
    editBtn.addEventListener("click", function(event) {
      var container = doc.getElementById("edcode-container-" + dis.name);
      container.setAttribute("mode", "edit");
      // chromium won't correctly apply styles to our .syntax child if we don't
      //  give it a very obvious sign.  I think this is what bz was complaining
      //  about. HACK:CHROMIUM
      container.setAttribute("class", container.getAttribute("class"));

      var edDiv = doc.getElementById("edcode-editor-" + dis.name);
      edDiv.textContent = dis.code.flattenTokenStream();
      
      bespinLoader.useBespin(doc,
        "edcode-editor-" + dis.name, {syntax: "js",}
      ).then(function(env) {
        dis.bespinEnv = env;
        env.dimensionsChanged();
      });
    }, false);

    // hook up our apply button
    var applySpan = doc.getElementById("edcode-apply-" + this.name);
    applySpan.addEventListener("click", function(event) {
      var newCode = dis.bespinEnv.editor.value;
      // ask narcissus to see if there are syntax errors in the code...
      var problem = jsparse.syntaxCheck(newCode);
      var errout = doc.getElementById("edcode-error-" + dis.name);
      if (problem) {
        errout.removeAttribute("style");
        errout.textContent = problem.toString();
        return;
      }
      else {
        errout.setAttribute("style", "display: none;");
        errout.textContent = "";
      }

      dis.alterCode(newCode);
    }, false);
  }
};

/**
 * At runtime triggering, builds some form of sandbox to execute the code
 *  present in the referenced code blocks.
 *
 * @args[
 *   @param[name String]{
 *     A document-unique name for the code execution block.
 *   }
 *   @param[blockNames @listof[String]]{
 *     The list of code block names that should be smooshed together for
 *     execution.
 *   }
 *   @param[ctx ParserContext]
 * ]
 */
function CodeExecution(name, blockNames, ctx, doc) {
  this.name = name;
  this.doc = doc;
  this.active = false;
  var edcodes = this.edcodes = [];
  var self = this;
  this.gotCodes = when(
       ctx.options.codeClearingHouse.getNamedCodeBlocks(blockNames),
       function(codeBlocks) {
         for (var i = 0; i < codeBlocks.length; i++) {
           var edcode = codeBlocks[i];
           edcodes.push(edcode);
           edcode.updateListeners.push(self);
         }
       });
}
CodeExecution.prototype = {
  codeUpdated: function() {
    console.log("** heard about a code update!");
    if (!this.active)
      return;
    this._buildSandboxAndRun();
  },

  /**
   * Create a fresh sandbox to run all of our code blocks in.
   */
  _buildSandboxAndRun: function() {
console.info("######### building sandbox and running", this.edcodes);
    // in jetpack-land we could build a true and proper sandbox of sorts
    // here we need to just create a function that takes the expected
    // free variables as arguments, append all the code together into that,
    // and run it.
    var codeSnippets = [];
    for (var i = 0; i < this.edcodes.length; i++) {
      var edcode = this.edcodes[i];
      codeSnippets.push(edcode.code.text);
    }

    var globals = {}, contributor, iRun;
    for (iRun = 0; iRun < this._contributors.length; iRun++) {
      contributor = this._contributors[iRun];
      if ("preCodeRun" in contributor)
        contributor.preCodeRun(globals);
    }

    var dis = this;
    this.sandbox = sandboxer.makeSandbox(
                     this.name,
                     this.doc,
                     codeSnippets.join("\n"),
                     globals,
                     function() { dis._sandboxRunCompleted(); });
  },
  _sandboxRunCompleted: function() {
    var contributor, iRun;
    for (iRun = 0; iRun < this._contributors.length; iRun++) {
      contributor = this._contributors[iRun];
      if ("postCodeRun" in contributor)
        contributor.postCodeRun();
    }
  },

  go: function(aContributors) {
    this._contributors = aContributors;
    this.active = true;
    when(this.gotCodes, this._buildSandboxAndRun.bind(this));
  }
};

function DisplayArea(name, labelStream, ctx) {
  this.name = name;
  this.labelStream = labelStream;
}
DisplayArea.prototype = {
  /**
   *  generate the DOM node where we will bind our display result in.
   */
  toHTMLString: function(options) {
    return "<div class='darea-container'>\n" +
      // label
      "  <div class='darea-label'>" +
      htmlStreamify(this.labelStream, options) +
      "</div>\n" +
      // output area
      "  <div id='darea-out-" + this.name + "' class='darea-out'></div>\n" +
      "</div>\n";
  },

  bindIntoReality: function(doc) {
    this.domNode = doc.getElementById("darea-out-" + this.name);
  },

  preCodeRun: function(globals) {
    // kill all children
    var domNode = this.domNode;
    while (domNode.lastChild)
      domNode.removeChild(domNode.lastChild);
    var useKid = domNode.ownerDocument.createElement("div");
    domNode.appendChild(useKid);
    globals.exampleDomNode = useKid;
    globals.document = domNode.ownerDocument;
  }
};

/**
 *
 */
function TraceHelper() {
  var dis = this;
  var outlog = this.outlog = [];
  this.traceWrap = function(color, func) {
    var funcName = func.name ? func.name : "";
    return function() {
      var argstr;
      try {
        argstr = "(";
        for (var i = 0; i < arguments.length; i++) {
          if (i)
            argstr += ", ";
          var arg = arguments[i];
          if (typeof(arg) !== "object")
            argstr += arguments[i];
          else if (arg === undefined)
            argstr += "undefined";
          else if (arg === null)
            argstr += "null";
          else
            argstr += JSON.stringify(arg);
        }
        argstr += ")";
      }
      catch (ex) {
        argstr = "(could not convert args)";
      }

      var rval;
      try {
        rval = func.apply(this, arguments);
      }
      catch(ex) {
        outlog.push(["red", ex.toString()]);
        throw ex;
      }

      var rstr;
      try {
        if (typeof(rval) !== "object")
          rstr = "" + rval;
        else if (rval === undefined)
          rstr = "undefined";
        else if (arg === null)
          rstr = "null";
        else
          rstr = JSON.stringify(rval);
      }
      catch (ex) {
        rstr = "(could not convert result)";
      }
      outlog.push([color, funcName + argstr + " => " + rstr]);

      return rval;
    };
  };
  this.clear = function() {
    outlog = dis.outlog = [];
  };
}

/**
 *
 *
 * @args[
 *   @param[svals @list[
 *     @param["example name"]{
 *
 *     }
 *   ]]
 * ]
 */
function TraceOutput(svals, tvals, ctx) {
  this.traceHelper = new TraceHelper();

  var exampleName = this.exampleName = svals[0];
  if (!(exampleName in ctx.options.exampleBlockContributions))
    ctx.options.exampleBlockContributions[exampleName] = [this];
  else
    ctx.options.exampleBlockContributions[exampleName].push(this);

  this.labelStream = tvals;
}
TraceOutput.prototype = {
  htmlDontWrapInPara: true,
  toHTMLString: function(options) {
    options.livejecters.push(this);
    return "<div class='traceout-container'>\n" +
      // label
      "  <div class='traceout-label'>" +
      htmlStreamify(this.labelStream, options) + "</div>\n" +
      // output div
      "  <div id='traceout-output-" + this.exampleName +
      "'class='traceout-output'></div>\n" +
      // (close)
      "</div>\n";
  },
  liveject: function(doc, win) {
    this.domNode = doc.getElementById("traceout-output-" + this.exampleName);
    if (this.traceHelper.outlog.length)
      this._updateOutput();
  },

  _updateOutput: function() {
    var domNode = this.domNode;
    if (!domNode)
      return;
    var doc = domNode.ownerDocument;
    while (domNode.lastChild)
      domNode.removeChild(domNode.lastChild);
    var outlog = this.traceHelper.outlog;
    for (var i = 0; i < outlog.length; i++) {
      var entry = outlog[i];
      var colorName = entry[0], traceString = entry[1];
      var cdiv = doc.createElement("div");
      cdiv.setAttribute("style", "color: " + colorName + ";");
      cdiv.textContent = traceString;
      domNode.appendChild(cdiv);
    }
  },

  preCodeRun: function(globals) {
    this.traceHelper.clear();
    globals.traceWrap = this.traceHelper.traceWrap;
  },
  postCodeRun: function() {
    this._updateOutput();
  },
};

/**
 * Glues together a DisplayArea and the CodeExecution block that crams things in
 *  it.  (Note: we used to also have an ExampleCode bit in here, but we got
 *  rid of it so it could go live in a Collapsed instance far away from where
 *  the example gets bound in.
 *
 * Life-cycle interaction:
 * @itemize[
 *   @item{Created in document order by textStreamChewer/driver.}
 *   @item{During process-driven htmlification, registers as a livejecter.}
 *   @item{During livejection, creates a CodeExecution instance.  We don't do
 *         this during creation because the referenced EditableCode blocks may
 *         not yet exist (they could come after us in the document).  In order
 *         to allow other things (like TraceOutput) to coordinate with us, they
 *         contribute to ctx.options.exampleBlockContributions using our name
 *         and we in turn check it in order to hook stuff up to the
 *         CodeExecution instance.}
 * ]
 *
 * @args[
 *   @param[svals @list[
 *     @param["example name"]
 *     @rest["code block name"]
 *   ]]
 *   @param[tvals]{
 *     The label to prefix the example output.
 *   }
 * ]
 */
function ExampleBlock(svals, tvals, ctx) {
  var blockNames = this.blockNames = [];
  var aggrName = null;
  this.name = svals[0];
  for (var i = 1; i < svals.length; i++) {
    var sval = svals[i];
    if (typeof(sval) === "string") {
      blockNames.push(sval);
      if (aggrName)
        aggrName += "-" + sval;
      else
        aggrName = sval;
    }
    else {
      throw new Error("ExampleBlock does not know what to do with: " + sval);
    }
  }

  this.displayArea = new DisplayArea(aggrName, tvals, ctx);

  this.aggrName = aggrName;
  this.runRev = 0;
  this.ctx = ctx;
}
ExampleBlock.prototype = {
  htmlDontWrapInPara: true,
  toHTMLString: function(options) {
    var s = this.displayArea.toHTMLString(options);
    // (make sure we end up in the livejecter list after our children)
    options.livejecters.push(this);
    return s;
  },

  liveject: function(doc, win) {
    var contributors;
    if (this.name in this.ctx.options.exampleBlockContributions)
      contributors = this.ctx.options.exampleBlockContributions[this.name];
    else
      contributors = [];

    this.displayArea.bindIntoReality(doc);
    this.codeExec = new CodeExecution(this.name, this.blockNames, this.ctx,
                                      doc);
    this.codeExec.go([this, this.displayArea].concat(contributors));
  },

  preCodeRun: function(globals) {
    this.runRev++;
    globals.exampleName = "run-" + this.aggrName + "-" + this.runRev;
  },
};

/**
 * A labeled collapsible display block.
 *
 * @args[
 *   @param[svals @list[
 *     @param["label"]{
 *       The label for the collapsed block.
 *     }
 *   ]
 *   @param[tvals]{
 *     The contents to be collapsed / uncollapsed.
 *   }
 * ]
 */
function Collapsed(aCollapsed, svals, tvals, ctx) {
  this.initiallyCollapsed = aCollapsed;
  this.label = svals[0];
  // assume no collisions on the collapse string for now
  this.textStream = decodeFlow(tvals);
}
Collapsed.prototype = {
  htmlDontWrapInPara: true,
  // violent CSS things are being done to avoid having to deal with webkit
  //  attribute selector updating bugs.  this no doubt could be much cleaner,
  //  though.
  oneOffLivejecter: {
    handleExpand: function(event) {
      var cont = event.target.parentNode;
      cont.getElementsByClassName("collapsey-expand-button")[0]
          .setAttribute("style", "display: none;");
      cont.getElementsByClassName("collapsey-collapse-button")[0]
          .removeAttribute("style");
      cont.getElementsByClassName("collapsed-contents")[0]
          .setAttribute("class", "collapsey-contents");
      cont.setAttribute("style", "display: block;");
      event.preventDefault();
    },
    handleCollapse: function(event) {
      var cont = event.target.parentNode;
      cont.getElementsByClassName("collapsey-expand-button")[0]
          .removeAttribute("style");
      cont.getElementsByClassName("collapsey-collapse-button")[0]
          .setAttribute("style", "display: none;");
      cont.getElementsByClassName("collapsey-contents")[0]
          .setAttribute("class", "collapsed-contents");
      cont.removeAttribute("style");
      event.preventDefault();
    },
    handleLabel: function(event) {
      // the label knows not the current mode! check it.
      var cont = event.target.parentNode;
      var expandy = cont.getElementsByClassName("collapsey-expand-button")[0];
      var expanded = expandy.hasAttribute("style");
      if (expanded)
        Collapsed.prototype.oneOffLivejecter.handleCollapse(event);
      else
        Collapsed.prototype.oneOffLivejecter.handleExpand(event);
    },
    liveject: function Collapsed_oneOffLivejecter(doc, win) {
      var elems = doc.getElementsByClassName("collapsey-container");
      for (var i = 0; i < elems.length; i++) {
        var cont = elems[i];
        cont.getElementsByClassName("collapsey-expand-button")[0]
            .addEventListener("click", this.handleExpand, false);
        cont.getElementsByClassName("collapsey-collapse-button")[0]
            .addEventListener("click", this.handleCollapse, false);
        cont.getElementsByClassName("collapsey-label")[0]
            .addEventListener("click", this.handleLabel, false);
      }
    }
  },
  toHTMLString: function(options) {
    // container
    return "<div class='collapsey-container'" +
      (this.initiallyCollapsed ? "" : " style='display: block;'") +
      ">\n" +
      // expand button
      "  <div class='collapsey-expand-button'" +
      (this.initiallyCollapsed ? "" : " style='display: none;'") +
      ">+</div>\n" +
      // collapse button
      "  <div class='collapsey-collapse-button'" +
      (this.initiallyCollapsed ? " style='display: none;'" : "") +
      ">-</div>\n" +
      // label
      "  <div class='collapsey-label'>" + htmlEscapeText(this.label) +
      "</div>\n" +
      // contents
      "  <div class='collapse" + (this.initiallyCollapsed ? "d" : "y") +
      "-contents'>\n" +
      htmlStreamify(this.textStream, options) +
      "  </div>\n" +
      "</div>\n";
  },
};

exports.narscribblusGeneralHooks = {
  htmlDocStaticHookup: function(options) {
    options.namedCssBlocks["interactive"] = true;
    options.cssUrls.push(
      pkginfo.dataDirUrl("narscribblus/css/interactive.css"));
  }
};

exports.narscribblusReaderFuncs = {
  js: reader_js.reader_js,
  jselided: reader_js.reader_elided_js,
};

exports.narscribblusExecFuncs = {
  __proto__: man.narscribblusExecFuncs,
  collapsey: function(name, svals, tvals, ctx) {
    return new Collapsed(false, svals, tvals, ctx);
  },
  collapsed: function(name, svals, tvals, ctx) {
    return new Collapsed(true, svals, tvals, ctx);
  },

  /**
   * svals are: code block name, js code block
   */
  boilerplate: function(name, svals, tvals, ctx) {
    return new EditableCode(svals, ctx);
  },
  /**
   * svals are: code block name, js code block
   */
  exampleCode: function(name, svals, tvals, ctx) {
    return new EditableCode(svals, ctx);
  },
  /**
   * Create an editable code block for the instantiation code plus a display
   *  area that performs the actual execution.
   *
   * svals are: code block name+, js code block to run for the show
   */
  exampleShow: function(name, svals, tvals, ctx) {
    return new ExampleBlock(svals, tvals, ctx);
  },

  traceOutput: function(name, svals, tvals, ctx) {
    return new TraceOutput(svals, tvals, ctx);
  },
};

exports.narscribblusParserDepResolve = function(ctx) {
  ctx.slurpModuleContributions(jsdoc);
};

}); // end require.def
