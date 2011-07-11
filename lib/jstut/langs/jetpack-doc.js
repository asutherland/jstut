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
 * Jetpack documentation is markdown syntax with <api></api> blocks distributed
 *  throughout.  Each api tag has a name attribute.  The bad news is that the
 *  name does not have an explicit context.  The good news is that we can
 *  (hopefully) reliably infer that property/method definitions after a
 *  constructor belong to that class.
 *
 * Inside the api block are at-prefixed directives with pythonic/scribble
 *  whitespace semantics.  The first at-directive indicates the type of the name
 *  being described and its payload is a description of the type/whatever.  It
 *  is potentially followed by parameter definitions and a return value
 *  definition.  Hierarchy can be established using whitespace nesting.
 *
 * Supported types/initial at-directives and our mappings are:
 * @itemize[
 *   @item{
 *     constructor: Maps to a class.  All public Jetpack APIs do not require
 *     new to be used and will self-new, which is something to make sure the
 *     semantic logic understands.
 *   }
 *   @item{
 *     method: A method on a class.  Implicitly assigned to the last class
 *     defined by a constructor.
 *   }
 *   @item{
 *     property: A property on a class.  Implicitly assigned to the last class
 *     defined by a constructor.
 *   }
 *   @item{
 *     function: A standalone function.
 *   }
 * ]
 *
 * The jetpack doc parser just splits things into markdown or API blocks.
 *  Because we want to do our magic syntax highlighting on example code we
 *  scan through what otherwise belongs to markdown to find code blocks.  We
 *  claim them for ourselves.  Since code blocks need to be indented 4 spaces,
 *  this bit is pretty easy.
 *
 * The 'meta' result of this parse is a simple traverseChild-capable one-off
 *  namespace class holding langbits/jsdoc instances.  It is expected that if
 *  a successful source parse occurred that we will be linked into the
 *  interp-munge Symish structure and our namespace instance will be discarded.
 *  In the event the source parse failed (say, thanks to JS 1.8+-isms that
 *  explode our narcissus) or we only had docs to begin with, the consumer
 *  is expected to just use our namespace instance as-is.
 **/

