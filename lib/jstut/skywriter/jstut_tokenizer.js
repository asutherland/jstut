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

define(
  [
    "narscribblus/narcissus/jsparse",
    "narscribblus/narcissus/jsdefs",
    "narscribblus/docfusion",
    "narscribblus/ctags/interp",
    "narscribblus/traverser",
    "narscribblus/typerep",
    "narscribblus/interp-munge",
    "exports"
  ],
  function(
    $jsparse,
    $jsdefs,
    $docfusion,
    $interp,
    $traverser,
    $typerep,
    $munge,
    exports
  ) {


var tokenIds = $jsdefs.tokenIds;

var traverser = new $traverser.SynTraverser;

const STRING = tokenIds["STRING"],
      COMMENT_LINE = tokenIds["COMMENT_LINE"],
      COMMENT_BLOCK = tokenIds["COMMENT_BLOCK"];

/** The legal token types recognized by the ACE themes right now. */
var allowedClasses = {
  "comment": true,
  "string.regexp": true,
  "string": true,
  "constant.numeric": true,
  "constant.language.boolean": true,
  "variable.language": true,
  "keyword": true,
  "constant.language": true,
  "invalid.illegal": true,
  "invalid.deprecated": true,
  "identifier": true,
  "keyword.operator": true,
  "lparen": true,
  "rparen": true,
  "text": true,
  "comment.doc": true,
};

/**
 * Token mappings based on render/js largely converted
 */
var cssClassSourceTokens = {
  "comment.elided": ["ELIDED"],

  // -- comments
  comment: ["COMMENT_BLOCK", "COMMENT_LINE"],

  // -- keywords
  // - control flow
  "keyword.conditional":
    ["BREAK", "CASE", "CONTINUE", "DEFAULT", "ELSE", "IF", "SWITCH"],
  "keyword.loop": ["DO", "FOR", "WHILE"],

  // - function decls
  "keyword.function": ["FUNCTION"],

  // - exception handling
  "keyword.errhandling": ["CATCH", "FINALLY", "THROW", "TRY"],

  // - variable declaration
  "keyword.vardecl": ["CONST", "LET", "VAR", "WITH"],

  // - variable nuking
  "operator.nuking": ["NEW", "DELETE"],

  // - value returning
  "keyword.return": ["YIELD", "RETURN"],

  // - magic
  "invalid.deprecated": ["DEBUGGER"],
  "variable.language": ["THIS"],

  // - reserved / unused
  "invalid.illegal": ["ENUM", "VOID"],


  // - boolean literals
  "constant.language.boolean": ["FALSE", "TRUE"],
  // - null/undefined
  "constant.language": ["NULL"], // no undefined right now?

  // -- punctuation
  // - boring
  "keyword.operator.semicolon": ["SEMICOLON"],
  "keyword.operator.comma": ["COMMA"],

  lparen: ["LEFT_BRACKET", "LEFT_CURLY", "LEFT_PAREN"],
  rparen: ["RIGHT_BRACKET", "RIGHT_CURLY", "RIGHT_PAREN"],

  // -- operators
  "keyword.operator.type": ["IN", "INSTANCEOF", "TYPEOF"],

  "keyword.operator.dot": ["DOT"],

  // - interesting
  "keyword.operator": ["OR", "AND", "BITWISE_OR", "BITWISE_XOR", "BITWISE_AND",
      "URSH", "RSH", "PLUS", "MINUS", "MUL", "DIV", "MOD",],

  // - comparators
  "keyword.operator.comparator":
    ["STRICT_EQ", "EQ", "STRICT_NE", "NE", "GE", "GT"],
  // - mutating
  "keyword.operator.assignment": ["ASSIGN"],
  // - inc/dec
  "keyword.operator.incdec": ["INCREMENT", "DECREMENT"],

  // - unary
  "keyword.operator.unary": ["UNARY_PLUS", "UNARY_MINUS",
       "NOT", "BITWISE_NOT"],

  // - ternary
  "keyword.operator.ternary": ["HOOK", "COLON"],

  "identifier": ["IDENTIFIER"],
  "constant.numeric": ["NUMBER"],
  "string": ["STRING"],
  "string.regexp": ["REGEXP"],
};

var tokenIdToAceType = {};
function buildTokenToCssMap() {
  for (var cssClass in cssClassSourceTokens) {
    var tokenNames = cssClassSourceTokens[cssClass];
    // If the cssClass is not allowed, trim off the rightmost ellipsis thing
    //  and repeat the check.  If there is nothing to trim, just use it as-is.
    while (!(cssClass in allowedClasses) && cssClass.indexOf(".") != -1) {
      var classBits = cssClass.split(".");
      classBits = classBits.slice(0, classBits.length - 1);
      cssClass = classBits.join(".");
    }
    for (var i = 0; i < tokenNames.length; i++) {
      tokenIdToAceType[tokenIds[tokenNames[i]]] = cssClass;
    }
  }
}
buildTokenToCssMap();

/**
 * Return true if the given character is a valid identifier (non-first)
 *  character.  The first character of identifiers are constrained, but this
 *  function does not handle that case.
 *
 * XXX shares lexIdent's unicode blindness.
 */
function isIdentChar(ch) {
  return ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
         (ch >= '0' && ch <= '9') || ch === '$' || ch === '_');
}

/**
 * Given an interpreter node from the abstract interpreter that is a scope,
 *  wrap/flatten it into a nice
 *
 * @args[
 *   @param[interpScope InterpScope]
 * ]
 * @return[TypeRep]
 */
function buildScopeNamespace(interpScope) {
  var modInfo = null; // dummy this until it turns out we need it.
  var ns = new $typerep.Namespace("scope", new $typerep.LifeStory(modInfo));
  for (var scope = interpScope; scope; scope = scope.parent) {
    for (var key in scope.data) {
      ns.childrenByName[key] =
        $munge.munge(scope.data[key], modInfo, key, [ns], true);
    }
  }

  return ns;
}

/**
 * A "tokenizer" that harnesses the awesome power of jstut and narcissus to
 *  actually parse the javascript code and provide exciting results back.
 *
 * We aspire to provide somewhat usable code completion.  The trick, of course,
 *  is that at the point the user actually wants completion, they may have typed
 *  just enough to cause the parse to fail.  Although we can recover the token
 *  log for syntactic tokens, abstract interpretation will never work
 *  sufficiently because so much of the parse state will be destroyed by the
 *  exception on the way out.
 *
 * Our attempt to deal with this is to remember the state of the parse tree
 *  at our last successful parse and to figure out the input delta from that
 *  point.  This requires that changes be limited to a single line; we will
 *  discard the parse tree entirely if this is not true.
 *
 * Working from the line delta, we can break the input situations down like so:
 * - The start of the delta was inside an OBJECT_INIT:
 *   - the user has not typed a colon yet, so we are looking for valid keys.
 *   - the user has typed a colon, so we want to complete based on the value
 *      that corresponds to whatever the key thing is prior to the colon.
 * - The start of the delta was inside an ARRAY_INIT, in which case we want
 *    to complete on our position in the list.  Because this situation should
 *    be valid most of the time (trailing commas are okay), we key the
 *    positional index on the delta point.
 * - For any other context, we assume the user is trying to reference a
 *    variable.  We would expect things to basically take the form
 *    "A.B = C.D".  Things are valid for "A" until the period is typed; we can
 *    consult the delta and see the "." and infer we want to look-up an
 *    attribute of A.  B is fine (although unlikely to resolve while being
 *    partially typed).  As soon as we hit the assignment operator, we will
 *    get a parse failure until we start to type something.  We could do a
 *    delta scan and see the operator and decide it's a lexically scoped
 *    lookup.  The C.D case is the same as A.B.
 * (And obviously once the user starts to type and things become legal again,
 *  there is the possibility that they have only typed a partial resolution
 *  of something, in which case we may need to figure out the thing's context
 *  to get the entire set of legal values again.)
 *
 * In order to find OBJECT_INIT/ARRAY_INIT containment, the easiest thing for
 *  us to do is to scan either backwards in the token list looking for our
 *  abstract interpretation annotated data.  (We scan backwards rather than
 *  forwards because we currently do not annotate the end tokens for an object
 *  or array).  We will either hit the start of the array/object with its
 *  meta-info, or a key/value/item in the object/array which will have a link
 *  to the object/array and its meta-info.
 *
 */
function JstutTokenizer(fallbackTokenizer, env) {
  this.tokenLines = [];
  this.lastGoodTokenLines = null;
  this.lastGoodLines = null;
  this.modifiedLine = null;
  this.fallbackTokenizer = fallbackTokenizer;
  this.env = env;

  this.preAsts = null;
}
JstutTokenizer.prototype = {
  wholeDocumentParser: true,

  /**
   * Attempt to parse the document.
   *
   * @args[
   *   @param[lines @listof[String]]{
   *     The entirety of the document to parse as an array of strings.  No
   *     newlines should be present on the strings.
   *   }
   * ]
   * @return[@dict[
   *   @key[firstBadLine Number]{
   *     The first line that the parser failed to process.  Currently any
   *     parse failure results in a total failure without recovery, so we will
   *     either return 0 or the number of lines in the input document.  (Or,
   *     if the event of information loss in our token round-tripping, we may
   *     return less; a warning will be reported via console.warn in that case
   *     and visual artifcats will result.)
   *   }
   * ]]
   */
  parse: function(lines) {
    var programText = lines.join("\n");

    try {
      var parsed = $jsparse.parseUntilRightCurly(
                     programText, "#skywriter#", 1, null,
                     false, // no need to normalize whitespace
                     true // do not kill excise the right curly
                   );
      // it's possible an extra right curly could kill us prematurely.  treat
      //  that as a failure.
      if (parsed.tokenizer.cursor != programText.length) {
        console.error("Should have parsed up everything but cursor:",
                      parsed.tokenizer.cursor, "with program length:",
                      programText.length);
      }

      // Scan the token log, breaking the tokens out into lines.
      var tokenLog = parsed.tokenizer.tokenLog;
      var curLine = [];
      var tokenLines = this.tokenLines = [curLine];
      for (var i = 0; i < tokenLog.length; i++) {
        var token = tokenLog[i];
        // fastpath newline
        if (token === "\n") {
          curLine = [];
          tokenLines.push(curLine);
        }
        // pure string...
        else if (typeof(token) === "string") {
          // it might end in a newline, in which case slice and handle
          if (token[token.length - 1] === "\n") {
            curLine.push(token.substring(0, token.length - 1));
            curLine = [];
            tokenLines.push(curLine);
          }
          else {
            curLine.push(token);
          }
        }
        // - COMMENT_LINE implies a newline...
        else if (token.type === COMMENT_LINE) {
          curLine.push(token);
          curLine = [];
          tokenLines.push(curLine);
        }
        // comment blocks can have newlines in them; we need to fragment
        else if (token.type === COMMENT_BLOCK) {
          var blockBits = token.value.split("\n");
          curLine.push({type: COMMENT_BLOCK,
                        value: "/*" + blockBits[0],
                        trueToken: token});
          for (var iBlockBit = 1; iBlockBit < blockBits.length; iBlockBit++) {
            curLine = [{type: COMMENT_BLOCK,
                        value: blockBits[iBlockBit],
                        trueToken: token}];
            tokenLines.push(curLine);
          }
          curLine[curLine.length - 1].value += "*/";
        }
        // XXX we may need to fragment multi-line strings of STRING type just
        //  like we do for COMMENT_BLOCK.
        else {
          curLine.push(token);
        }
      }

      if (tokenLines.length != lines.length) {
        console.warn("parsed line count:", tokenLines.length,
                     "input line count:", lines.length);
      }

      // we performed a complete parse here.  let's try and initiate an
      //  abstract intepretation pass...
      if (!("interpbox" in this.env))
        this.env.interpbox = new $interp.InterpSandbox($docfusion.docFusion);
      console.log("triggering abstract interp");
      this.env.interpbox.processAnonSnippet(this.preAsts,
                                            parsed.script,
                                            "#skywriter#");

      this.lastGoodTokenLines = this.tokenLines;
      this.lastGoodLines = lines;
      this.modifiedLine = null;

      return {
        firstBadLine: tokenLines.length,
      };
    }
    catch(ex) {
      // for now, treat all parse failures as complete failures
      this.tokenLines = [];
      return {
        firstBadLine: 0,
      };
    }
  },

  /**
   * Tells us to dump our last-good parse state because sufficient changes
   *  have occurred that we have no idea what's happening.
   */
  nukeState: function() {
    this.lastGoodTokenLines = null;
  },

  /**
   * Tells us that a single line has changed.  We need to make sure that either
   *  no lines have changed since our last good state or this is the same line
   *  that has changed.  Otherwise we need to nuke our state.
   */
  lineChanged: function(iRow, newText) {
    if (this.modifiedLine != null && this.modifiedLine !== iRow) {
      this.nukeState();
      return;
    }
    // (state is still good!)
    this.modifiedLine = iRow;
    this.modifiedLineValue = newText;
  },

  /**
   * Given the old line contents and the new line contents, figure out the
   *  inserted string and the point at which the insertion is happening.
   *  As a drastic simplification, we assume that text can only be appended.
   *  We also assume that since a parsable => non-parsable transition occurred,
   *  there is implicitly some form of effective delimeter separating the
   *  first character of the inserted text from whatever precedes it at the
   *  point.
   *
   * Once we know the insertion point, we can use that to the context
   *  (OBJECT_INIT/ARRAY_INIT/argument) of the point.
   *
   * @return[@dict[
   *   @key[added String]
   *   @key[column Number]{
   *     The column at which the insertion takes place.
   *   }
   * ]]
   */
  figureLineDelta: function() {
    var oldText = this.lastGoodLines[this.modifiedLine];
    var newText = this.modifiedLineValue;

    // see if the append-only invariant holds, bail if not
    if (newText.substring(0, oldText.length) !== oldText)
      return null;

    return {
      added: newText.substring(oldText.length),
      column: oldText.length,
    };
  },

  /**
   * Attempt to provide autocomplete information for the provided location.
   *
   * We currently make the following simplifying assumptions that are not
   *  great:
   * @itemize[
   *   @item{
   *     The parser is invoked every time incremental changes to the document
   *     result in a legal-to-parse document.  This means that when we are in
   *     an illegal-parse-state, the delta from the last legal state will be
   *     the smallest delta from the last legal parse state.
   *
   *     This erroneously presumes that the parser fires after every text
   *     change, which is not the case because of the various timeouts at play.
   *     The savings is that if the user types "foo.bar." we can presume that
   *     we got a legal parse in at "foo.bar" and so do not need to process
   *     the traversal ourselves.
   *   }
   *   @item{
   *     No one subscripts stuff using foo["bar"] or foo[bar].  The former is
   *     something that we can handle with some help.  The latter just ends up
   *     being statically impossible to resolve unless foo is a `DictOf` in
   *     which case it ends up tractable if we're trying.
   *   }
   * ]
   *
   * @return[@dict[
   *   @key[context #:optional TypeRep]{
   *     What is the typerep for the context in which the user is trying to
   *     complete something.  For example, in a code block this would be the
   *     lexical namespace (if available).  In an object initializer with a
   *     constrained type this would be the `Dict`/`DictOf` instance.  If the
   *     user has typed "foo.*" this would be the typerep for whatever foo is.
   *   }
   *   @key[typeConstraint #:optional TypeRep]{
   *     XXX not yet implemented:
   *     The typerep describing the valid options for the point of completion.
   *
   *     For example, if the completion point is inside an argument list, this
   *     is the type descriptor for the given argument slot.  If the completion
   *     point is in an object initializer and there is already a colon on
   *     the line, we use the descriptor for the value the matches the key.
   *   }
   *   @key[completionSource #:optional TypeRep]{
   *     The thing providing us with the completions.  This may be the same as
   *     the context, or it may not if there is a reference in play.
   *   }
   *   @key[completions @listof[Object]]{
   *     A list of the typereps for legal values for insertion at the point.
   *     The actual text to insert will be the "name" attribute on the types.
   *     In the event some partial typing has already occurred, thereby
   *     constraining the list, it is still on the caller to do substring stuff
   *     using `typedSoFar` so that only the required incremental text is
   *     inserted.
   *   }
   *   @key[typedSoFar String]{
   *     What has the user typed so far that is part of the search query.  If
   *     The user has typed "foo.ba" then this would be "ba".  If the user has
   *     typed "foo" then this would be "".
   *   }
   * ]]
   */
  getAutocompleteInfoAt: function(iRow, iCol) {
    // we always want to use the last good parse
    var tokenLines = this.lastGoodTokenLines, lines = this.lastGoodLines;
    var typedSoFar, pointType, cinfo;

    // failure helper that logs and formulates a non-answer response
    function bail(why) {
      console.info("bailing on autocomplete because: " + why);
      return {
        context: null,
        typeConstraint: null,
        completions: [],
        typedSoFar: "",
      };
    }

    // -- If the current parse is good, infer context from position.
    if (this.lastGoodTokenLines === this.tokenLines) {
      var rightChar = (iCol === lines[iRow].length) ? " " : lines[iRow][iCol],
          leftChar = (iCol === 0) ? " " : lines[iRow][iCol - 1];
      var skipCount = 0;
      // commas are not words and will allow a legal parse
      if (leftChar === "," || leftChar === "{")
        leftChar = " ";
      if (leftChar === ".") {
        leftChar = " ";
        // pretend the stupid period does not exist
        iCol--;
      }

      var token;
      // - in a word/at the end of one, need to filter (ex: "f|oo", "foo|")
      if (leftChar !== " ") {
        skipCount = 1;
        cinfo = this.findContextOfPoint(iRow, iCol, skipCount);
        var relOff = {};
        token = this.getTokenInfoAt(iRow, iCol - 1, false, relOff);
        return {
          context: cinfo.context,
          constraint: cinfo.constraint,
          completionSource: cinfo.pointType,
          completions: this._filterCompletions(
                         cinfo.pointType,
                         token.value.substring(relOff.start,
                                               relOff.value + 1)),
        };
      }
      // - at the start of a word, replacement semantics, no filter, same as
      // else if (rightChar !== " ") {
      // - on whitespace, no filter
      else {
        cinfo = this.findContextOfPoint(iRow, iCol, skipCount);
        return {
          context: cinfo.context,
          constraint: cinfo.constraint,
          completionSource: cinfo.pointType,
          completions: this._filterCompletions(cinfo.pointType),
        };
      }
    }

    // -- Last parse was bad, require modline, use delta magic and infer.
    else if (iRow === this.modifiedLine) {
      var lineDelta = this.figureLineDelta();
      // - infer the context
      cinfo = this.findContextOfPoint(iRow, iCol - lineDelta.length);
      if (!cinfo)
        return bail("unable to find context at point");

      // - figure the kind of traversal given what made us go illegal
      switch (lineDelta.added[0]) {
        // attribute traversal => use children of previous token
        case ".":
          typedSoFar = lineDelta.added.substring(1);
          return {
            context: cinfo.context,
            typeConstraint: null,
            completionSource: cinfo.pointType,
            completions: this._filterCompletions(cinfo.pointType, typedSoFar),
            typedSoFar: typedSoFar
          };

        // function invocation (or construction) => use arglist of prev token
        case "(":
          typedSoFar = lineDelta.added.substring(1);
          var csource = cinfo.pointType || cinfo.context;
          return {
            context: cinfo.context,
            typeConstraint: cinfo.constraint,
            completionSource: csource,
            completions: this._filterCompletions(csource, typedSoFar),
          };

        // subscripting => beyond us, per assumptions
        case "[":
          return bail("subscripting is too tricky");

        // probably in an OBJECT_INIT...
        // (note: we ignore getter/setter syntax, but it would not be terribly
        //  hard to deal with this.)
        default:
          // the question is then whether we have seen a colon or not.
          var idxColon = lineDelta.added.indexOf(":");
          // - key case (no colon)
          if (idxColon === -1) {
            typedSoFar = lineDelta.added;
            return {
              context: cinfo.context,
              completionSource: pointType,
              completions: this._filterCompletions(cinfo.pointType,
                                                   typedSoFar, true),
            };
          }
          // - value case (yes colon)
          // note: this is only the case when we have "foo: " but with nothing
          //  after it; it becomes legal as soon as a letter gets typed (and
          //  we re-parse)
          else {
            var keyName = lineDelta.added.substring(0, idxColon).trim();
            // this should end up empty, but in case we are faster than the
            //  parser...
            typedSoFar = lineDelta.added.substring(idxColon + 1).trim();
            pointType = cinfo.pointType.traverseChild(keyName);
            return {
              context: cinfo.context,
              completionSource: pointType,
              completions: this._filterCompletions(pointType, typedSoFar),
            };
          }
          break;
      }
    }
    // -- Bad parse, more than a single line modified, bail.
    else {
      return bail("modified more than a single line");
    }
  },

  _filterCompletions: function(container, typedSoFar, justKey) {
    var completions = [];
    var type = container.resolvedType;
    console.log("completing against", container, "typedSoFar", typedSoFar);

    var tl = typedSoFar ? typedSoFar.length : 0;
    for (var key in type.childrenByName) {
      if (justKey)
        completions.push(key);
      else if (!typedSoFar || key.substring(0, tl) === typedSoFar)
        completions.push(type.childrenByName[key]);
    }

    return completions;
  },

  /**
   * Given a point, find the first token prior to the point that has a linked
   *  parse node with semantic information on it and use that to figure out
   *  the effective context of the point.
   *
   * This ignores "ref" type interpObjs which are used for "foo.bar" pairs;
   *  do not use us to complete on those.  You should be able to handle them
   *  directly
   *
   * @args[
   *   @param[iRow Number]
   *   @param[iCol Number]
   * ]
   * @return[@dict[
   *   @key[kind String]{
   *     What kind of context are we looking at: obj, list, scope
   *   }
   *   @key[context TypeRep]{
   *     The typerep for the context.
   *   }
   *   @key[position #:optional Number] {
   *     If the `kind` is "list", this will be the index in that list that we
   *     think our context point has, so there should be no need to add 1.
   *     Specifically, if we find a prior argument, then we assume that we have
   *     an index one greater than that argument.  If we just find the start
   *     of the list, we assume our position is 0.
   *   }
   *   @key[constraint #:optional TypeRep]{
   *     The typerep applicable to the list slot in question for "list" types.
   *   }
   *   @key[pointType #:optional TypeRep]{
   *     The typerep applicable to the thing just before the point if there
   *     is an identifier/reference.
   *   }
   * ]]
   */
  findContextOfPoint: function(iRow, iCol, skipCount) {
    if (skipCount == null)
      skipCount = 0;
    var tokenLines = this.lastGoodTokenLines;
    // find the first token at/after our point
    var token = this.getTokenInfoAt(iRow, iCol, true);
    // find the index of our token in its row
    if (token) {
      iCol = tokenLines[iRow].indexOf(token);
    }
    else {
      if (iRow >= tokenLines.length)
        iRow = tokenLines.length - 1;
      iCol = tokenLines[iRow].length - 1;
    }

    /**
     * Specialized back-spinner that just looks for something to tell us our
     *  scope without continuing with the whole loop below.  The goal is to
     *  avoid complicating that state machine with latching situations.
     *
     * We share the closing token problem scenario with the loop below.  This
     *  implementation should likely be reconsidered when we do that.
     */
    function keepScanningForScope() {
      for (;;) {
        var token = tokenLines[iRow][iCol];
        if ((typeof(token) === "object") && ("nodeLink" in token)) {
          var node = token.nodeLink;
          if ("interpObj" in node) {
            switch (node.interpObj[0]) {
              case "scope":
                return buildScopeNamespace(node.interpObj[1]);
              case "ref:scope":
                return buildScopeNamespace(node.interpObj[2]);
            }
          }
        }

        if (--iCol < 0) {
          iRow--;
          if (iRow < 0)
            break;
          iCol = tokenLines[iRow].length - 1;
        }
      }
      return null;
    }

    // scan backwards
    var pointType, ns;
    // XXX we need to do more to annotate closing tokens with links to their
    //  parse node so that we don't accidentally walk into a nested scope
    //  accidentally.  This would also make navigation code "easier" too!
    for (;;) {
      token = tokenLines[iRow][iCol];
      if (!token) {
        console.warn("failed to get a token. iRow", iRow, "iCol", iCol,
                     "row.length", tokenLines[iRow].length);
      }
      if ((typeof(token) === "object") && ("nodeLink" in token)) {
        var node = token.nodeLink;
        if ("interpObj" in node) {

          var context, constraint, position;
          switch (node.interpObj[0]) {
            case "new":
              // we actually ran into the class instantiation; we need to force
              //  us down the constructor route since we will otherwise just
              //  be returning the ClassType.
              context = traverser.traverse(null, node);
              if (context)
                context = context.constructor;
              // (fall-through)
            case "arglist":
              // get the owning function if we didn't resolve a constructor
              //  above
              if (!context)
                context = traverser.traverse(null, node);
              // (the traverser will just pierce the
              // (fall-through)
            case "arg":
              if (!context && node.interpObj[0] === "arg") {
                // We want to know about the function for the context, not the
                //  argument, so pierce the arg.  (The arglist is pierced by the
                //  traverser so we can leave it be.)
                context = traverser.traverse(null, node.interpObj[1].owner);
                // However, we also want to use the arg as the pointType if
                //  have not already latched on something.
                if (!pointType)
                  pointType = traverser.traverse(null, node);
              }

              if (node.interpObj[0] === "arg")
                position = node.interpObj[1].index + 1;
              else
                position = 0;

              if (context)
                constraint = context.traverseArg(position);
              return {
                kind: "list",
                context: context,
                position: position,
                constraint: constraint,
                pointType: pointType || keepScanningForScope(),
              };
              break;

            // note: the attr/attrval distinction does not affect the types
            //  we return; we are just using them as a fast-path to figure out
            //  the object they belong to rather than scanning until we find
            //  the beginning of the object initializer.
            case "attr":
              pointType = traverser.traverse(null, node.interpObj[1].owner);
              return {
                kind: "obj",
                // pierce through to the obj
                context: pointType,
                pointType: pointType,
              };
            case "attrval":
              // pierce through to the attr then through to the obj
              pointType = traverser.traverse(null,
                           node.interpObj[1].attr.interpObj[1].owner);
              return {
                kind: "obj",
                context: pointType,
                pointType: pointType,
              };

            case "scope":
              // this means we
              ns = buildScopeNamespace(node.interpObj[1]);
              return {
                kind: "scope",
                context: ns,
                pointType: pointType || ns,
              };

            case "ref:scope":
            case "ref:dot":
            case "ref:index":
              // just latch the pointType and keep going; we don't actually
              //  know our context at this point!
              if (skipCount) {
                skipCount--;
                console.log("skipping", node);
              }
              else if (!pointType)
                pointType = traverser.traverse(null, node);
              break;

            default:
              console.error("unknown interpObj key, update this code!",
                            node);
              throw new Error("unknown interpObj key. insta-fail!");
          }
        }
      }

      if (--iCol < 0) {
        iRow--;
        if (iRow < 0)
          break;
        iCol = tokenLines[iRow].length - 1;
      }
    }

    return null;
  },

  getTokenInfoAt: function(iRow, iCol, doNotTrueify, relOffObj) {
    var tokenLines = this.lastGoodTokenLines;
    if (iRow >= tokenLines.length)
      return null;
    var line = tokenLines[iRow];
    var iToken = 0, token = null, tlen;
    while (iCol >= 0 && iToken < line.length) {
      token = line[iToken++];
      if (typeof(token) === "string") {
        tlen = token.length;
      }
      else if (token.type === STRING) {
        // XXX we probably need to be fragmenting this above...
        tlen = token.length + 2;
      }
      else if (token.type === COMMENT_LINE) {
        tlen = token.length + 2;
      }
      else {
        tlen = ("" + token.value).length;
      }
      iCol -= tlen;
    }
    // XPCOM return value. yeck
    if (relOffObj) {
      relOffObj.start = iCol;
      relOffObj.value = iCol + tlen;
    }
    if (token && !doNotTrueify &&
        (typeof(token) !== "string") && ("trueToken" in token))
      token = token.trueToken;
    return token;
  },

  /**
   * Synchronously convert parsed token lines into the ACE TokenLine
   *  representation.
   *
   * @args[
   *   @param[iLine Number]{
   *     The line you want the tokens for.
   *   }
   *   @param[startState Object]{
   *     Ignored because we have global knowledge of all of the lines, but part
   *     of the contract for this method.
   *   }
   * ]
   * @return[TokenizedLine]
   * ]]
   */
  getLineTokens: function(iLine, startState) {
    var jsTokens = this.tokenLines[iLine];
    var outTokens = [];
    for (var i = 0; i < jsTokens.length; i++) {
      var token = jsTokens[i];
      var type, value;

      if (typeof(token) === "string") {
        value = token;
        type = "text";
      }
      else {
        type = tokenIdToAceType[token.type];
        if ("str" in token)
          value = token.str;
        else if (token.type === STRING)
          value = token.quoteChar + token.value + token.quoteChar;
        else if (token.type === COMMENT_LINE)
          value = "//" + token.value;
        // we already put the /* */ stuff in for COMMENT_BLOCK when we
        //  fragmented them into COMMENT_BLOCK_FRAGMENT so nothing to do now.
        else
          value = token.value;
      }

      outTokens.push({
        type: type,
        value: value,
      });
    }

    return {
      tokens: outTokens,
      state: "awesome",
    };
  },
};
exports.JstutTokenizer = JstutTokenizer;

}); // end require.def
