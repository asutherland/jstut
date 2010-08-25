/**
 * Abstract sandbox creation in a jetpack context.  An intermediary step on the
 *  road to also being able to run in an unprivileged web browser context.
 *
 * The big question is whether we want to be able to play in the same 'sandbox'
 *  as the rest of the system.  The current theory for wmsy documentation is
 *  "no", but we might want to change that up to let the debug UI stuff poke
 *  at things.  (Although that might just imply some sort of bridge...)
 **/

var sm = require("securable-module");

exports.makeSandbox = function makeSandbox(code, globals, callback) {
  // let them have our console...
  globals.console = console;
  var loader = new sm.Loader({
    // use the same roots as the root loader...
    rootPaths: packaging.options.rootPaths.slice(),
    defaultPrincipal: "system",
    globals: globals,
  });

  var rval = loader.runScript(code);
  if (callback)
    callback();
  return rval;
};
