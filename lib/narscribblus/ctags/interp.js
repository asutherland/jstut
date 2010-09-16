/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
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
 * The purpose of this interpreter in the context of narscribblus is to be able
 *  to link our syntax-highlighted code to the most useful documentation for
 *  any given token.  Static type inference is a non-goal (although it would
 *  admittedly be quite useful to check documentation against implementation).
 *
 * The 'most useful documentation' translates to:
 * @itemize[
 *   @item{API Methods: We want to expose the documentation for the API even if
 *         the actual method and its documentation have to journey through
 *         multiple required modules.}
 *   @item{API Arguments: If we know the API method in use and its arguments are
 *         documented, we want to be able to explain what each argument and its
 *         sub-components are up to.}
 * ]
 *
 * Because documentation is our concern and you have to trust someone, we trust
 *  the explicitly written documentation in all cases.  This allows us to make
 *  the following simplifying assumptions in the interpreter:
 * @itemize[
 * ]
 *
 * Because we want to avoid gratuitous manual annotations, we do require our
 *  interpeter to:
 * @itemize[
 *   @item{Load and interpret to the same approximation all required modules.}
 *   @item{Track propagation of values with their associated documentation
 *         blocks.}
 * ]
 **/

require.def("narscribblus/ctags/interp",
  [
    "exports",
    "narscribblus/utils/pwomise",
    "narscribblus/narcissus/jsdefs",
    "narscribblus/narcissus/jsparse",
  ],
  function (
    exports,
    pwomise,
    jsdefs,
    jsparse
  ) {

var when = pwomise.when;
var tokenIds = jsdefs.tokenIds, tokens = jsdefs.tokens;

// stub out nativeFns for now since we don't use it.
var nativeFns = {};


const INDEXED_TYPES  = { 'function': true, object: true, othermodule: true };
const LOADABLE_TYPES = { activation: true, 'function': true, object: true,
                         othermodule: true };
// no storing into other modules' export namespaces.  (Although things can
//  reach into their innards and monkeypatch stuff.  Sadly we don't track that
//  so that can get ugly...)
const STORABLE_TYPES = { activation: true, 'function': true, object: true };


const REGEX_ESCAPES = { "\n": "\\n", "\r": "\\r", "\t": "\\t" };

function clone(o) {
  var r = {};
  for (var key in o) {
    r[key] = o[key];
  }
  return r;
}

function note(node, str) {
    console.info(node.lineno + ":note: " + str);
}

function warn(node, str) {
    console.warn(node.lineno + ":warn: " + str);
}

function error(node, str) {
    console.error(node.lineno + ":error: " + str);
}

function FunctionObject(interp, node, scope) {
    this.interp = interp;
    this.node = node;
    this.scope = scope;
    this.data = {};
    this.proto = { type: 'object', data: {} };
};

FunctionObject.prototype = {
    callReturningScope: function(ctx, thisObject, args) {
        var activation = { type: 'activation', data: {} };
        var params = this.node.params;
        for (var i = 0; i < args.data.length; i++) {
            activation.data[this.node.params[i]] = args.data[i];
        }
        // XXX this used to happen, but nothing in here knows how to use it and
        //  it was't a list anyways...
        //activation.data.arguments = activation;

        var newContext = clone(ctx);
        newContext.scope = { object: activation, parent: this.scope };

        try {
            this.interp._exec(this.node.body, newContext);
        } catch (e) {
            if (e === 'return') {
                return newContext.result;
            }

            throw e;
        }

        return activation;
    },
    call: function(ctx, thisObject, args) {
        this.callReturningScope(ctx, thisObject, args);

        return { type: 'scalar', data: undefined };
    },

    props: {
        prototype: {
            get: function() { return this.proto; },
            set: function(newValue) {
              // Even out of the game we have a prototype, but make note if
              //  someone explicitly assigns an object to our prototype field.
              this.explicitProto = true;
              this.proto = newValue;
            }
        }
    },

    type: 'function'
};

/**
 *
 */
exports.InterpSandbox = function InterpSandbox(docFusion) {
  this.docFusion = docFusion;
};
exports.InterpSandbox.prototype = {
  /**
   * Interpret an unnamed snippet that executes inside a sandbox that no one
   *  else can ever refer to but is capable of require()ing other modules.
   *
   * Our method of dealing with require() invocations is somewhat silly.  Since
   *  the interpretation is synchronous, anything that needs to do something
   *  asynchronous creates a promise and throws it.  We catch it, hook ourselves
   *  up to reprocess when the require is fulfilled, and return that new
   *  promise.  We create a new interpreter each time and reprocess everything
   *  from scratch because we have no way to pick up where we left off and the
   *  code might behave differently if executed in its already existing context.
   *  This is obviously a candidate for improvement, although aggressive
   *  pre-fetching might be a reasonable stop-gap mitigation.
   */
  processAnonSnippet: function(preAsts, realAst, moduleName) {
    var self = this;
    function processUntilWeHitAPromise() {
      var interp = new exports.Interpreter({
        commonJS: true,
        sandbox: self,
        moduleName: moduleName,
      });
      try {
        for (var iPre = 0; iPre < preAsts.length; iPre++) {
          // I originally was planning not to annotate tokens in this mode, but
          //  that requires that the preAsts have already been annotated, which
          //  is more dependency stuff that I haven't dealt with yet.  Since
          //  all the annotation is actually
          interp.interpretAst(preAsts[iPre], false);
        }
        interp.interpretAst(realAst, true);
      }
      catch (ex) {
        if (pwomise.isPromise(ex))
          return when(ex, processUntilWeHitAPromise);
      }

      return interp;
    };

    return processUntilWeHitAPromise();
  },

  processModule: function(ast, moduleName) {
    return this.processAnonSnippet([], ast, moduleName);
  },
};

/**
 * Interpreteters exist on a one-to-one basis with
 */
exports.Interpreter = function(opts) {
  this.opts = opts;
  this.annotateTokens = false;
  this.setupContext();
};

exports.Interpreter.prototype = {
    /**
     * Pierces 'ref' value types, otherwise returning the value untouched.  Ref
     *  types always have a container (sometimes the global object) and may
     *  require invoking getters (on success), punting on things that would
     *  trigger an exception during normal operation, or propagating of
     *  existing punts into new punts.
     */
    _deref: function(value) {
        if (value.type === 'ref') {
            var name = value.name, container = value.container;

            var result;
            if (!(container.type in LOADABLE_TYPES)) {
                result = this.getNullValue();
            } else if ('props' in container && name in container.props) {
                var prop = container.props[name];
                if ('get' in prop) {
                    result = prop.get.call(container);
                } else {
                    // true behavior: exception
                    warn(container.node, "returning null for get() because " +
                        "no getter is defined for property \"" + name + "\"");
                    result = this.getNullValue();
                }
            } else if (!(name in container.data)) {
                // coerceToStorable can turn this into a real object when it
                //  gets _stored to.
                result = { type: 'unresolved', ref: value, data: undefined };
            } else {
                result = container.data[name];
            }

            if (nativeFns.hasOwnProperty(name)) {
                result = clone(result);
                result.nativeFn = nativeFns[name];
            }

            return result;
        }

        return value;
    },

    _dumpScope: function(scope, i) {
        if (i == null) {
            i = 0;
        }

        console.debug("scope " + i + ":");
        for (var key in scope.object.data) {
            console.debug("var " + key + ";");
        }

        if (scope.parent != null) {
            this._dumpScope(scope.parent, i + 1);
        }
    },

    /**
     * (Recursively) execute the given AST node/its children within our
     *  simulated world.
     */
    _exec: function(node, ctx) {
        var self = this;

        function deref(val) { return self._deref(val); }
        function exec(node) { return self._exec(node, ctx); }

        switch (node.type) {
        case tokenIds.FUNCTION:
            // DECLARED_FORM is not processed here because they end up in the
            //  funDecls list which is processed in the SCRIPT case.
            if (node.functionForm === jsparse.DECLARED_FORM) {
                return undefined;
            }

            var isStatement = node.functionForm === jsparse.STATEMENT_FORM;
            if (node.name != null && !isStatement) {
                // Introduce a new scope.
                var scopeObj = { type: 'object', data: {} };
                ctx.scope = { object: scopeObj, parent: ctx.scope };
            }

            var fn = new FunctionObject(this, node, ctx.scope);

            if (isStatement) {
                ctx.scope.object.data[node.name] = fn;
            }

            return fn;

        case tokenIds.SCRIPT:
            // (function declarations contribute their names to their enclosing
            //  (global/module) scope)
            node.funDecls.forEach(function(decl) {
                var fn = new FunctionObject(this, decl, ctx.scope);
                ctx.scope.object.data[decl.name] = fn;
            }, this);
            // (variable declarations contribute their names to their scope too.
            //  they are undefined until they hit their defining VAR(s).)
            node.varDecls.forEach(function(decl) {
                ctx.scope.object.data[decl.name] = {
                    node:   decl,
                    type:   'undefined',
                    data:   null
                };
            });

            // FALL THROUGH
        case tokenIds.BLOCK:
            node.forEach(exec);
            break;

        case tokenIds.CONST: // XXX semantic issues are possible
        case tokenIds.VAR:
            node.forEach(function(decl) {
                var init = decl.initializer;
                if (init == null) {
                    return;
                }

                var name = decl.name;
                var scope = ctx.scope;
                // find the scope to which the variable belongs
                while (scope != null) {
                    if (Object.hasOwnProperty.call(scope.object.data, name)) {
                        break;
                    }
                    scope = scope.parent;
                }

                var value = deref(exec(init));
                scope.object.data[name] = value;
            }, this);
            break;

        case tokenIds.SEMICOLON:
            if (node.expression != null) {
                exec(node.expression);
            }
            break;

        case tokenIds.ASSIGN:
            // TODO: +=, -=, &c.
            var lhs = exec(node[0]);
            var rhs = deref(exec(node[1]));
            this._store(lhs, rhs, ctx);
            return rhs;

        case tokenIds.DOT:
            var lhs = exec(node[0]);
            var container = deref(lhs);
            var name = node[1].value;
            rv = {
                type: 'ref',
                container: container,
                name: name,
                node: node
            };
            if (this.annotateTokens)
                node.interpObj = ["ref", rv];
            return rv;

        case tokenIds.LIST:
            var args = { type: 'list', node: node };
            ///args.data = node.map(exec).map(deref);
            args.data = node.map(function(argnode, index) {
              if (this.annotateTokens) {
                argnode.interpObj = ["arg", {owner: node,
                                             index: index}];
              }
              return deref(exec(argnode));
            }, this);
            // note: our CALL annotates our node...
            return args;

        case tokenIds.CALL:
            var lhs = exec(node[0]);
            // probably a LIST; ??? on the operators case. returns a 'list' type
            var rhs = exec(node[1]);
            if (this.annotateTokens) {
              node[1].interpObj = ["arglist", {func: node[0]}];
            }

            var thisObject = (lhs.type === 'ref' ? lhs.container : null);
            if (thisObject != null && thisObject.type === 'activation') {
                thisObject = null;
            }

            var fn = deref(lhs);
            if ('nativeFn' in fn) {
                return fn.nativeFn(this, ctx, thisObject, rhs);
            }

            if (fn.type !== 'function') {
                // if we haven't abstract interpreted it ourselves to form a
                //  function, we can't perform a call.  this is fine.
                // XXX although maybe we should be indicating a return value
                //  thing via interpObj so that the traverser can figure things
                //  out.
                return this.getNullValue();
            }

            return fn.call(ctx, thisObject, rhs);

        case tokenIds.NEW_WITH_ARGS:
            // We want to make sure we process the arguments too.
            if (this.annotateTokens) {
              exec(node[1]);
              node[1].interpObj = ["arglist", {func: node[0]}];
            }
        case tokenIds.NEW:
            // For the purposes of the traverser we are evaluating the newed
            //  thing but we are currently not having the abstract interpreter
            //  do anything further with this (note how we're not using it as
            //  our return value.)
            if (this.annotateTokens)
              node.interpObj = ["new", deref(exec(node[0])).node];
            return { type: 'object', data: {}, node: node };

        case tokenIds.OBJECT_INIT:
            var data = {}, accessors = null;
            node.forEach(function(init) {
                switch (init.type) {
                case tokenIds.PROPERTY_INIT:
                    var name = init[0].value;
                    if (this._safeIdentifier(name)) {
                        data[name] = deref(exec(init[1]));
                    }
                    if (this.annotateTokens) {
                      init[0].interpObj = ["attr", {owner: node,
                                                    name: name}];
                      init[1].interpObj = ["attrval", {attr: init[0]}];
                    }
                    break;

                // getters/setters via syntax are boring for purposes of abstract
                //  interpretation; specifically, I don't see a sane namespace
                //  setup that requires them to actively be doing things.
                //  (Interesting propagation must involve helper functions,
                //  which we do need to care about at some point.)
                //  However, we really do want to be able to know when they are
                //  defined.
                case tokenIds.GETTER:
                case tokenIds.SETTER:
                  if (!accessors)
                    accessors = {};
                  if (!(init.name in accessors))
                    accessors[init.name] = [null, null];
                  accessors[init.name][(init.type === tokenIds.GETTER)? 0 : 1] =
                    init;
                  break;

                default:
                    warn(node, "unsupported initializer: " + tokens[init.type]);
                }
            }, this);
            var o = { type: 'object', data: data, node: node };
            if (accessors)
              o.accessors = accessors;
            return o;

        case tokenIds.IDENTIFIER:
            // (find the scope for the identifier, failing over to global scope)
            var scope = ctx.scope;
            while (scope != null) {
                if (node.value in scope.object.data) {
                    break;
                }
                scope = scope.parent;
            }

            var container = (scope != null) ? scope.object : ctx.global;
            var name = node.value;
            var rv = {
                type: 'ref',
                container: container,
                name: name,
                node: node
            };
            if (this.annotateTokens)
                node.interpObj = ["ref", rv];
            return rv;

        case tokenIds.NUMBER:
            return { type: 'number', data: node.value, node: node };

        case tokenIds.UNARY_MINUS:
            rhs = deref(exec(node[0]));
            return { type: 'number', data: -rhs.value, node: node };

        case tokenIds.STRING:
            return { type: 'string', data: node.value, node: node };

        case tokenIds.REGEXP:
            return { type: 'regexp', data: node.value, node: node };

        case tokenIds.TRUE:
            return { type: 'boolean', data: true, node: node };

        case tokenIds.FALSE:
            return { type: 'boolean', data: false, node: node };

        case tokenIds.NULL:
            return this.getNullValue();

        case tokenIds.GROUP:
            return exec(node[0]);

        case tokenIds.RETURN:
            // XXX the return idiom was partially in place before
            //  narscribblus came to town; filling it out / running with it
            //  for now.
            ctx.result = deref(exec(node.value));
            throw 'return';

        case tokenIds.ARRAY_INIT:
          // we now care about arrays, specifically for the list of dependencies
          //  to require.def.
          var arr = { type: 'list', node: node };
          arr.data = node.map(function(arrnode, index) {
                                return deref(exec(arrnode));
                              });
          return arr;

        default:
            warn(node, "unknown token \"" + tokens[node.type] + "\"");
            return this.getNullValue();
        }
    },

    // Determines the kind of a tag from the tag data.
    _getTagKind: function(tag) {
        if (tag.type === 'function') {
            return 'f';
        }
        if ('class' in tag || 'namespace' in tag) {
            return 'm';
        }
        return 'v';
    },

    _regexify: function(str) {
        function subst(ch) {
            return (ch in REGEX_ESCAPES) ? REGEX_ESCAPES[ch] : "\\" + ch;
        }
        return "/^" + str.replace(/[\\/$\n\r\t]/g, subst) + "$/";
    },

    // Make sure identifiers are safe (__proto__ and friends can kill us).
    _safeIdentifier: function(name) {
        return typeof(name) !== 'string' || name.indexOf("__") !== 0;
    },

    _store: function(dest, src, ctx) {
        if (dest.type !== 'ref') {
            return;     // true behavior: ReferenceError
        }

        var container = dest.container;
        this.coerceToStorable(container, ctx);

        var name = dest.name;
        if ('props' in container && name in container.props) {
            var prop = container.props[name];
            if ('set' in prop) {
                prop.set.call(container, src);
            } else {
                // true behavior: exception
                warn(dest.node, "not storing because no setter is " +
                    "defined for property \"" + name + "\"");
            }
        } else if (this._safeIdentifier(name)) {
            container.data[name] = src;
        }
    },

    coerceToStorable: function(value, ctx) {
        if (value.type in STORABLE_TYPES) {
            return;
        }

        if (value.type === 'unresolved') {
            // Make the unresolved value spring into existence!
            this._store(value.ref, value, ctx);
        }

        value.type = 'object';
        value.data = {};
    },

    getNullValue: function() {
        return { type: 'null', data: null };
    },

    setupContext: function() {
        var window = { hidden: true, type: 'object', data: {},
                       isGlobal: true };
        window.data.window = window;

        var opts = this.opts;
        var ctx = { global: window, scope: { parent: null } };

        if (!opts.commonJS) {
            ctx.scope.object = window;
        } else {
            var exports = {
              hidden: true,
              type: 'object',
              isExports: true,
              data: {},
            };
            var require = {
              hidden: true,
              type: 'function',
              nativeFn: docRequire,
              data: {
                def: {
                  type: 'function',
                  nativeFn: docRequireDef,
                }
              }
            };
            ctx.scope.object = {
              type: 'object',
              isGlobal: true,
              data: {
                exports: exports,
                require: require,
              }
            };
            ctx.global = ctx.scope.object;
        };

        this.ctx = ctx;
    },

    /**
     * Interpret the given AST.
     *
     * @args[
     *   @param[ast]{
     *     The ast to abstractly interpret for side-effects.
     *   }
     *   @param[annotateTokens #:optional Boolean]{
     *     When enabled we place interpObj attributes on interesting AST nodes
     *     that amount to reverse-linkages so that tokens can explain themselves
     *     in their enclosing hiearchy.
     *
     *     This is more than just being able to explain what identifiers
     *     lexically resolve to; this also includes being able to know that
     *     the "foo" key belongs to an object definition that is part of the
     *     "bar" key's value in an object that is the first argument to a
     *     function which we are able to resolve back to its origin and thereby
     *     acquire its documentation.
     *   }
     * ]
     */
    interpretAst: function(ast, annotateTokens) {
      this.annotateTokens = annotateTokens;
      this._exec(ast, this.ctx);
    },

    getScopes: function() {
      // copy the contents of the global scope skipping things we put in there
      //  ourselves.
      var globalScope = {};
      var gdata = this.ctx.global.data;
      for (var key in gdata) {
        var val = gdata[key];
        if (val.hidden)
          continue;
        globalScope[key] = val;
      }

      return {
        global: globalScope,
        exports: gdata.exports.data,
      };
    },
};

/**
 * An implementation of require that resolves the module, loads the source code,
 *  parses it, then runs it through the abstract interpreter in order to
 *  derive documentation.
 */
function docRequire(interp, ctx, thisObject, args) {
  var moduleNames, i;
  if (args.data[0].type === "list") {
    moduleNames = [];
    for (i = 0; i < args.data[0].data.length; i++) {
      var argObj = args.data[0].data[i];
      if (argObj.type !== "string")
        throw new Error("module names must be literals!");
      moduleNames.push(argObj.data);
    }
  }
  else if (args.data[0].type === "string") {
    moduleNames = [args.data[0].data];
  }

  var sandbox = interp.opts.sandbox;
  var baseId = interp.opts.moduleName;

  var depPromises = [];
  var moduleExports = [];
  for (i = 0; i < moduleNames.length; i++) {
    var minfoOrPromise = sandbox.docFusion.requireModule(moduleNames[i]);
    if (pwomise.isPromise(minfoOrPromise))
      depPromises.push(minfoOrPromise);
    else
      moduleExports.push(minfoOrPromise.rawExportsScope);
  }

  if (depPromises.length) {
    if (depPromises.length === 1)
      throw depPromises[0];
    throw pwomise.all(depPromises, "require");
  }

  // asynchronous variant with a callback?
  if (args.data.length === 2) {
    if (args.data[1].type !== "function")
      throw new Error("second argument to require expected to be a callback");
    var funcArgs = {
      data: moduleInfos,
    };
    return args.data[1].call(ctx, thisObject, funcArgs);
  }

  if (moduleExports.length != 1)
    throw new Error("should only have 1 module to return...");
  return moduleExports[0];
}

/**
 * An implementation of require.def as used by RequireJS or other compatible
 *  Transport/C / Asynchronous (Module) Definition mechanism.
 *
 * This ends up more efficient than the docRequire invocation because we get
 *  to know the names of all the modules to import all at once (which we fuse).
 *
 * The simulated function call is:
 * @func[
 *   @args[
 *     @param["defined module name" String]
 *     @param["deps" @listof[
 *       "module name"
 *     ]]
 *     @param["func" @func[
 *       @args[
 *         @rest["module export value"]
 *       ]
 *     ]]
 *   ]
 * ]
 */
function docRequireDef(interp, ctx, thisObject, args) {
  var moduleNameInterp = args.data[0];
  var depsInterp = args.data[1];
  var funcInterp = args.data[2];

  var sandbox = interp.opts.sandbox;
  var baseId = interp.opts.moduleName;

  var depPromises = [];
  var moduleExports = [];
  console.log("docRequireDef", args);
  if (true) {
    for (var i = 0; i < depsInterp.data.length; i++) {
      var depModuleName = depsInterp.data[i].data;
      console.log("depModuleName", depModuleName);

      if (depModuleName === "require") {
        moduleExports.push(interp.ctx.global.data.require);
        continue;
      }
      else if (depModuleName === "exports") {
        moduleExports.push(interp.ctx.global.data.exports);
        continue;
      }
      else if (depModuleName === "module") {
        // module just has a setExports function to replace exports.
        moduleExports.push({
          type: 'object',
          data: {
            setExports: {
              type: 'function',
              nativeFun: function (interp, ctx, thisObject, args) {
                interp.ctx.global.data.exports = args.data[0];
              }
            }
          }
        });
        continue;
      }

      var minfoOrPromise = sandbox.docFusion.requireModule(depModuleName);
      if (pwomise.isPromise(minfoOrPromise))
        depPromises.push(minfoOrPromise);
      else
        moduleExports.push(minfoOrPromise.rawExportsScope);
    }

    if (depPromises.length)
      throw pwomise.all(depPromises, "require.def");

    var funcArgs = {
      data: moduleExports,
    };
    // XXX this will be unhappy if we ever have a consolidated file, but for
    //  the normal 1:1 case, this is good...
    // clobber the global namespace with the function activation record...
    var origGlobalData = interp.ctx.global.data;
    interp.ctx.global.data =
      funcInterp.callReturningScope(ctx, thisObject, funcArgs).data;
    return { type: 'scalar', data: undefined };
  }

  throw new Error("unpossible");
}

}); // end require.def