define("jstut/langs/jetpack-doc",
  [
    "exports",
    "jstut-plat/package-info",
    "jstut/render/html",
    "jstut/typerep",
    "jstut/typeref",
    "jstut/docfusion",

    "jstut/readers/js",
    "jstut/render/markdown",
  ],
  function(
    exports,
    pkginfo,
    html,
    $typerep,
    $typeref,
    $docfusion,

    reader_js,
    markdown
  ) {

// authorship info ends up in these at the top of the file
var RE_COMMENT_LINE = /^<!--/;
var RE_API_LINE = /^<api/;
var RE_API_LINE_CAPTURE = /^<api name="[^"]+">$/;
var RE_API_END_LINE = /^<\/api/;
var RE_CODE_BLOCK = /^\t| {4,}/;
var RE_NEWLINE = /\r?\n/g;

var MODE_MARKDOWN = 0, MODE_EXAMPLE = 1, MODE_JETPACK_API = 2,
    MODE_HTML_TAG = 3;

/**
 * Super-trivial namespace rep that conforms to traverseChild.
 */
function TraversableNamespace() {
  this.childrenByName = {};
}
TraversableNamespace.prototype = {
  traverseChild: function(name, staticOrInstance) {
    if (name in this.childrenByName)
      return this.childrenByName[name];
    return null;
  }
};

/**
 * Break the text into lines, then do very trivial detection of code blocks
 *  (4 space indented, easy), and jetpack API blocks (<api></api>, easy), with
 *  everything else being consolidated into runs of
 *
 * @return[@listof[@list[
 *   @param["block type" @oneof
 * ]]]
 */
function blockSplitter(s, ctx) {
  var minfo = ctx.options.moduleInfo;
  var raw = (ctx.options.mode === "raw");
  if (raw)
    ctx.tokenRuns = [];

  // Mutable state object to be passed to the api block processor so that it
  //  can infer class associations.
  var apiState = {
    lastClass: null,
    namespace: new TraversableNamespace()
  };
  var blocks = [];
  var lines = s.split(RE_NEWLINE), line;
  var curMode = MODE_MARKDOWN, nextMode;
  var curRun = [];

  function flush() {
    // try and treat the example block as javascript.
    if (curMode === MODE_EXAMPLE) {
      // treat a parse failure as a fallback to the raw text.
      try {
        var jsblock = reader_js.reader_js(curRun.join("\n"), ctx)[0];
        blocks.push([MODE_EXAMPLE, jsblock]);
        return;
      }
      catch (ex) {
        console.warn("example parse issue:", ex, ex.stack);
      }
    }
    blocks.push([MODE_MARKDOWN,
                 new markdown.MarkdownBlock(curRun.join("\n") + "\n",
                                            minfo)]);
  }

  for (var i = 0; i < lines.length; i++) {
    line = lines[i];

    // Ignore the authorship comments for now; the current renderer does not use
    //  them, so presumably they are not intended to be used for reader-visible
    //  credit purposes and so can be dropped on the floor like they didn't
    //  exist (for now).
    if (RE_COMMENT_LINE.test(line))
      continue;

    if (RE_API_LINE.test(line)) {
      if (curRun.length) {
        flush();
        curRun = [];
      }
      if (raw)
        curRun.push(line);
      // the only interesting bit on the line is the name.
      var match = RE_API_LINE_CAPTURE.exec(line);
      if (!match)
        console.warn("malformed api tag line", line);

      while (!RE_API_END_LINE.test(lines[++i])) {
        curRun.push(lines[i]);
      }
      // At this point, curRun should contain everything between the api tags
      //  but neither of them.  (Unless we are in raw mode!)
      if (raw)
        curRun.push(lines[i]);

      // (if the tag was bad, we still want to have skipped stuff)
      if (match) {
        blocks.push([MODE_JETPACK_API,
                     raw ? null
                         : parseJetpackAPIBlock(match[1], curRun, apiState),
                     curRun.join("\n")]);
      }
      curRun = [];
      // (it doesn't matter what mode we leave the state in)
    }
    // not an API so it must be verbatim HTML...
    else if (line.length && (line[0] === "<")) {
      if (curMode != MODE_MARKDOWN) {
        flush();
        curRun = [];
      }

      curRun.push(line);
      while ((++i < lines.length) && lines[i].substring(0, 2) != "</") {
        curRun.push(lines[i]);
      }
      curRun.push(lines[i]);
    }
    else {
      nextMode = RE_CODE_BLOCK.test(line) ? MODE_EXAMPLE : MODE_MARKDOWN;
      if (nextMode != curMode && curRun.length) {
        flush();
        curRun = [line];
      }
      else {
        curRun.push(line);
      }
      curMode = nextMode;
    }
  }
  if (curRun.length) {
    flush();
    curRun = null;
  }

 return blocks;
}

/**
 * The jetpack docs are somewhat stylized in that "array" is used for Array,
 *  "string" for String, etc. in many places. Rather than complicate our lives
 *  elsewhere, we just define an explicit transform-it-if-you-got-it step for
 *  jetpack.
 */
var JETPACK_TYPE_MAPPING = {
  // coolified JS native types
  "array": "Array",
  "boolean": "Boolean",
  "function": "Function",
  "number": "Number",
  "object": "Object",
  "regexp": "RegExp",
  "string": "String",
  // coolified mozilla types
  "stream": "nsIInputStream", // also used for nsIOutputStream, doh.
};

/**
 * All type descriptions are comma-delimited disjunctions which may only have
 *  one thing in them and no commas.  Parse that appropriately into jsdoc
 *  @xref{TypeRef}s.
 *
 * @args[
 *   @param[typeSpecStr String]{
 *     The comma-delimited list of type names (sans squiggly braces!)
 *   }
 *   @param[namespaceContext PackageFusion]{
 *     The (package, for now) namespace in which to resolve the type.
 *   }
 * ]
 */
function parseJetpackTypeSpec(typeSpecStr, namespaceContext) {
  var typeBits = typeSpecStr.split(",");
  var typeRefs = [];
  for (var i = 0; i < typeBits.length; i++) {
    var typeName = typeBits[i].trim();
    if (!typeName)
      continue;
    if (typeName in JETPACK_TYPE_MAPPING)
      typeName = JETPACK_TYPE_MAPPING[typeName];
    typeRefs.push(new jsdoc.TypeRef(typeName, namespaceContext));
  }
  if (typeRefs.length == 1)
    return typeRefs[0];
  // since we already created the TypeRefs, it's okay to pass a null ctx.
  return new jsdoc.OneOf(typeRefs, null, null);
}

// for the first at-directive; only property should have the type payload.
var RE_FIRST_AT_LINE =
      /^@(constructor|method|function|property)(?: \{([^}]*)\})?$/;


