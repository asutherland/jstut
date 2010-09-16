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

require.def("narscribblus-plat/sandboxer",
  [
    "exports",
  ],
  function (
    exports
  ) {

/**
 * Create a sandbox by:
 * @itemize[
 *   @item{
 *     Creating a script tag in the requested document.
 *   }
 *   @item{
 *     Using a regex against the code in question to figure out what the
 *     dependencies are so that the code can use synchronous require.  (When
 *     RequireJS supports this, we will use that instead.)  Use that to wrap
 *     the code in a require()'d block dependent on those modules.
 *   }
 *   @item{
 *     Wrapping the code so that we are notified after all of its dependencies
 *     are loaded and it is parsed up.  Then we are able to directly invoke
 *     the function with the arguments passed in for execution.
 *   }
 * ]
 *
 * We currently do not do but should consider:
 * @itemize[
 *   @item{
 *     Try and run things in their own independent universe.  Specifically, we
 *     do not instantiate new instances of the dependent modules, so the
 *     sandboxed code is not really sandboxed right now.  Since we do not
 *     mediate DOM interaction or the like like jetpack tries to do, an iframe
 *     that we can just destroy might be the best way to deal with that.
 *   }
 *   @item{
 *     Support the executed code defining multiple modules on its own.
 *   }
 * ]
 *
 * @args[
 *   @param[name String]{
 *     Document-unique name for the code execution.
 *   }
 *   @param[doc Document]{
 *     The DOM document in which
 *   }
 *   @param[code String]{
 *     The source code to execute.
 *   }
 *   @param[args @dictof[
 *     @key["variable name"]
 *     @value["variable value"]
 *   ]]
 *   @param[callback]
 * ]
 */
exports.makeSandbox = function makeSandbox(name, innerDoc,
                                           code, args, callback) {
  var globalStr, invokeArgs = [];
  globalStr = "";
  for (var key in args) {
    if (globalStr.length)
      globalStr += ",";
    globalStr += key;
    invokeArgs.push(args[key]);
  }

  var outerDoc = document;

  var deps = [];
  code.replace(/require\(("[^\"]*")\)/g,function(t,m){deps.push(m);});

  var outerWin = outerDoc.defaultView;
  if (!("sandboxCallbacks" in outerWin))
    outerWin.sandboxCallbacks = {};

  outerWin.sandboxCallbacks[name] = function(dafunk) {
    dafunk.apply({}, invokeArgs);
    callback();
  };

  var wrappedCode = "require(['require'," + deps.join(",") + "],\n" +
    "function(require) {" +
    "sandboxCallbacks['" + name + "'](function(" + globalStr + ") {" +
    code + "\n/**/})});";

  var scriptId = "sandbox-" + name;
  var scriptElem = outerDoc.getElementById(scriptId);
  if (scriptElem) {
    scriptElem.parentNode.removeChild(scriptElem);
  }
  scriptElem = outerDoc.createElement("script");
  scriptElem.setAttribute("id", scriptId);
  scriptElem.textContent = wrappedCode;
  outerDoc.getElementsByTagName("head")[0].appendChild(scriptElem);
};

}); // end require.def
