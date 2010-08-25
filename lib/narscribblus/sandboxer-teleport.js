
/**
 * For now, let's have our concept of a sandbox just be evaluating some code
 *  with our require handed in...
 */
exports.makeSandbox = function makeSandbox(code, globals, callback) {
  var globalStr, invokeArgs = [require];
  globalStr = "";
  for (var key in globals) {
    globalStr += "," + key;
    invokeArgs.push(globals[key]);
  }

  var deps = require.depends(code);
  require.ensure(deps, function() {
    console.info("success fetching deps for sandboxed code, running...");
    var wrappedCode = "var funk = function(require" + globalStr + ") {" + code +
                        "\n/**/}; funk;";
    var dafunk;
    try {
      dafunk = eval(wrappedCode);
    }
    catch (ex) {
      console.log("Errore!", ex, ex.fileName, ex.lineNumber);
    }
    dafunk.apply({}, invokeArgs);
    if (callback)
      callback();
  }, function errDepFetch() {
    console.error("problem fetching deps for sandboxed code");
  });
};
