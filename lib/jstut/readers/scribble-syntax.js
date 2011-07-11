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
 * Implement the racket scribble documentation tool syntax.
 *
 * The scribble syntax docs can be found at:
 * http://docs.racket-lang.org/scribble/reader.html
 *
 * While we nobly aspire to as much conformance as possible, we will not get
 *  there anytime soon.  Mainly, parsing 'cmd' as anything more than a string
 *  is just way beyond us and maybe non-sensical for a JS implementation.
 *  (We have no quasiquote, no reader macro infrastructure, etc.)
 **/

define("jstut/readers/scribble-syntax",
  [
    "exports",
  ],
  function (
    exports
  ) {

/**
 * The alternate syntax of "|{" can include weird junk in the middle there.
 *  Mirror "|{" to "}|" and mirror any mirror-able characters ("(", "[", "<").
 *  The entire string gets reversed in the process too; we're not just capturing
 *  and reusing delimeters exactly.
 */
function altSyntaxMirror(s) {
  var os = "";
  for (var i = s.length - 1; i >= 0; i--) {
    var c = s[i];
    switch (c) {
      case "(":
        os += ")";
        break;
      case ")":
        os += "(";
        break;
      case "[":
        os += "]";
        break;
      case "]":
        os += "[";
        break;
      case "<":
        os += ">";
        break;
      case ">":
        os += "<";
        break;
      // only mirrored in one direction...
      case "{":
        os += "}";
        break;
      default:
        os += c;
        break;
    }
  }
  return os;
}
exports.altSyntaxMirror = altSyntaxMirror;

/**
 * Escape a string so that it can be used in a regular expression verbatim.
 * XXX This mayhaps should be implemented using a regex itself.
 */
function regexpEscape(s) {
  var os = "";
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    switch (c) {
      case "\\":
      case "^":
      case "$":
      case "*":
      case "+":
      case "?":
      case ".":
      case "(":
      case ")":
      case "|":
      case "{":
      case "}":
      case "[":
      case "]":
        os += "\\" + c;
        break;
      default:
        os += c;
        break;
    }
  }
  return os;
}

/** For nestable comments we need to track starts/ends and count. */
var RE_NESTED_COMMENT = /(\{|\})/g;

/**
 * Given a nested comment starting at idx in s, return the index of the first
 *  character beyond the end of the nested comment.  Throws an exception in the
 *  event the comment is unbalanced.
 * Comments seem a bit under-specified.  It appears we just need to do {}
 *  counting.  There is an idiom to match @;{ with ;} but that is a convention
 *  to not confuse text editors.
 */
function nestedCommentWalker(s, idx) {
  var match, count = 1;
  RE_NESTED_COMMENT.lastIndex = idx + 3;
  while ((match = RE_NESTED_COMMENT.exec(s))) {
    // are we increasing depth?
    if (match[1][0] == "{") {
      count++;
    }
    else {
      if (--count == 0)
        return RE_NESTED_COMMENT.lastIndex;
    }
  }
  throw new Error("mismatched nested comment");
}
exports.nestedCommentWalker = nestedCommentWalker;

var RE_FIRST_NON_WHITESPACE = /\S/g;
// a sexpr atom like an integer/floating point terminates on whitespace or ]
var RE_SEXPR_ATOM_TERM = /[\s\]]/g;

function Keyword(s) {
  this.keyword = s;
}
Keyword.prototype = {
  toString: function() {
    return "Keyword<" + this.keyword + ">";
  },
};
exports.Keyword = Keyword;

// Yes, ASCII only.
var RE_IDENTIFIER_INTRO_CHAR = /[a-zA-Z]/;

function Identifier(s) {
  this.identifier = s;
}
Identifier.prototype = {
  toString: function() {
    return "Identifier<" + this.identifier + ">";
  },
};
exports.Identifier = Identifier;

/**
 * Error handling helper that chops a body string into lines while also
 *  taking an index into the string and telling you what line that dude is
 *  on.
 *
 * @return[@dict[
 *   @key[lines @listof[String]]{
 *     The file split on newlines with the newlines removed.
 *   }
 *   @key[idx Number]{
 *     The idx you passed in in the first place.
 *   }
 *   @key[idxLine Number]{
 *     The line idx turned out to be on, 1-based.
 *   }
 *   @key[idxColumn Number]{
 *     The column idx turned out to be on on the line it was on, 1-based.
 *   }
 * ]]
 */
