
/**
 * This module just provides URLs for documentation of the default set of JS
 *  globals.
 *
 * And right now exists in a brainstorm stage.  Not sure whether we should just
 *  bootstrap the root data structures or create stubby source files that get
 *  processed just like any other file.
 **/
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

function JSTypeArray() {

}
JSTypeArray.prototype = {
};

function JSTypeString() {
}
JSTypeString.prototype = {
};

function JSTypeRegExp() {
}
JSTypeRegExp.prototype = {
};

exports.JSGlobalJSON = {
  childrenByName: {
    parse: null,
    stringify: null,
  }
};
