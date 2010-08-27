/**
 * @section{Overview}
 *
 * The aggregate documentation we want to present to the user is potentially
 *  comprised of multiple sources.  Namely:
 *
 * @itemize[
 *   @item{Documentation in the source code.  This can consist of overview
 *         descriptions or documentation explicitly associated with classes,
 *         functions, attributes, etc.  We would expect this to primarily
 *         end up as implementation documentation or API reference
 *         documentation.}
 *   @item{Documentation in dedicated documentation files.  This can consist
 *         of overview descriptions that would not make sense in a source
 *         file, tutorials, or user-focused reference documentation that would
 *         not benefit from being located in the implementing source files.}
 * ]
 *
 * Since these disparate sources need to be fused somewhere, they are fused
 *  here.  The doc fusion implementation is responsible understanding the
 *  sources and building a single resulting documentation representation.
 *
 *
 * @section{The documentable thing hierarchy}
 *
 * Documentable things are vaguely one of the following; I'm think to figure
 *  this out still:
 * @itemize[
 *   @item{
 *     A singleton type/object.
 *   }
 *   @item{
 *     A type.  Types are either actual JS types (native types or JS functions
 *     that get new'ed) or typedefs that describe a convention for using
 *     existing, possibly complex aggregate, types.
 *   }
 *   @item{
 *     Part of a type.  Which is to say, children of a type which we do not
 *     deign to break out more specifically into independently referencable
 *     entities which would then be referred to as another documentation thing
 *     kind.  The only way to get at these things is by a traversal of their
 *     ancestral (named) type.
 *   }
 *   @item{
 *     A function, specifically one that you do not 'new' and that does not use
 *     'this' to reference an object from which is retrieved.  If you 'new' it,
 *     then it is a type.  If it uses 'this' to reference an object from which
 *     it is retrieved (or strongly associated) then it is a method.
 *   }
 *   @item{
 *     A method.  Methods assume a 'this' which is a type and are part of that
 *     type's signature.
 *   }
 * ]
 *
 * @section{Modules, Published APIs, Private APIs, etc.}
 *
 * Our information on every module includes:
 * @itemize[
 *   @item{The exported namespace.}
 *   @item{The module namespace.}
 * ]
 *
 *
 *
 * @section{Namespaces, Dependencies, Completeness}
 *
 * Namespaces have the following hierarchy:
 * @itemize[
 *   @item{
 *   }
 * ]
 *
 * Code exposure results in:
 * - modules
 * - synthetic top-level type namespace (categorized)
 *
 **/

var unifile = require("narscribblus/utils/unifile");
var pkginfo = require("narscribblus/package-info");
var loader = require("narscribblus/scribble-loader");

/**
 * Represents / populates the documentation and possibly source for a given
 *  package.
 *
 * We have the following
 *
 * For JS source modules we can provide the following information:
 *
 */
function PackageFusion() {
  this.moduleInfoByName = {};
  this.pendingModuleInfos = {};
}
PackageFusion.prototype = {
  _publicTypesPopulated: false,

  /**
   * Make sure we have consumed all the (public) typedocs.
   */
  _populatePubTypes: function(aCallback) {
    var f = unifile.normFile();
    unifile.listMatchingDescendants();
  },

  requireModule: function(name, callback) {
    if (name in this.moduleInfoByName) {
      callback(this.moduleInfoByName[name]);
      return;
    }
    if (name in this.pendingModuleInfos) {
      this.pendingModuleInfos[name].callbacks.push(callback);
      return;
    }

    var minfo = this.pendingModuleInfos[name] = new ModuleInfo(name, this);
    minfo.callbacks = [callback];

    var dis = this;
    pkginfo.loadSource(name, function(sourceRef, source) {
      dis._gotSource(name, source);
    }, function(sourceRef, status) {
      dis._gotTrouble(name, status);
    });
  },

  _gotSource: function(name, source) {
    var minfo = this.pendingModuleInfos[name];
    minfo.source = source;
    var options = {
      mode: "meta",
      lang: "narscribblus/js",
      moduleInfo: minfo,
    };
    loader.parseDocument(source, name, options);

    this._moduleReady(minfo);
  },
  _gotTrouble: function(name, status) {
    console.error("Status", status, "while retrieving module", name);
  },

  _moduleReady: function(minfo) {
    this.moduleInfoByName[minfo.name] = minfo;
    delete this.pendingModuleInfos[minfo.name];

    var callbacks = minfo.callbacks;
    for (var i = 0; i < callbacks.length; i++) {
      callbacks[i].call(null, minfo);
    }
  }
};

/**
 *
 */
function ModuleInfo(name, fusion) {
  this.name = name;
  this.fusion = fusion;

  this.source = null;
  this.exportNS = null;
  this.globalNS = null;
}
ModuleInfo.prototype = {
};
exports.ModuleInfo = ModuleInfo;

/**
 * @return[PackageFusion]
 */
exports.getDocsForPackage = function getDocsForPackage(packageName, aCallback) {
  // figuring out the root of the package is a loader-specific decision.

};