function chewTextFileForLinesAndStuff(bodyString, idx) {
  // Split by lines making sure consecutive newlines give us blank strings
  //  in between rather than merging.
  var lines = bodyString.split("\n");

  var ridx = idx, idxCol, idxLine = 0; // be zero-based until we return
  for (;;) {
    var line = lines[idxLine];
    if (ridx < line.length) {
      idxCol = ridx;
      break;
    }
    // subtract off the length of the line and its (missing) newline
    ridx -= line.length + 1;
    if (++idxLine >= lines.length) {
      // net a value of -1 for the column to show we are screwed.
      idxCol = -2;
      break;
    }
  }

  return {
    lines: lines,
    idx: idx,
    idxLine: idxLine + 1,
    idxColumn: idxCol + 1,
  };
}

/**
 * Construct a syntax exception suitable for throwing so that we can provide
 *  the user with a usable error message and useful context.
 *
 * @args[
 *   @param[message String]{
 *     The explanation of what is going wrong; this could be lengthy.
 *   }
 *   @param[ctx ParserContext]
 *   @param[parseString String]{
 *     The string currently being parsed.
 *   }
 *   @param[idx Number]{
 *     The index in the `parseString` at which we are declaring we have run
 *     into something we did not expect.
 *   }
 * ]
 * @return[Error]
 */
function syntaxExplode(message, ctx, parseString, idx) {
  var err =  new Error(message);
  err.fileName = ctx.filename;

  // figure out the line of where the sub-reader was starting from...
  var echew = chewTextFileForLinesAndStuff(ctx.contents,
                                           ctx.unconsumedIndex + idx);
  err.sourceLines = echew.lines;
  err.lineNumber = echew.idxLine;
  err.column = echew.idxColumn;
  return err;
}

/**
 * A very very very limited sexpr breaker/parser.  We implement this at all not
 *  because we want to implement scheme/racket but because the sexpr bit in
 *  (at)cmd[sexpr bit] is useful to provide a whitespace-ignoring mechanism for
 *  things that produce objects.  For example, scribble does itemized lists
 *  inside the sexpr block.
 *
 * The forms we recognize and make good JS sense are:
 * - integer literal (no #e, #i, #b, #o, #x stuff)
 * - floating point literal, but no ".4" crap.  Use a zero.
 * - double-quoted string including \u0000 stuff and escaped sub-quotes
 * - at-form (@cmd[blah]{blah})
 * - identifiers, which is to say, stuff starting with a-zA-Z.  These get
 *    wrapped into Identifier objects and have no built-in evaluation or
 *    execution semantics (for now).
 *
 * The forms we recognize but are silly:
 * - boolean literals: #t, #f
 * - keywords (#:keyword); used in argument lists.  It's unclear why racket
 *    uses #:keyword instead of :keyword like common lisp, but whatev's.
 *
 * The forms we do not recognize and are silly (but could be useful):
 * - symbols ('symbol, '|quoted symbol|)
 * - cons pairs: '(1 . 2)
 * - lists: '(1 2 3)
 * - vectors: '#(1 2 3)
 *
 * The forms we do not recognize and would be nuts to recognize:
 * - characters (#\a for example). JS has no real concept and the single
 *    character string is just as short to type.
 * - byte string (#"blah")
 * - hash-tables (#hash)
 * - boxes
 * - #<void>/#<undefined>
 *
 * Implementation wise, we just keep looking for the first non-space character
 *  that we can find and parse that up.  If it's a "]" then we know we are
 *  either all done or need to explode.
 *
 * @args[
 *   @param[s String]{
 *     The string to parse, processed from its beginning.  As such, be sure
 *     to invoke substring or what have you on the string before passing it to
 *     us.
 *   }
 *   @param[ctx ParserContext]
 *   @param[inBracket Boolean]{
 *     Has an opening bracket already been consumed and so we should be scanning
 *     the input string for a closing bracket?  If false, we assume that we
 *     are being provided with a string whose end has already been determined
 *     and so we don't need to look for the bracket.  (This happens when
 *     the alternate syntax that lets us use complex unique signatures is used.)
 *   }
 * ]
 * @return[@list[
 *   @param["results"]
 *   @param["next index" Number]{
 *     The index of the first character we did not process.
 *   }
 * ]]
 */
