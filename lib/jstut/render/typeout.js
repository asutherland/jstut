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
 * Htmlification logic for typerep.
 **/

define("jstut/render/typeout",
  [
    "exports",
    "jstut/render/html",
    "jstut/langs/manual",
  ],
  function(
    exports,
    html,
    $man
  ) {

/**
 * @protocol[OutputtableType]
 *
 *
 */
var OutputtableType = {
  /**
   * Indicates whether the type is anonymous and must therefore be recursively
   *  expanded (true), or can just be hyperlinked.
   */
  isAnonymous: null,
  /**
   * Indicates whether the type is sufficiently simple that it makes sense to
   *  expand it inline rather than require the user to take some action to
   *  see it in its (short) entirety.
   */
  isSimple: null,
};


var RE_SENTENCE_ENDER = /[.!?](?:[^a-zA-Z0-9=]|$)/;

var RE_WS = /^\s*$/;

/**
 * Take a doc stream and produce a 'brief' stream by slicing things so that
 *  we only take the first sentence from the effective text.  This means
 *  looking for a period followed by something that's not [a-zA-Z0-9].
 *
 * This will catch "etc." but we don't care.
 *
 * We are currently aware of manual Para nodes, but otherwise cannot see inside
 *  toDOMNode implementations.  Similar special-casing seems like the way to
 *  go until it becomes a serious problem.
 */
function briefizeDocStream(inStream) {
  var outStream = [];
  // is the stream still in its entirety?
  var full = true;

  if (inStream == null)
    return {stream: outStream, full: full};

  for (var i = 0; i < inStream.length; i++) {
    var thing = inStream[i];
    if (typeof(thing) !== "string") {
      // if it's a paragraph, pierce it by just merging it into the input
      //  stream we are processing and treat it like it was never there.
      if (thing instanceof $man.Para) {
        inStream = inStream.concat();
        inStream.splice.apply(inStream, [i + 1, 0].concat(thing.kids));
        continue;
      }
      // If it's a thing with a docStream, splice it in.  This is being added
      //  for `DocSplice`, but might be useful for other reasons too.
      if ("docStream" in thing) {
        inStream = inStream.concat();
        inStream.splice.apply(inStream, [i + 1, 0].concat(thing.docStream));
        continue;
      }

      // otherwise we have to just leave it as-is.

      outStream.push(thing);
      continue;
    }

    var match = RE_SENTENCE_ENDER.exec(thing);
    if (match) {
      outStream.push(thing.substring(0, match.index + 1));
      // We are truncating if we are cutting off some non-whitespace from this
      //  string or if there is more stuff in the stream.
      if (!RE_WS.test(thing.substring(match.index + 1)) ||
          (i != inStream.length - 1))
        full = false;
      break;
    }
  }

  return {stream: outStream, full: full};
}


exports.descriptorMixin = {
  /**
   * Return a docstream containing a brief description of whatever this is.
   */
  get briefDocStream() {
    return briefizeDocStream(this.docStream).stream;
  },

  /**
   * Is the brief stream equivalent to the full stream?
   */
  get briefStreamIsFullStream() {
    return briefizeDocStream(this.docStream).full;
  },

  /**
   * Helper getter that pierces typerefs.
   */
  get resolvedType() {
    var type = this.type;
    if ("_resolve" in type) {
      if (type._resolve())
        return type.resolved.resolvedType;
    }
    return type;
  },

  /**
   * Tell us about the default value, if any.
   *
   * XXX We need to figure out how much traversal to do here; should we just
   *  return the descriptor, or should it be piercing to the value?
   */
  get defaultValue() {
    if (("defaultDesc" in this) && this.defaultDesc) {
      return this.defaultDesc;
    }
    return null;
  },

  /**
   * Mainly intended for descriptors so that we can normalize across both
   *  case (under oneof's) and non-case descriptors.  Case descriptors have no
   *  name, but their type name serves as a reasonable stand-in.
   *
   * Depending on this may be a "specialize this widget" smell...
   */
  get nameOrTypeName() {
    if (("name" in this) && this.name)
      return this.name;

    // intentionally not using resolvedType since typerefs are good enough in
    //  this case.
    return this.type.name;
  },
};

exports.typeMixin = {
  /**
   * Return a docstream containing a brief description of whatever this is.
   */
  get briefDocStream() {
    return briefizeDocStream(this.docStream).stream;
  },

  /**
   * Is the brief stream equivalent to the full stream?
   */
  get briefStreamIsFullStream() {
    return briefizeDocStream(this.docStream).full;
  },

  /**
   * Types are already resolved types.  We are doing this for symmetry with
   *  descriptors because from a presentation perspective this makes sense
   *  right now.
   */
  get resolvedType() {
    return this;
  },

  get defaultValue() {
    return null;
  },

  /**
   * Symmetry with descriptors again.
   */
  get nameOrTypeName() {
    return this.name;
  },
};

/**
 * Perform simple copying of the mixin's contents when they do not already exist
 *  in the target.
 *
 * @args[
 *   @param[mixin]{
 *     The mixin; now supports getters/setters too.
 *   }
 *   @param[targetPrototype] {
 *     The target prototype.  All existing attributes will be left intact.
 *   }
 * ]
 */
exports.mix = function(mixin, targetPrototype) {
  for (var key in mixin) {
    if (!(key in targetPrototype)) {
      var getter = mixin.__lookupGetter__(key);

      if (getter) {
        targetPrototype.__defineGetter__(key, getter);
        var setter = mixin.__lookupSetter__(key);
        if (setter)
          targetPrototype.__defineSetter__(key, setter);
      }
      else {
        targetPrototype[key] = mixin[key];
      }
    }
  }
};

}); // end define
