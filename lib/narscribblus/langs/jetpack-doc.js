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

require.def("narscribblus/langs/jetpack-doc",
  [
    "exports",
    "narscribblus/langbits/jsdoc",
  ],
  function(
    exports,
    jsdoc
  ) {

// authorship info ends up in these at the top of the file
var RE_COMMENT_LINE = /^<!--/;
var RE_API_LINE = /^<api/;
var RE_API_LINE_CAPTURE = /^<api name="[^"]+>$/;
var RE_API_END_LINE = /^<\/api/;
var RE_CODE_BLOCK = /^\t| {4,}/;
var RE_NEWLINE = /\r?\n/g;

var MODE_MARKDOWN = 0, MODE_EXAMPLE = 1, MODE_JETPACK_API = 2;

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
function blockSplitter(s) {
  // Mutable state object to be passed to the api block processor so that it
  //  can infer class associations.
  var apiState = {
    lastClass: null,
    namespace: new TraversableNamespace()
  };
  var blocks = [];
  var lines = s.split(RE_NEWLINE);
  var curMode = MODE_MARKDOWN, nextMode;
  var curRun = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    
    // Ignore the authorship comments for now; the current renderer does not use
    //  them, so presumably they are not intended to be used for reader-visible
    //  credit purposes and so can be dropped on the floor like they didn't
    //  exist (for now).
    if (RE_COMMENT_LINE.test(line))
      continue;
    
    if (RE_API_LINE.test(line)) {
      if (curRun.length) {
        block.push([curMode, curRun]);
        curRun = [];
      }
      // the only interesting bit on the line is the name.
      var match = RE_API_LINE_CAPTURE.exec(line);
      if (!match)
        console.warn("malformed api tag line", line);
      
      while (!RE_API_END_LINE.test(lines[++i])) {
        curRun.push(lines[i]);
      }
      // at this point, curRun should contain everything between the api tags
      //  but neither of them.
      if (match) { // (if the tag was bad, we still want to have skipped stuff)
        blocks.push([MODE_JETPACK_API,
                     parseJetpackAPIBlock(match[1], curRun, apiState)]);
      }
      curRun = [];
      // (it doesn't matter what mode we leave the state in)
    }
    else {
      nextMode = RE_CODE_BLOCK.test(line) ? MODE_EXAMPLE : MODE_MARKDOWN;
      if (nextMode != curMode && curRun.length) {
        blocks.push([curMode, curRun]);
        curRun = [line];
      }
      else {
        curRun.push(line);
      }
      curMode = nextMode;
    }
  }
  if (curRun.length) {
    blocks.push([curMode, curRun]);
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
  /^@(constructor|method|function|property)(?: \{([^}]*\})$/;

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
 * @return[DocNode]{
 *   We return 
 * }
 */
function parseJetpackAPIBlock(name, lines, state) {
  
  
}

/**
 * Break text into markdown blocks, example blocks (per markdown syntax),
 *  and Jetpack doc API blocks which we fully parse.  No markdown expansion
 *  whatsoever occurs (mainly for testing reasons); all markdowny blocks are
 *  instead wrapped in a wrapping block that obeys our toHTMLString idiom.
 */
exports.parse = function parse(s, ctx) {
};

/**
 * For now, it just passes the parse results through verbatim, but in the future
 *  we might do something with the example code rather than let it sit idle.
 */
exports.expand = function expand(parsed, ctx) {
};

/**
 * HTMLifies the results of expansion.  That's it.
 */
exports.process = function process(parsed, ctx) {
};




});