function sexprParser(s, ctx, inBracket) {
  var idx = 0, idxEnd, slen = s.length, results = [], tokens;
  // The last index we told ctx.unconsumedIndex about (or we can presume it
  //  has been told about).  We subtract this off from idx when invoking
  //  ctx.bumpUnconsumedIndex().
  var relIdx = 0;
  if (ctx.rawMode) {
    // there will always be a live scribble run when we are invoked, yo.
    tokens = ctx.curTokenRun.tokens;
  }

  loop: while (idx < slen) {
    RE_FIRST_NON_WHITESPACE.lastIndex = idx;
    var match = RE_FIRST_NON_WHITESPACE.exec(s);

    if (!match) {
      if (inBracket)
        throw syntaxExplode("Ran out of sexprs to look at without hitting a " +
                            "']'",
                            ctx, s, idx);
      if (tokens && idx != slen)
        tokens.push(s.substring(idx, slen));
      idx = slen;
      break;
    }

    if (tokens)
      tokens.push(s.substring(idx, match.index));

    idx = match.index;
    var c = s[idx++];
    switch (c) {
      case "]":
        if (!inBracket)
          throw syntaxExplode(
            "Got a ']' without being in a bracketed sexpr list.",
            ctx, s, idx - relIdx);
        // (nothing to token about in this case; in the error case we are sad,
        //  in the non-error case, our caller is responsible for closing out
        //  the "]".)
        break loop;
      // @ form
      case "@":
        ctx.bumpUnconsumedIndex(idx - relIdx);
        var atResult = atParser(s, ctx, idx); // (takes care of its tokens)
        // we may need to refresh our tokens var though...
        if (tokens)
          tokens = ctx.curTokenRun.tokens;
        // comments do not go on the result list and are identified by undefined
        if (atResult[0] !== undefined)
          results.push(atResult[0]);
        relIdx = idx = atResult[1];
        break;
      // string!
      case '"':
        // (roughly cribbed from narcissus' lexString)
        idxEnd = idx + 1;
        c = s[idxEnd];
        var hasEscapes = false;
        while (c !== '"' && idxEnd <= slen) {
          if (c === "\\") {
            hasEscapes = true;
            idxEnd++;
          }
          c = s[idxEnd++];
        }
        if (idxEnd > slen) {
          if (tokens)
            tokens.push(new Token(s.substring(idx - 1), ERRORRE));
          throw syntaxExplode("Unterminated string death in sexpr",
                              ctx, s, idx - relIdx);
        }
        // (idx points to the first char in the string, idxEnd to the first char
        //  after the closing quote)
        results.push(hasEscapes ? eval(s.substring(idx - 1, idxEnd))
                                : s.substring(idx, idxEnd - 1));
        if (tokens)
          tokens.push(new Token(s.substring(idx - 1, idxEnd), SEXPR_STRING));
        idx = idxEnd;
        break;
      // # things
      case "#":
        RE_SEXPR_ATOM_TERM.lastIndex = idx;
        match = RE_SEXPR_ATOM_TERM.exec(s);
        if (!match) {
          if (inBracket)
            throw syntaxExplode(
              "ran out of non-whitespace without the keyword terminating",
              ctx, s, idx - relIdx);
          idxEnd = slen;
        }
        else {
          idxEnd = match.index;
        }
        // #:keyword ?
        if (s[idx] === ":") {
          if (tokens)
            tokens.push(new Token(s.substring(idx-1, idxEnd), SEXPR_KEYWORD));
          results.push(new Keyword(s.substring(idx+1, idxEnd)));
          idx = idxEnd;
          break;
        }
        var hashThing = s.substring(idx, idxEnd);
        if (hashThing == "t") {
          if (tokens)
            tokens.push(new Token("#t", SEXPR_BOOLEAN));
          results.push(true);
        }
        else if (hashThing == "f") {
          if (tokens)
            tokens.push(new Token("#f", SEXPR_BOOLEAN));
          results.push(false);
        }
        else
          throw syntaxExplode("Unsupported hashy syntax thing: #" + hashThing,
                              ctx, s, idx - relIdx);
        idx = idxEnd;
        break;
      // numbers!
      case "-":
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        // going for terseness here, not efficiency.  for now.
        RE_SEXPR_ATOM_TERM.lastIndex = idx;
        match = RE_SEXPR_ATOM_TERM.exec(s);
        if (!match) {
          if (inBracket)
            throw syntaxExplode(
              "ran out of number without hitting a terminator",
              ctx, s, idx - relIdx);
          idxEnd = slen;
        }
        else {
          idxEnd = match.index;
        }
        var numString = s.substring(idx - 1, idxEnd);
        if (tokens)
          tokens.push(new Token(numString, SEXPR_NUMBER));
        // meh, they all end up the same, more or less and it's probably more
        //  clever than us...
        results.push(parseFloat(numString));
        idx = idxEnd;
        break;
      default:
        // identifier?
        if (RE_IDENTIFIER_INTRO_CHAR.test(c)) {
          RE_SEXPR_ATOM_TERM.lastIndex = idx;
          match = RE_SEXPR_ATOM_TERM.exec(s);
          if (!match) {
            if (inBracket)
              throw syntaxExplode(
                "ran out of identifier without hitting a terminator",
                ctx, s, idx - relIdx);
            idxEnd = slen;
          }
          else {
            idxEnd = match.index;
          }
          if (tokens)
            tokens.push(new Token(s.substring(idx - 1, idxEnd),
                                  SEXPR_IDENTIFIER));
          results.push(new Identifier(s.substring(idx - 1, idxEnd)));
          idx = idxEnd;
          break;
        }

        throw syntaxExplode(
          "Unsupported lead-in character '" + c + "' in sexpr: '" + s + "'",
          ctx, s, idx - relIdx - 1);
        break;
    }
  }
  ctx.bumpUnconsumedIndex(idx - relIdx);
  return [results, idx];
}
exports.sexprParser = sexprParser;

