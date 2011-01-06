
var tlNumber = 1;
var tlBoolean = true;
var tlNull = null;
var tlString = "imastring";
var tlRegex = /foo/g;

exports.eNumber = 2;

var tlEmptyObj = {
};

var tlObjAsNamespace = {
  num: 5,
  bool: true,
  str: "stringy",
};

var groupy = {
  ungroupedNum: 0,
  ungroupedStr: "foo",

  //////////////////////////////////////////////////////////////////////////////
  // A

  aNum: 0,
  aStr: "bar",

  //////////////////////////////////////////////////////////////////////////////
  // B
  //
  // BDescription

  bNum: 1,
  bStr: "baz",

  //////////////////////////////////////////////////////////////////////////////

  ungroupedBool: true,
};

/**
 * Singleton object tlObjAsSingleton.
 */
var tlObjAsSingleton = {
  /**
   * A double-void method.
   */
  methVoidVoid: function _fn_meth_void_void() {
  },

  /**
   * Takes an int, returns an int.  woo.
   *
   * @args[
   *   @param[inInt Number]{
   *   }
   * ]
   * @return[Number]
   */
  methIntInt: function _fn_meth_int_int(inInt) {
    return inInt + 5;
  },
};
exports.tlObjAsSingleton = tlObjAsSingleton;

/**
 * I am the class tlClassA.  I've got mad class, yo.
 *
 * @args[
 *   @param[constructionArg0]{
 *     I am the comment of arg0 of tlClassA.
 *   }
 * ]
 */
function tlClassA(constructionArg0) {
}
tlClassA.prototype = {
  /**
   * I am the methyod.
   *
   * @args[
   *   @param[a]{
   *     I need to what to do, a?
   *   }
   * ]
   */
  methy: function classA_methy(a) {

  },

  straightField: 0,
  get getOnly() {
    return 0;
  },

  set setOnly(val) {
    this._setOnly = val;
  },

  get getAndSet() {
    return this._getAndSet;
  },
  set getAndSet(val) {
    this._getAndSet = val;
  }
};
exports.classA = tlClassA;
