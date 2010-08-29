
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

var tlObjAsSingleton = {
  methVoidVoid: function _fn_meth_void_void() {
  },

  methIntInt: function _fn_meth_int_int(a) {
    return a + 5;
  },
};

function tlClassA() {
}
tlClassA.prototype = {
  methy: function classA_methy() {

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
