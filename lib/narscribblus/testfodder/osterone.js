
var tlNumber = 1;
var tlBoolean = true;
var tlNull = null;
var tlString = "imastring";

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
