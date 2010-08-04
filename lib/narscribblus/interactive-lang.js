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
var syn = require("narscribblus/scribble-syntax");
var reader_js = require("narscribblus/reader-js");
var man = require("narscribblus/manual-lang");

var bespinLoader = require("narscribblus/bespin-loader");
var sandboxer = require("narscribblus/sandboxer-jetpack");

exports.parse = function parse(s, ctx) {
  return syn.textStreamAtBreaker(s, ctx);
};

exports.expand = function expand(nodes, ctx) {
  return man.textStreamChewer(nodes, ctx);
};

/**
 * Build an HTML document
 */
exports.process = function process(nodes, ctx) {
  ctx.options.livejecters = [];
  ctx.options.codeBlocks = {};


  return {
    body: man.htmlDocify(nodes, ctx.options),
    liveject: function(doc, win) {
      // -- load bespin in and queue up the livejecters to run once loaded
      function runLivejecters() {
        console.log("*** post-bespin loader, running livejecters");
        var livejecters = ctx.options.livejecters;
        for (var i = 0; i < livejecters.length; i++) {
          livejecters[i].liveject(doc, ctx.options);
        }
      }
      console.log("*** bespin loader triggering bespin load");
      bespinLoader.loadBespin(doc, runLivejecters);
    },
  };
};

exports.narscribblusReaderFuncs = {
  js: reader_js.reader_js,
};

function countLinesInString(s) {
  var idx = -1, count = 1;
  while ((idx = s.indexOf("\n", idx + 1)) != -1) {
    count++;
  }
  return count;
}

function EditableCode(svals, ctx) {
  if (typeof(svals[0]) !== "string")
    throw new Error("first sval to EditableCode needs to be a name");
  if (!(svals[1] instanceof reader_js.JSBlock))
    throw new Error("second sval to EditableCode needs to be js code");
  this.name = svals[0];
  this.code = svals[1];
  this.updateListeners = [];

  if (!("codeBlocks" in ctx.options))
    ctx.options.codeBlocks = {};
  ctx.options.codeBlocks[this.name] = this;
}
EditableCode.prototype = {
  /**
   * Generate an empty div to be the editor and the span for our apply button.
   *  (We start the div empty mainly so I can avoid needing to escape the
   *   text.)
   */
  toHTMLString: function(options) {
    var height = countLinesInString(this.code.text) * 22;
    options.cssBlocks.push("#edcode-" + this.name + " { " +
                           "height: " + height + "px; " +
                           "border: 1px solid gray; " +
                           // there is some weird box display artifact
                           //  offsetting everything by ~16px extra...
                           "padding-bottom: 16px; " +
                           "}");
    options.livejecters.push(this);
    var s = "<div id='edcode-" + this.name + "'></div>";
    s += "<span id='edcode-apply-" + this.name + "' class='edcode-apply'>" +
           "Apply Changes</span>";
    return s;
  },
  /**
   * Turn our div into a bespin editor, hook up our span to update our fellows.
   */
  liveject: function(doc, ctx) {
    var dis = this;
    this.bespinEnv = null;
    // fill in the text
    var edDiv = doc.getElementById("edcode-" + this.name);
    edDiv.textContent = this.code.text;
    // make it a bespin editor
    console.log("doing bespin hookup on", this.name);
    doc.defaultView.wrappedJSObject.bespin.useBespin("edcode-" + this.name, {
        syntax: "js",
    }).then(function(env) {
      console.log("!!! got env", env);
      dis.bespinEnv = env;
    });

    // hook up our apply button
    var applySpan = doc.getElementById("edcode-apply-" + this.name);
    applySpan.addEventListener("click", function(event) {
      console.log("You clicked on the apply button of", dis.name);
      dis.code.text = dis.bespinEnv.editor.value;
      console.log("Revised code to be:", dis.code.text);
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

    var globals = {};
    for (var iRun = 0; iRun < this._preRuns.length; iRun++) {
      this._preRuns[iRun].preCodeRun(globals);
    }

    this.sandbox = sandboxer.makeSandbox(codeSnippets.join("\n"), globals);
  },

  go: function(aPreRuns) {
    this._preRuns = aPreRuns;
    this.active = true;
    this._buildSandboxAndRun();
  }
};

function DisplayArea(name, ctx) {
  this.name = name;
}
DisplayArea.prototype = {
  /**
   *  generate the DOM node where we will bind our display result in.
   */
  toHTMLString: function() {
    return "<div id='darea-" + this.name + "' />";
  },

  bindIntoReality: function(doc, ctx) {
    this.domNode = doc.getElementById("darea-" + this.name);
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
 * Glues together an EditableCodeBlock with a DisplayArea and the CodeExecution
 *  block that crams things in it.
 */
function ExampleBlock(svals, ctx) {
  var blockNames = [];
  var aggrName = null;
  var ourcode = null;
  for (var i = 0; i < svals.length; i++) {
    var sval = svals[i];
    if (typeof(sval) === "string") {
      if (ourcode)
        throw new Error("No more strings after the JS code in ExampleBlock");
      blockNames.push(sval);
      if (aggrName)
        aggrName += "-" + sval;
      else
        aggrName = sval;
    }
    else if (sval instanceof reader_js.JSBlock) {
      ourcode = sval;
    }
    else {
      throw new Error("ExampleBlock does not know what to do with: " + sval);
    }
  }

  this.editableCode = new EditableCode([aggrName, ourcode], ctx);
  this.displayArea = new DisplayArea(aggrName, ctx);
  this.codeExec = new CodeExecution(blockNames.concat([aggrName]), ctx);

  this.aggrName = aggrName;
  this.runRev = 0;
}
ExampleBlock.prototype = {
  toHTMLString: function(options) {
    var s = this.editableCode.toHTMLString(options) +
            this.displayArea.toHTMLString(options);
    // (make sure we end up in the livejecter list after our children)
    options.livejecters.push(this);
    return s;
  },

  liveject: function(doc, ctx) {
    console.log("** livejecting example block", this.aggrName);
    this.displayArea.bindIntoReality(doc, ctx);
    this.codeExec.go([this, this.displayArea]);
  },

  preCodeRun: function(globals) {
    this.runRev++;
    globals.exampleName = "run-" + this.aggrName + "-" + this.runRev;
  },
};

exports.narscribblusExecFuncs = {
  __proto__: man.narscribblusExecFuncs,
  collapsed: function(name, svals, tvals, ctx, chewer) {
    return new man.Fragment(chewer(tvals, ctx));
  },

  /**
   * svals are: code block name, js code block
   */
  boilerplate: function(name, svals, tvals, ctx, chewer) {
    return new EditableCode(svals, ctx);
  },
  /**
   * svals are: code block name, js code block
   */
  exampleCode: function(name, svals, tvals, ctx, chewer) {
    return new EditableCode(svals, ctx);
  },
  /**
   * Create an editable code block for the instantiation code plus a display
   *  area that performs the actual execution.
   *
   * svals are: code block name+, js code block to run for the show
   */
  exampleShow: function(name, svals, tvals, ctx, chewer) {
    return new ExampleBlock(svals, ctx);
  },

};
