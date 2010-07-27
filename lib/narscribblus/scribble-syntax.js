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

/** We are just looking for "@"s with no terminus. */
var RE_AT_BREAK_NORMAL = /(@)/g;
var RE_AT_TEXT = /(@|\{|\})/g;

/** We are in a command name, we need to find its edge. */
var RE_POST_COMMAND = /[ \|\[\{]/g;
/** The alternate syntax is | followed by anything punctuation. */
var RE_ALT_SYNTAX_PUNC = /[^a-zA-Z0-9@ \t\r\n]/;

var RE_FIRST_NON_WHITESPACE = /\S/g;

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
 * @param [re_at_or_term] The regular expression to use for nesting matching.
 *     If no nesting is required, omit the regex and we will just use a "@"
 *     detector.
 */
function textStreamAtBreaker(s, re_at_or_term) {
  var using_re = re_at_or_term || RE_AT_BREAK_NORMAL;

  var idx = 0, slen = s.length, results = [], count = 1, lastProcPoint = 0;
  function mergeInString(ms) {
    if (!results.length || typeof(results[results.length-1]) != "string")
      results.push(ms);
    else
      results[results.length-1] = results[results.length-1] + ms;
  }
  while (idx < slen) {
    console.log("trying to set lastIndex to", idx, "cur val", using_re.lastIndex, "s", s);
    using_re.lastIndex = idx;
    // -- nesting traversal
    var match = using_re.exec(s);
    if (!match) {
      if (re_at_or_term)
        throw new Error("Non-terminating recursive context");
      mergeInString(s.substring(idx));
      break;
    }
    var m = match[1];
    if (m[m.length-1] == "@") {
    }
    else if (m[0] == "}") {
      if (--count == 0) {
        console.log("tagging out", lastProcPoint, match.index);
        if (lastProcPoint != match.index)
          mergeInString(s.substring(lastProcPoint, match.index));
        break;
      }
      idx = using_re.lastIndex;
      console.log("}", "idx", idx);
      continue;
    }
    else { // {-ish
      count++;
      idx = using_re.lastIndex;
      console.log("{", "idx", idx);
      continue;
    }
    if (match.index != lastProcPoint)
      mergeInString(s.substring(lastProcPoint, match.index));
    idx = using_re.lastIndex; // skip over the @

    // -- escape string support
    // (In racket this is likely handled by just purely evaluating the
    //  expression that happens and special-casing the merging; we are not that
    //  fancy, so we entirely special case strings.)
    if (s[idx] == '"') {
      // just find the matching quote
      var idxQuote = s.indexOf('"', idx + 1);
      if (idxQuote == -1)
        throw new Error("Unmatched string literal!");
      mergeInString(s.substring(idx + 1, idxQuote));
      lastProcPoint = idx = idxQuote + 1;
      continue;
    }
    // -- comment special case
    if (s[idx] == ";") {
      // nesty body comment
      if (s[idx + 1] == "{") {
        lastProcPoint = idx = nestedCommentWalker(s, idx - 1);
        continue;
      }
      // line-oriented comment (eat until and including newline and then all
      //  following whitespace)
      else {
        var idxNewline = s.indexOf("\n", idx + 1);
        if (idxNewline == -1) {
          // if we are not in a recursive context, this is okay.
          if (re_at_term)
            throw new Error("line comment without a newline in terminus" +
                            " context");
          lastProcPoint = idx = slen;
          continue;
        }
        // (we found a newline, eat that far and then the whitespace)
        RE_FIRST_NON_WHITESPACE.lastIndex = idxNewline + 1;
        match = RE_FIRST_NON_WHITESPACE.exec(s);
        lastProcPoint = idx = match.index;
        continue;
      }
    }
    // it must be a command
    var cmdList = [null, null, null];
    if (s[idx] != "[" && s[idx] != "{" && s[idx] != "|") {
      // find the edge of the command
      RE_POST_COMMAND.lastIndex = idx;
      match = RE_POST_COMMAND.exec(s);
      var idxAfterCmd;
      if (match)
        idxAfterCmd = match.index;
      else
        idxAfterCmd = slen;
      cmdList[0] = s.substring(idx, idxAfterCmd);
      idx = idxAfterCmd;
      console.log("cmd end", idx);
    }
    if (idx < slen && s[idx] == "[") {
      var idxBrace = s.indexOf("]", idx + 1);
      if (idxBrace == -1)
        throw new Error("unmatched closing square brace");
      cmdList[1] = s.substring(idx + 1, idxBrace);
      idx = idxBrace + 1;
    }
    if (idx < slen && s[idx] == "|") {
      // alternate syntax... recursive!
      console.log("alt syntax check on", s[idx + 1]);
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
        console.log("regexp", altSynRe);
        idx = idxSquiggly + 1;
        cmdList[2] = textStreamAtBreaker(s.substring(idx), altSynRe);
        idx += altSynRe.lastIndex;
        console.log("alt nested; idx", idx, "lastIndex", altSynRe.lastIndex);
      }
      // expression escape; basically just a [] bit.  go find the other |, no
      //  nesting.
      else {
        var idxBar = s.indexOf("|", idx + 1);
        if (idxBar == -1)
          throw new Error("unmatched expression escape |");
        // capture between the two bars
        cmdList[1] = s.substring(idx + 1, idxBar);
        // position our next investigatory character after the latter bar
        idx = idxBar + 1;
        // (done with this iteration)
      }
    }
    else if (idx < slen && s[idx] == "{") {
      cmdList[2] = textStreamAtBreaker(s.substring(idx + 1), RE_AT_TEXT);
      idx += 1 + RE_AT_TEXT.lastIndex;
      console.log("nested; idx", idx, "lastIndex", RE_AT_TEXT.lastIndex);
    }
    results.push(cmdList);
    lastProcPoint = idx;
  }
  // if [] just return ""
  if (results.length == 0)
    return "";
  // if ["blah"] just return "blah", simplifies recursive logic.
  if (results.length == 1 && typeof(results[0]) == "string")
    return results[0];
  return results;
}
exports.textStreamAtBreaker = textStreamAtBreaker;