/** We are just looking for "@"s with no terminus. */
var RE_AT_BREAK_NORMAL = /(@)/g;
var RE_AT_TEXT = /(@|\{|\})/g;

/** We are in a command name, we need to find its edge. */
var RE_POST_COMMAND = /[ \|\[\{]/g;
/** The alternate syntax is | followed by anything punctuation. */
var RE_ALT_SYNTAX_PUNC = /[^a-zA-Z0-9@ \t\r\n]/;

function ScribbleTokenRun() {
  this.tokens = [];
}
ScribbleTokenRun.prototype = {
  renderModule: "jstut/render/scribble",
};

/**
 * Recursively breaks a text stream into a list of strings and [cmd string,
 *  datum string, string or recursive structure] lists.  If the result would be
 *  a list with a single string contained, we just return that one string.
 *
 * We always scan for "@" symbols; once we have found them, we try and consume
 *  the @-form.  This may include a text-body block, possibly with arbitrary
 *  escaping strings.  If it includes a text block, our job is then to scan
 *  until we find the text block closure.
 *
 * @param s The string to parse up.
 * @param ctx The parsing context.
 */
function textStreamAtBreaker(s, ctx, re_at_or_term) {
  var using_re = re_at_or_term || RE_AT_BREAK_NORMAL;

  var tokens;
  if (ctx.rawMode) {
    if (!ctx.curTokenRun || !(ctx.curTokenRun instanceof ScribbleTokenRun)) {
      ctx.curTokenRun = new ScribbleTokenRun();
      ctx.tokenRuns.push(ctx.curTokenRun);
    }
    tokens = ctx.curTokenRun.tokens;
  }

  var idx = 0, slen = s.length, results = [], count = 1, lastProcPoint = 0;
  // The last index we told ctx.unconsumedIndex about (or we can presume it
  //  has been told about).  We subtract this off from idx when invoking
  //  ctx.bumpUnconsumedIndex().
  var relIdx = idx;

  /**
   * Add a string to our current result set.  If the last thing in the result
   *  set is a string, then just merge it to simplify things.  This logic
   *  exists mainly for the benefit of the unit testing code and may need to
   *  go away when we improve our whitespace handling to be more useful (and
   *  coincidentally conform to the scribble-proper way.)
   */
  function mergeInString(ms) {
    if (!results.length || typeof(results[results.length-1]) != "string")
      results.push(ms);
    else
      results[results.length-1] = results[results.length-1] + ms;
    // Merging semantics are not appropriating for tokens; the only reason
    //  a string would get broken in two is some syntax in the middle!
    //  (like quoting)
    if (tokens)
      tokens.push(ms);
  }
  while (idx < slen) {
    using_re.lastIndex = idx;
    // -- nesting traversal
    var match = using_re.exec(s);
    if (!match) {
      if (re_at_or_term)
        throw syntaxExplode("Non-terminating recursive context",
                            ctx, s, idx - relIdx);
      mergeInString(s.substring(idx));
      idx = slen;
      break;
    }
    var m = match[1];
    if (m[m.length-1] == "@") {
    }
    else if (m[0] == "}") {
      if (--count == 0) {
        if (lastProcPoint != match.index)
          mergeInString(s.substring(lastProcPoint, match.index));
        // we eat the "}" even though we don't return it in our string
        idx = match.index + 1;
        break;
      }
      idx = using_re.lastIndex;
      continue;
    }
    else { // {-ish
      count++;
      idx = using_re.lastIndex;
      continue;
    }
    if (match.index != lastProcPoint)
      mergeInString(s.substring(lastProcPoint, match.index));
    idx = using_re.lastIndex; // skip over the @

    ctx.bumpUnconsumedIndex(idx - relIdx);
    var atResult = atParser(s, ctx, idx, re_at_or_term);
    // we may need to refresh our tokens (atParser can use other readers)
    if (tokens)
      tokens = ctx.curTokenRun.tokens;
    var result = atResult[0];
    if (result !== undefined) {
      if (typeof(result) == "string")
        mergeInString(result);
      else
        results.push(atResult[0]);
    }
    relIdx = lastProcPoint = idx = atResult[1];
  }

  ctx.bumpUnconsumedIndex(idx - relIdx);

  // if [] just return ""
  if (results.length == 0)
    return "";
  // if ["blah"] just return "blah", simplifies recursive logic.
  if (results.length == 1 && typeof(results[0]) == "string")
    return results[0];
  return results;
}

function AtCommand(name, svals, textStream) {
  this.name = name;
  this.svals = svals;
  this.textStream = textStream;
}
exports.AtCommand = AtCommand;
AtCommand.prototype = {
  toString: function() {
    return "AtCommand<" + this.name + ">";
  }
};

var AT_SIGN = 0,
    AT_LBRACKET = 1,
    AT_RBRACKET = 2,
    AT_LSQUIGGLE = 3,
    AT_RSQUIGGLE = 4,
    SEXPR_NUMBER = 5,
    SEXPR_STRING = 6,
    SEXPR_IDENTIFIER = 7,
    SEXPR_BOOLEAN = 8,
    SEXPR_KEYWORD = 9,
    ATXPR_COMMENT = 10,
    ATXPR_COMMAND = 11,
    ERRORRE = 12;

var TOKEN_LITERALS = [
 "@", "[", "]", "{", "}",
];

function Token(value, type) {
  this.value = value;
  this.type = type;
}

/**
 * Parses an at-form in the provided string.
 *
 * We bump ctx.unconsumedIndex to cover the entirety of what we traversed.
 *
 * @args[
 *   @param[s String]{
 *     The string we can find our @"@"syntax in.}
 *   @param[ctx ParsingContext]{
 *     The parsing context.
 *    }
 *   @param[idx Number]{
 *     The index of the first character after the @"@" sign.
 *   }
 *   @param[re_at_or_term #:optional RegExp]{
 *     The regular expression to use for nesting matching.
 *     If no nesting is required, omit the regex and we will just use a @"@"
 *     detector.
 *   }
 * ]
 * @return[@list[
 *   @param["result array" @oneof[
 *     AtCommand
 *     String
 *     undefined
 *   ]]
 *   @param["next index" Number]{
 *     The index of the first character we did not process.
 *   }
 * ]]
 */
function atParser(s, ctx, idx, re_at_or_term) {
  var match, slen = s.length;
  // The last index we told ctx.unconsumedIndex about (or we can presume it
  //  has been told about).  We subtract this off from idx when invoking
  //  ctx.bumpUnconsumedIndex().
  var relIdx = idx;

  var tokens;
  if (ctx.rawMode) {
    // there will always be a live scribble run when we are invoked, yo.
    tokens = ctx.curTokenRun.tokens;
    tokens.push(AT_SIGN);
  }

  // -- escape string support
  // (In racket this is likely handled by just purely evaluating the
  //  expression that happens and special-casing the merging; we are not that
  //  fancy, so we entirely special case strings.)
  if (s[idx] == '"') {
    // just find the matching quote
    var idxQuote = s.indexOf('"', idx + 1);
    if (idxQuote == -1)
      throw syntaxExplode("Unmatched string literal!", ctx, s, idx);
    if (tokens)
      tokens.push(new Token(s.substring(idx, idxQuote+1), SEXPR_STRING));

    ctx.bumpUnconsumedIndex(idxQuote + 1 - relIdx);
    return [s.substring(idx + 1, idxQuote), idxQuote + 1];
  }
  // -- comment special case
  if (s[idx] == ";") {
    // nesty body comment
    if (s[idx + 1] == "{") {
      var justBeyondComment = nestedCommentWalker(s, idx - 1);
      if (tokens)
        tokens.push(new Token(s.substring(idx, justBeyondComment),
                              ATXPR_COMMENT));

      ctx.bumpUnconsumedIndex(justBeyondComment - relIdx);
      return [undefined, justBeyondComment];
    }
    // line-oriented comment (eat until and including newline and then all
    //  following whitespace)
    else {
      var idxNewline = s.indexOf("\n", idx + 1);
      if (idxNewline == -1) {
        // if we are not in a recursive context, this is okay.
        if (re_at_term)
          throw syntaxExplode(
            "line comment without a newline in terminus context",
            ctx, s, idx);

        ctx.bumpUnconsumedIndex(slen - relIdx);
        return [undefined, slen];
      }
      // (we found a newline, eat that far and then the whitespace)
      RE_FIRST_NON_WHITESPACE.lastIndex = idxNewline + 1;
      match = RE_FIRST_NON_WHITESPACE.exec(s);
      if (tokens)
        tokens.push(new Token(s.substring(idx, match.index),
                              ATXPR_COMMENT));
      ctx.bumpUnconsumedIndex(match.index - relIdx);
      return [undefined, match.index];
    }
  }
  // it must be a command
  var cmdName = null, cmdSVals = null, cmdTextStream = null;
  if (s[idx] != "[" && s[idx] != "{" && s[idx] != "|") {
    // find the edge of the command
    RE_POST_COMMAND.lastIndex = idx;
    match = RE_POST_COMMAND.exec(s);
    var idxAfterCmd;
    if (match)
      idxAfterCmd = match.index;
    else
      idxAfterCmd = slen;
    cmdName = s.substring(idx, idxAfterCmd);
    if (tokens)
      tokens.push(new Token(s.substring(idx, idxAfterCmd),
                            ATXPR_COMMAND));
    idx = idxAfterCmd;

    // Push the token name onto the ParserContext tokenStack so that
    //  nested readers know who their enclosing parent is.  (This logic is
    //  duplicated by the textStreamChewer so the same semantics hold for
    //  the command evaluation phase.)
    ctx.pushToken(cmdName);
  }
  if (idx < slen && s[idx] == "[") {
    if (tokens)
      tokens.push(AT_LBRACKET);

    ctx.bumpUnconsumedIndex(idx + 1 - relIdx);

    var sexprResult = sexprParser(s.substring(idx + 1), ctx, true);
    // we may need to refresh our tokens...
    if (tokens)
      tokens = ctx.curTokenRun.tokens;
    cmdSVals = sexprResult[0];
    if (tokens)
      tokens.push(AT_RBRACKET);
    idx += sexprResult[1] + 1;
    // sexprParser will have bumped the unconsumed index, so update our rel.
    relIdx = idx;
  }
  if (idx < slen && s[idx] == "|") {
    // alternate syntax... recursive!
    if (RE_ALT_SYNTAX_PUNC.test(s[idx + 1])) {
      // the left-side is up throug + including the squiggly brace
      var idxSquiggly = s.indexOf("{", idx+1);
      var altSyntaxAt = s.substring(idx, idxSquiggly) + "@";
      var altSyntaxLeft = s.substring(idx, idxSquiggly + 1);
      var altSyntaxRight = altSyntaxMirror(altSyntaxLeft);
      var altSynRe = new RegExp("(" +
                                regexpEscape(altSyntaxAt) + "|" +
                                regexpEscape(altSyntaxLeft) + "|" +
                                regexpEscape(altSyntaxRight) + ")", "g");
      if (tokens)
        tokens.push(new Token(altSyntaxLeft, AT_LSQUIGGLE));
      idx = idxSquiggly + 1;

      ctx.bumpUnconsumedIndex(idx - relIdx);
      cmdTextStream = textStreamAtBreaker(s.substring(idx), ctx, altSynRe);
      // we may need to refresh our tokens...
      if (tokens)
        tokens = ctx.curTokenRun.tokens;
      if (tokens)
        tokens.push(new Token(altSyntaxRight, AT_RSQUIGGLE));
      idx += altSynRe.lastIndex;
      // textStreamAtBreaker will have bumped the unconsumed index, so update
      relIdx = idx;
    }
    // expression escape; basically just a [] bit.  go find the other |, no
    //  nesting.
    else {
      if (tokens)
        tokens.push(new Token("|", AT_LBRACKET));
      var idxBar = s.indexOf("|", idx + 1);
      if (idxBar == -1)
        throw syntaxExplode("unmatched expression escape |", ctx, s, idx);

      ctx.bumpUnconsumedIndex(idx + 1 - relIdx);
      // capture between the two bars and sexpr parse them
      cmdSVals = sexprParser(s.substring(idx + 1, idxBar), ctx, false)[0];
      // we may need to refresh our tokens...
      if (tokens)
        tokens = ctx.curTokenRun.tokens;
      if (tokens)
        tokens.push(new Token("|", AT_RBRACKET));
      // position our next investigatory character after the latter bar
      idx = idxBar + 1;
      // sexprParser will have bumped the unconsumed index, so update our rel.
      relIdx = idx;
      // (done with this iteration)
    }
  }
  else if (idx < slen && s[idx] == "{") {
    if (tokens)
      tokens.push(AT_LSQUIGGLE);
    // if there is a command and we have a reader for it, use that instead of
    //  recursively using the at-breaker
    if (cmdName && (cmdName in ctx.readerMap)) {
      // kill the current token run when one should exist
      if (ctx.rawMode)
        ctx.curTokenRun = null;
      var readerFunc = ctx.readerMap[cmdName], rfr;

      // bump and remember what we bumped to in case the reader does not bump
      var preReaderUCI = ctx.bumpUnconsumedIndex(idx + 1 - relIdx);
      try {
        rfr = readerFunc(s.substring(idx + 1), ctx, cmdSVals);
      }
      catch(subEx) {
        // The reader is not working with full positional context, so we need
        //  to help out and wrap the exception in additional context.
        var err = new Error("Nested parse error: " + subEx.message);
        err.fileName = ctx.filename;
        err.ex = subEx;
        // figure out the line of where the sub-reader was starting from...
        var echew = chewTextFileForLinesAndStuff(ctx.contents,
                                                 ctx.unconsumedIndex);
        err.sourceLines = echew.lines;
        err.lineNumber = echew.idxLine;
        err.column = "unavailable";
        // you need to substract 1 off of two one-based line-numbers!
        if ("lineNumber" in subEx)
          err.lineNumber += subEx.lineNumber - 1;
        throw err;
      }
      idx += rfr[1] + 1;
      // if the reader did not bump the index, include that in the bump;
      //  but we need to bump by 1 no matter what because we are the ones
      //  eating the closing "}"
      ctx.bumpUnconsumedIndex(
        ((ctx.unconsumedIndex === preReaderUCI) ? rfr[1] : 0) + 1);
      // (no need to update relIdx)

      // we need to start up a new token run...
      if (ctx.rawMode) {
        ctx.curTokenRun = new ScribbleTokenRun();
        ctx.tokenRuns.push(ctx.curTokenRun);
        tokens = ctx.curTokenRun.tokens;
      }
      if (tokens)
        tokens.push(AT_RSQUIGGLE);

      // (we bumped unconsumedIndex above)
      return [rfr[0], idx];
    }
    else {
      ctx.bumpUnconsumedIndex(idx + 1 - relIdx);
      cmdTextStream = textStreamAtBreaker(s.substring(idx + 1), ctx, RE_AT_TEXT);
      // we may need to refresh our tokens...
      if (tokens)
        tokens = ctx.curTokenRun.tokens;
      idx += 1 + RE_AT_TEXT.lastIndex;
      relIdx = idx;
      if (tokens)
        tokens.push(AT_RSQUIGGLE);
    }
  }
  if (cmdName)
    ctx.popToken();

  ctx.bumpUnconsumedIndex(idx - relIdx);
  return [new AtCommand(cmdName, cmdSVals, cmdTextStream), idx];
}
exports.textStreamAtBreaker = textStreamAtBreaker;

exports.coerceString = function coerceString(st) {
  if (typeof(st) === "string")
    return st;
  if (st instanceof Keyword)
    return st.keyword;
  if (st instanceof Identifier)
    return st.identifier;
  throw new Error("Unable to coerce " + st + " to a string.");
};

});
