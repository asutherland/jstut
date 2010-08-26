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
var syn = require("narscribblus/readers/scribble-syntax");
var reader_js = require("narscribblus/readers/js");
var render_js = require("narscribblus/render/js");

var self = require("self");

var man = require("narscribblus/langs/manual");
var decodeFlow = man.decodeFlow;
var html = require("narscribblus/render/html");
var htmlDocify = html.htmlDocify, htmlStreamify = html.htmlStreamify,
    htmlEscapeText = html.htmlEscapeText;

var astinterp = require("narscribblus/ctags/interp");

var bespinLoader = require("narscribblus/bespin-loader-jetpack");
var sandboxer = require("narscribblus/sandboxer-jetpack");
var jsparse = require("narscribblus/narcissus/jsparse");

exports.parse = function parse(nodes, ctx) {
  ctx.options.codeBlocks = {};
  ctx.options.exampleBlockContributions = {};
  return man.parse(nodes, ctx);
};

exports.expand = function expand(nodes, ctx) {
  ctx.interpbox = new astinterp.InterpSandbox();
  ctx.options.codeBlocks = {};
  return decodeFlow(man.textStreamChewer(nodes, ctx));
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
  ctx.options.livejecters = [];
  // We use the constructor name to indicate whether we've seen something or
  //  not.  it's on the language to make sure it has no collisions in the
  //  emergent namespace.
  ctx.options.oneOffLivejectersSeen = {};

  return {
    body: htmlDocify([new PageControlNode(ctx)].concat(nodes), ctx),
    liveject: function(doc, win) {
      // -- load bespin in and queue up the livejecters to run once loaded
      function runLivejecters() {
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
 * An editable block of code.
 *
 * Life-cycle interaction of this fellow:
 * @itemize[
 *   @item{Created in document order by textStreamChewer or whatever is driving
 *         the expansion process.  Contributes itself to ctx.options.codeBlocks
 *         so that CodeExecution instances can find it; they are only
 *         instantiated during livejection phase to make sure that all of us
 *         EditableCode instances can be found.}
 *   @item{During process-driven htmlification, it registers itself as a
 *         livejecter.}
 *   @item{During livejection, it hooks its UI up so that you can make a bespin
 *         editor edit the code.}
 *   @item{During steadystate, hitting 'apply changes' triggers codeUpdated
 *         notifications to everyone who found us via ctx.options.codeBlocks and
 *         added themselves to our updateListeners list during livejection (or
 *         later).}
 * ]
 */
function EditableCode(svals, ctx) {
  if (typeof(svals[0]) !== "string")
    throw new Error("first sval to EditableCode needs to be a name");
  if (!(svals[1] instanceof reader_js.JSBlock))
    throw new Error("second sval to EditableCode needs to be js code");
  this.name = svals[0];
  this.code = svals[1];
  this.updateListeners = [];

  ctx.options.codeBlocks[this.name] = this;

  // XXX ast interpretation fun
  //ctx.interpbox.processAnonSnippet(this.code.script, this.name);
}
EditableCode.prototype = {
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
    s += render_js.htmlifyJSBlock(this.code, options);
    s += '  <div id="edcode-editor-' + this.name +
           '" class="edcode-editor"></div>\n';
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
      // make it a bespin editor
      var trueWin = ("wrappedJSObject" in doc.defaultView) ?
                                 doc.defaultView.wrappedJSObject :
                                 doc.defaultView;
      trueWin.bespin.useBespin(
        "edcode-editor-" + dis.name, {syntax: "js",}
      ).then(function(env) {
        dis.bespinEnv = env;
        env.dimensionsChanged();
      });
    }, false);

    // hook up our apply button
    var applySpan = doc.getElementById("edcode-apply-" + this.name);
    applySpan.addEventListener("click", function(event) {
      dis.code.text = dis.bespinEnv.editor.value;
      // ask narcissus to see if there are syntax errors in the code...
      var problem = jsparse.syntaxCheck(dis.code.text);
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

      for (var i = 0; i < dis.updateListeners.length; i++) {
        dis.updateListeners[i].codeUpdated(dis);
      }
    }, false);
  }
};

/**
 * At runtime triggering, builds some form of sandbox to execute the code
 *  present in the referenced code blocks.
 */
function CodeExecution(blockNames, ctx) {
  this.active = false;
  var edcodes = this.edcodes = [];
  for (var i = 0; i < blockNames.length; i++) {
    var edcode = ctx.options.codeBlocks[blockNames[i]];
    edcodes.push(edcode);
    edcode.updateListeners.push(this);
  }
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
    this.sandbox = sandboxer.makeSandbox(codeSnippets.join("\n"), globals,
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
    this._buildSandboxAndRun();
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
    this.codeExec = new CodeExecution(this.blockNames, this.ctx);
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
    options.cssBlocks.push(self.data.load("css/interactive.css"));
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
  ctx.slurpModuleContributions(require("narscribblus/langbits/jsdoc"));
};
