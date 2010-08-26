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

// Abstract interpreter, based on Narcissus.

var jsdefs = require('narscribblus/narcissus/jsdefs');
var jsparse = require('narscribblus/narcissus/jsparse');
var nativeFns = require('./nativefn').nativeFns;
var tokenIds = jsdefs.tokenIds, tokens = jsdefs.tokens;

const INDEXED_TYPES  = { 'function': true, object: true };
const LOADABLE_TYPES = { activation: true, 'function': true, object: true };
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
    call: function(ctx, thisObject, args) {
        var activation = { type: 'activation', data: {} };
        var params = this.node.params;
        for (var i = 0; i < args.data.length; i++) {
            activation.data[this.node.params[i]] = args.data[i];
        }
        activation.data.arguments = activation;

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

        return { type: 'scalar', data: undefined };
    },

    props: {
        prototype: {
            get: function() { return this.proto; },
            set: function(newValue) { this.proto = newValue; }
        }
    },

    type: 'function'
};

/**
 *
 */
exports.InterpSandbox = function InterpSandbox() {
  // maps (absolute) module names to their Interpreter.
  this.moduleInfos = {};
};
exports.InterpSandbox.prototype = {
  /**
   *
   */
  requireModule: function(name) {
    if (name in this.moduleInfos)
      return this.moduleInfos[name]
  },

  /**
   * Interpret an unnamed snippet that executes inside a sandbox that no one
   *  else can ever refer to but is capable of require()ing other modules.
   */
  processAnonSnippet: function(ast, name) {
    var interp = new exports.Interpreter(ast, "anon:" + name, [],
                                         {commonJS: true, sandbox: this});
    interp.interpret();
    dump("*** INTERP " + name + "\n");
    dump(JSON.stringify(interp.tags) + "\n\n");
  },
};

/**
 * Interpreteters exist on a one-to-one basis with
 */
exports.Interpreter = function(ast, filename, lines, opts) {
    this.ast = ast;
    this.file = filename;
    this.lines = lines;
    this.opts = opts;
    this.tags = [];
};