/**
 * Process the jetpack API doc block.
 *
 * The parameter at-directive takes a name, an optional type, and can include
 *  the beginning of the description line.  If the name is encased in []'s
 *  it is optional.  If there is an equals in the []'s, the left half is the
 *  name and the right half is the default value.
 *
 * @args[
 *   @param[name String]{
 *
 *   }
 *   @param[lines @listof["line" String]]
 *   @param[state @dict[
 *     @key["lastClass"]{
 *       The last class created as a result of a constructor at-directive.
 *       This is initialized by the caller to null and mutated by this class as
 *       we see such directives.  This allows us to infer structure that the
 *       jetpack documentation format does not explicitly provide.
 *
 *       It is not foolproof.  Rather than growing the heuristic to try and
 *       infer things by looking at markdown heading blocks, it would likely
 *       make sense to get the jetpack doc standard changed or its documents
 *       re-ordered to play nicer with the heuristic.
 *     }
 *     @key["namespace" TraversableNamespace]{
 *       The namespace we are filling out.
 *     }
 *   ]]
 * ]
 * @return[Typish]{
 *   We return
 * }
 */
function parseJetpackAPIBlock(name, lines, state) {
  var firstMatch = RE_FIRST_AT_LINE.exec(lines[0]);
  if (!firstMatch)
    throw new Error("bad first line: " + lines[0]);

  var life = new $typerep.LifeStory();


  var docKind = firstMatch[1];
  // new class, the signature is describing the constructor
  if (docKind === "constructor") {
    var classType = new $typerep.ClassType(name);
    classType.constructor = new $typerep.Constructor(name, name, life);

    return classType;
  }
  // nothing to do with a class
  else if (docKind === "function") {
    var func = new $typerep.FuncInstance(name, name, life);

    return func;
  }
  // method/prop associated with the current class
  else {
    var kid;
    if (docKind === "method")
      kid = new $typerep.Method(name, name, life);
    else // (docKind === "property")
      kid = new $typerep.FieldDescriptor(name, life);

    return kid;
  }
}
exports.parseJetpackAPIBlock = parseJetpackAPIBlock;

var RE_PARAM_PROP_LINES =
      /^@(param|prop) +(\[?[^\] ]+\]?) (?:(\{[^\}]*)\})? *(.+)?$/;
var RE_RETURN_LINE =
      /^@returns? (\{[^\}]*\})? *(.+)?$/;

/**
 * Parse the param definitions with recursive nesting.  To avoid state mutation
 *  of the type representations we do this as two passes.  In the first pass we
 *  build up a tree-like simple representation and in the second pass we consume
 *  it.
 *
 * @args[
 *   @param[lines @listof[String]]{
 *   }
 * ]
 */
