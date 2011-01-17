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
 * Fancy test helper that tries to contextualize what tests do (or fail to do)
 *  in terms of the state relevant to the test.
 **/

define(
  [
    "exports"
  ],
  function(
    exports
  ) {

exports.wrapTest = function wrapTest(testHandle, testMeta) {
  return new StatistExposure(testHandle, testMeta);
};

/**
 * Base implementation that wraps the "test" object passed-in to jetpack-style
 *  tests.  This object should be sub-classed by frameworks/libraries to
 *  add helpers appropriate to their problem domain.
 */
function StatistExposure(testHandler, testMeta) {
  this.test = testHandler;
  testMeta.statist = this;

  this._state = null;
  this._stateTemplate = {};
  this._stateExplanation = {};

  this._round = null;
  this._rounds = [];

  this._maybeGroupedRounds = [];

  this._curGroupRound = null;

  /**
   * @listof[@dict[
   *   @key[name String]{
   *     The name associated with the object.
   *   }
   *   @key[obj Object]{
   *     The reference to the named object.
   *   }
   * ]]
   */
  this._namedObjects = [];
}
StatistExposure.prototype = {
  //////////////////////////////////////////////////////////////////////////////
  // Setup

  /**
   * Define a state-bound event type, returning a binding function that produces
   *  functions that, when invoked, increment the count for the given subject
   *  in the state object.
   *
   * @args[
   *   @param[name String]{
   *     The name to describe this event for labeling purposes; it does not
   *     affect the operation of the test as it is not reflected into the
   *     state object or affect how to trigger events.
   *   }
   *   @param[funcInvocMapping @dict[
   *     @key[this Boolean]{
   *       Should the "this" that the function was invoked with be added to
   *       the event entry?  If so, it will use "this" as the key.
   *     }
   *     @key[args @listof["key name"]]{
   *       A positional list that defines the keys to use to store the
   *       argument with the given position in the event entry.
   *     }
   *   ]]
   * ]
   * @return[@func[
   *   @args[
   *     @param["state key name" String]{
   *       The name to use as a key in the state object.  While the name can
   *       be anything you want as long as it matches what you use in your calls
   *       to `state`, presentation of the test in the UI will be made easier
   *       if you use names that correspond to those used by the hierarchy
   *       mapper by default.
   *     }
   *   ]
   *   @return[@func[]]{
   *     The event handler function.  Each time it is invoked it will add an
   *     entry in the state object for the provided state key name.  The
   *     first time it is triggered in a round, it will set the previously
   *     null value to a list with the new entry.  After that, it will append
   *     the entry to the existing list.  The entry will be as specified per
   *     `funcInvocMapping`.
   *   }
   * ]]
   */
  defStateEvent: function(name, funcInvocMapping) {

    var useThis = funcInvocMapping["this"];
    var argNames = funcInvocMapping.args;

    var self = this;
    function eventBinder(subject) {
      self._stateTemplate[subject] = null;
      return function() {
        var entry = {};
        if (useThis)
          entry["this"] = this;
        for (var i = 0; i < argNames.length; i++) {
          entry[argNames[i]] = arguments[i];
        }

        if (self._state[subject] == null)
          self._state[subject] = [entry];
        else
          self._state[subject].push(entry);
      };
    }
    return eventBinder;
  },

  //////////////////////////////////////////////////////////////////////////////
  // Execution

  /**
   * Group a bunch of sub-tests together by defining a group.  All rounds/etc.
   *  that happen after a group belong to that group until the next group is
   *  defined.  Passing null kills the current group but does not create a new
   *  one.
   */
  group: function(name) {
    if (name == null) {
      this._curGroupRound = null;
      return this;
    }

    this._curGroupRound = {
      name: name,
      rounds: [],
    };
    this._maybeGroupedRounds.push(this._curGroupRound);

    return this;
  },

  round: function(name) {
    var state = this._state = {};
    var round = this._round = {
      name: name,
      pass: null,
      action: null,
      preState: null,
      postState: null,
    };

    this._rounds.push(round);
    if (this._curGroupRound)
      this._curGroupRound.rounds.push(round);
    else
      this._maybeGroupedRounds.push(round);

    var template = this._stateTemplate;
    for (var key in template) {
      state[key] = template[key];
    }

    return this;
  },

  _shallowCmpObjs: function(a, b) {
    var aAttrCount = 0, bAttrCount = 0, key;

    for (key in a) {
      aAttrCount++;
      if (!(key in b))
        return false;
      if (a[key] !== b[key])
        return false;
    }

    for (key in b) {
      bAttrCount++;
    }
    if (aAttrCount != bAttrCount)
      return false;
    return true;
  },

  /**
   * Assert the current state matches the provided expected state.  It is
   *  assumed that anything not called out in the explicit state that is present
   *  in the (template) state is to be treated as null.
   */
  state: function(expectedState) {
    var actualState = this._state;
    keyloop:
    for (var key in actualState) {
      var actVal = actualState[key];
      var expVal = (expectedState.hasOwnProperty(key)) ? expectedState[key]
                                                       : null;
      if (actVal === expVal) {
        this.test.pass(key + " is " + expVal + ", as expected.");
      }
      // if either is null, then it's a mis-match failure
      else if (actVal == null || expVal == null) {
        this.test.fail(key + " expected " + expVal + " but got " + actVal);
      }
      // array comparison case.
      else if (Array.isArray(actVal) && Array.isArray(expVal)) {
        if (actVal.length !== expVal.length) {
          this.test.fail(key + " list-length mismatch, expected: " +
                         expVal.length + ", actual: " + actVal.length);
        }
        else {
          for (var iArr = 0; iArr < actVal.length; iArr++) {
            if (!this._shallowCmpObjs(actVal[iArr], expVal[iArr])) {
              this.test.fail(key + " list contents mismatch on " + iArr +
                             ". expected: " + expVal[iArr] +
                             ", actual: " + actVal[iArr]);
              continue keyloop;
            }
          }
          this.test.pass(key + "'s expected and actual lists match.");
        }
      }
      // object case
      else {
        if (this._shallowCmpObjs(actVal, expVal)) {
          this.test.pass(key + "'s expected and actual objects match.");
        }
        else {
          this.test.fail(key + "'s expected and actual objects don't match.");
        }
      }
    }

    return this;
  },

  //////////////////////////////////////////////////////////////////////////////
};
exports.StatistExposure = StatistExposure;

}); // end define
