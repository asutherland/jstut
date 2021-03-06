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
 * JavaScript built-in globals.  Ideally this would link to or source detailed
 *  documentation, but not right now.
 **/

define(["exports"], function (exports) {

var nsDocRefUrls = {

  JSON: {
    _: "https://developer.mozilla.org/en/Using_JSON_in_Firefox",
    parse: "https://developer.mozilla.org/en/Using_JSON_in_Firefox#Parsing_JSON.c2.a0strings",
    stringify: "https://developer.mozilla.org/en/Using_JSON_in_Firefox#Converting_objects_into_JSON",
  },

  RegExp: {
    _: "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/RegExp",


  }
};

function DummyLifeStory() {
  this.originModule = null;
  this.originLine = null;
  this.originName = null;
  this.originOwner = null;
}
DummyLifeStory.prototype = {
  noteOwner: function() {
  }
};

function BuiltinObjStub(name) {
  this.name = name;
  this.life = new DummyLifeStory();

  // no children!
  this.childrenByName = {};
  this.groups = {};
  this.ungroupedChildrenByName = {};
}
BuiltinObjStub.prototype = {
  kind: "class",
  isType: true,
  isBoring: true,
  traverseChild: function() {
    return null;
  },
  traverseArg: function() {
    return null;
  },
};

var globals = exports.globals = {
  Object: new BuiltinObjStub("Object"),
  String: new BuiltinObjStub("String"),
};

}); // end define