exports.Interpreter.prototype = {
    /**
     * Process an attribute on an object/prototype for tag generation.
     */
    _addSubtag: function(parentTag, name, value, stack, prototypeMember) {
        if (stack.indexOf(value) !== -1) {
            return;     // avoid cyclic structures
        }

        var tag = {};
        tag.name = name;
        if ('name' in parentTag) {  // Do we have a parent?
            if ('class' in parentTag) {
                // If one or more of our parents is getting assigned to a
                // prototype, then we're part of a class.
                tag['class'] = parentTag['class'] + "." + parentTag.name;
            } else {
                var path =  ('namespace' in parentTag)
                            ? parentTag.namespace + "." + parentTag.name
                            : parentTag.name;

                if (prototypeMember) {
                    tag['class'] = path;
                } else {
                    tag.namespace = path;
                }
            }
        }

        if ('module' in parentTag) {
            tag.module = parentTag.module;
        }

        this._addValue(value, tag, stack.concat(value));
    },

    /**
     * Process an interesting value for tag generation.  If it is a complex
     *  value (Function with prototype, Object, etc.), process it for subtags
     *  using _addSubtag.
     */
    _addValue: function(value, baseTag, stack) {
        if (stack == null) {
            stack = [ value ];
        }

        // Create the tag.
        var tag = {};
        for (var tagfield in baseTag) {
            tag[tagfield] = baseTag[tagfield];
        }
        tag.type = value.type;
        tag.kind = this._getTagKind(tag);

        var node = value.node;
        if (node != null) {
            tag.tagfile = node.filename;
            tag.addr = ""; //this._regexify(this.lines[node.lineno - 1]);

            // Make sure tags won't get sorted above the metadata...
            if (/^[^\001-!]/.test(tag.name)) {
                this.tags.push(tag);
            }
        }

        // Stop here if there are no members of this value to consider.
        if (!(value.type in INDEXED_TYPES)) {
            return;
        }

        // Recurse through members.
        var data = value.data;
        for (var name in data) {
            var subvalue = data[name];
            if (!subvalue.hidden) {
                this._addSubtag(tag, name, subvalue, stack, false);
            }
        }

        // Stop here if there's no sane prototype.
        if (value.type !== 'function' ||
                !(value.proto.type in INDEXED_TYPES)) {
            return;
        }

        // Recurse through the prototype.
        var proto = value.proto;
        for (var name in proto.data) {
            var subvalue = proto.data[name];
            if (!subvalue.hidden) {
                this._addSubtag(tag, name, subvalue, stack, true);
            }
        }
    },

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
                result = { type: 'unresolved', ref: value, data: null };
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
            return {
                type: 'ref',
                container: container,
                name: name,
                node: node
            };

        case tokenIds.LIST:
            var args = { type: 'list', node: node };
            args.data = node.map(exec).map(deref);
            args.data.length = node.length;
            return args;

        case tokenIds.CALL:
            var lhs = exec(node[0]);
            var rhs = exec(node[1]);

            var thisObject = (lhs.type === 'ref' ? lhs.container : null);
            if (thisObject != null && thisObject.type === 'activation') {
                thisObject = null;
            }

            var fn = deref(lhs);
            if ('nativeFn' in fn) {
                return fn.nativeFn(this, ctx, thisObject, rhs);
            }

            if (fn.type !== 'function') {
                note(node, "not a function");
                return this.getNullValue();
            }

            return fn.call(ctx, thisObject, rhs);

        case tokenIds.NEW:
        case tokenIds.NEW_WITH_ARGS:
            // Just enough to allow subclassing to work.
            return { type: 'object', data: {}, node: node };

        case tokenIds.OBJECT_INIT:
            var data = {};
            node.forEach(function(init) {
                switch (init.type) {
                case tokenIds.PROPERTY_INIT:
                    var name = init[0].value;
                    if (this._safeIdentifier(name)) {
                        data[init[0].value] = deref(exec(init[1]));
                    }
                    break;

                default:
                    warn(node, "unsupported initializer: " + tokens[init.type]);
                }
            }, this);
            return { type: 'object', data: data, node: node };

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
            return rv;

        case tokenIds.NUMBER:
            return { type: 'number', data: node.value, node: node };

        case tokenIds.STRING:
            return { type: 'string', data: node.value, node: node };

        case tokenIds.REGEXP:
            return { type: 'regexp', data: node.value, node: node };

        case tokenIds.GROUP:
            return exec(node[0]);

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

    /** Discovers the tags in the Narcissus-produced AST. */
    interpret: function() {
        var window = { hidden: true, type: 'object', data: {} };
        window.data.window = window;

        var opts = this.opts;
        var ctx = { global: window, scope: { parent: null } };

        if (!opts.commonJS) {
            ctx.scope.object = window;
        } else {
            var exports = { hidden: true, type: 'object', data: {} };
            var require = {
              hidden: true,
              type: 'function',
              nativeFn: docRequire,
            };
            ctx.scope.object = { type: 'object', data: { exports: exports,
                                                         require: require } };
        };

        this._exec(this.ast, ctx);

        if (!opts.commonJS) {
            var scope = ctx.scope;
            while (scope !== null) {
                this._addValue(scope.object, {});
                scope = scope.parent;
            }
        } else {
            this._addValue(window, {});
            this._addValue(exports, { module: opts.module });
        }
    }
};

/**
 * An implementation of require that resolves the module, loads the source code,
 *  parses it, then runs it through the abstract interpreter in order to
 *  derive documentation.
 */
function docRequire(interp, ctx, thisObject, args) {
  var moduleName = args.data[0].node.value;
  dump("REQUIRING " + moduleName + "\n");
  return interp.opts.sandbox.requireModule(moduleName);
}