function gobbleParams(lines) {
  // Pairs of [nesting level, type to add to].  Only for the parents of the
  //  current active type.  So at top level, this is empty!
  var depthStack = [];
  // The indent depth of current commands.  Text indentation gets post-processed
  //  to chop off the common indentation of all of the lines (with the exception
  //  of any description on the initial command line.)
  var curCmdIndent = 0;
  // The type defined by the last directive
  var parentType = {};
  var curType = parentType, rootType = parentType;
  var cmdLineText = null, curTextLines = [], minTextIndent = null;

  function flushCurText() {
    if (!cmdLineText && !curTextLines.length)
      return;

    var text = (cmdLineText ? cmdLineText : "");
    for (var i = 0; i < curTextLines.length; i++) {
      text += curTextLines.substring(minTextIndent);
    }
    curType.text = text;

    cmdLineText = null;
    curTextLines = [];
    minTextIndent = null;
  }

  for (var i = 1; i < lines.length - 1; i++) {
    var line = lines[i];
    var leftTrimmed = line.trimLeft();
    var indentCount = line.length - leftTrimmed.count;

    var cmdMatch = RE_PARAM_PROP_LINES.exec(leftTrimmed), retMatch;
    // -- @param/@prop
    if (cmdMatch) {
      flushCurText();

      // be a kid of the current type
      if (indentCount > curCmdIndent) {
        depthStack.push([curCmdIndent, parentType]);
        parentType = curType;
        curCmdIndent = indentCount;
      }
      // pop types until we get back to the right level
      else if (indentCount < curCmdIndent) {
        while (indentCount > curCmdIndent) {
          var popped = depthStack.pop();
          curType = parentType;
          curCmdIndent = popped[0];
          parentType = popped[1];
        }
      }
      // (contribute to the current parent type)
      curType = {
        name: cmdMatch[2],
        typelist: cmdMatch[3],
        text: null,
      };
      cmdLineText = cmdMatch[4];

      if (cmdMatch[1] === "param")
        parentType.args.push(curType);
      else // (prop)
        parentType.kids[curType.name] = curType;
    }
    // -- @return
    // (should only happen at the top-level methinks)
    else if ((retMatch = RE_RETURN_LINE.exec(leftTrimmed))) {
      flushCurText();
      curType = {
        typelist: cmdMatch[1],
        text: null,
      };
      cmdLineText = cmdMatch[2];
    }
    // -- text
    // (for the current thing)
    else {
      curTextLines.push(line);
      // (don't factor in blank lines)
      if (leftTrimmed.length) {
        if (minTextIndent === null || indentCount < minTextIndent)
          minTextIndent = indentCount;
      }
    }
  }

  return rootType;
}


/**
 * Break text into markdown blocks, example blocks (per markdown syntax), and
 *  Jetpack doc API blocks which we convert into neat object trees.  No markdown
 *  expansion occurs; all markdowny blocks are instead wrapped in a wrapping
 *  block that obeys our toHTMLString idiom.
 */
exports.parse = function parse(s, ctx) {
  var options = ctx.options, minfo;
  if (!("moduleInfo" in options))
    minfo = options.moduleInfo = new $docfusion.ModuleInfo(ctx.filename, null);
  else
    minfo = options.moduleInfo;

  return {
    blocks: blockSplitter(s, ctx),
  };
};

/**
 * For now, it just passes the parse results through verbatim, but in the future
 *  we might do something with the example code rather than let it sit idle.
 */
exports.expand = function expand(parsed, ctx) {
  return parsed;
};

/**
 * Very primitive syntax highlighting of the source; just the high-level blocks.
 */
function processRaw(parsed, ctx) {
  var htmlBlocks = [];
  for (var i = 0; i < parsed.blocks.length; i++) {
    var block = parsed.blocks[i];
    var blockKind = block[0];
    switch (blockKind) {
      case MODE_MARKDOWN:
        htmlBlocks.push("<div class='block-markdown'>" +
          html.htmlEscapeText(block[1].text) +
          "</div>");
        break;
      case MODE_EXAMPLE:
        htmlBlocks.push(block[1]);
        break;
      case MODE_JETPACK_API:
        htmlBlocks.push("<div class='block-jetpack-doc'>");
        htmlBlocks.push(html.htmlEscapeText(block[2]));
        htmlBlocks.push("</div>");
        break;
    }
  }

  return {
    body: html.htmlDocify(
      htmlBlocks,
      ctx,
      [pkginfo.dataDirUrl("jstut/css/jetpack-doc-raw.css")]),
    liveject: null,
  };
}

/**
 * Render the doc stream into HTML.
 */
function processDocStream(parsed, ctx) {
  var htmlBlocks = parsed.blocks.map(function (b) {return b[1];});
  return {
    body: html.htmlDocify(
      htmlBlocks,
      ctx,
      []),
    liveject: null,
  };
}

/**
 * Nop because all we want is our ModuleInfo byproduct available.
 */
function processMeta(parsed, ctx) {
  return;
}

/**
 * HTMLifies the results of expansion.  That's it.
 */
exports.process = function process(parsed, ctx) {
  switch (ctx.options.mode) {
    case "raw":
      return processRaw(parsed, ctx);
    case "meta":
      return processMeta(parsed, ctx);
    default:
      return processDocStream(parsed, ctx);
  }
};




}); // end define

