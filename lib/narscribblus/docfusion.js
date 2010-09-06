/**
 * @section{Overview}
 *
 * The aggregate documentation we want to present to the user is potentially
 *  comprised of multiple sources.  Namely:
 *
 * @itemize[
 *   @item{
 *     Documentation in the source code.  This can consist of overview
 *     descriptions or documentation explicitly associated with classes,
 *     functions, attributes, etc.  We would expect this to primarily end up as
 *     implementation documentation or API reference documentation.
 *   }
 *   @item{
 *     Documentation in dedicated documentation files.  This can consist of
 *     overview descriptions that would not make sense in a source file,
 *     tutorials, or user-focused reference documentation that would not benefit
 *     from being located in the implementing source files.
 *   }
 * ]
 *
 * Since these disparate sources need to be fused somewhere, they are fused
 *  here.  The doc fusion implementation is responsible for understanding the
 *  sources and building a single resulting documentation representation.
 *
 * There is an asymmetry between explicitly defined types using scribble syntax
 *  with jsdoc bits and those that are the emergent result of abstractly
 *  interpreted source with explicitly documented code blocks.  Source-based
 *  things end up being @xref{Symish} but hopefully behave the same way as the
 *  explicit types.  We do not try and force both varieties into the same
 *  implementation because they are conceptually different enough that it is
 *  probably less painful to just have code similarity than complex multipurpose
 *  code.
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
var pwomise = require("narscribblus/utils/pwomise");
var when = pwomise.when;

/**
 * Represents / populates the documentation and possibly source for a given
 *  package.
 *
 * We have the following
 *
 * For JS source modules we can provide the following information:
 *
 */
function PackageFusion(name) {
  this.name = name;
  // in-process module infos
  this.moduleInfoPromisesByName = {};
  // fully processed module infos
  this.moduleInfoByName = {};

  this.internalExportedThings = {};
  this.publicExportedThings = {};
  this.internalTypes = {};
  this.publicTypes = {};
  this.internalTerms = {};
  this.publicTerms = {};
}
PackageFusion.prototype = {
  /**
   * Have we processed all the documents in the typedocs folder to make sure we
   *  have all the global types available?
   */
  _publicTypesPopulated: false,

  /**
   * The union namespace of module exports in this package that have not been
   *  explicitly marked as public.  (We allow that maybe people will do weird
   *  naming things at public library boundaries that would clutter or confuse
   *  things internally.)
   */
  internalExportedThings: null,

  /**
   * The union namespace of the exports of all modules marked as public-facing.
   */
  publicExportedThings: null,

  /**
   * The namespace of types used internally within the package.  These may
   *  overlap with internalExportedThings where types are real JS types.  The
   *  extra additions we may contain are type conventions defined by typedef
   *  nodes.
   */
  internalTypes: null,

  /**
   * The namespace of types exposed publicly; similar to @lxref{internalTypes}.
   */
  publicTypes: null,

  /**
   * The namespace of documented terms for internal package usage.
   */
  internalTerms: null,

  /**
   * The namespace of documented public terms.
   */
  publicTerms: null,

  /**
   * Make sure we have consumed all the (public) typedocs.
   */
  _populatePubTypes: function(aCallback) {
    var f = unifile.normFile();
    unifile.listMatchingDescendants();
  },

  bootstrap: function() {
    return true;
  },

  /**
   * Get the @xref{ModuleInfo} for the given module, loading and processing the
   *  module as required.
   *
   * @args[
   *   @param[name String]{
   *     The module name as you would access via require().
   *   }
   *   @param[callback @func[
   *     @args[
   *       @param["module info" ModuleInfo]
   *     ]
   *   ]]
   * ]
   */
  requireModule: function(name) {
    if (name in this.moduleInfoByName)
      return this.moduleInfoByName[name];
    if (name in this.moduleInfoPromisesByName)
      return this.moduleInfoPromisesByName[name];

    var minfo = new ModuleInfo(name, this);

    var self = this;
    var minfoPromise = when(pkginfo.loadSource(name),
                            this._gotSource.bind(this, minfo),
                            this._gotTrouble.bind(this, minfo));
    return (this.moduleInfoPromisesByName[name] = minfoPromise);
  },

  _gotSource: function(minfo, source) {
    minfo.source = source;
    var options = {
      mode: "meta",
      lang: "narscribblus/js",
      moduleInfo: minfo,
    };
    return when(loader.parseDocument(source, name, options),
                this._moduleReady.bind(this, minfo),
                this._gotTrouble.bind(this, minfo));
  },
  _gotTrouble: function(minfo, status) {
    console.error("Status", status, "while retrieving module", minfo.name);
  },

  _moduleReady: function(minfo) {
    this._processModule(minfo);
    this.moduleInfoByName[minfo.name] = minfo;
    return minfo;
  },

  /**
   * Load the given document, passing it through the process and expand phases
   *  for side-effects but deferring the process phase of execution.
   */
  requireDoc: function(name) {

  },

  /**
   * Merge the contents of the source @xref{Namespace} into the target
   *  dictionary.
   *
   * @args[
   *   @param[srcNS Namespace]
   *   @param[targ Object]
   *   @param[filterFunc @func[
   *     @args[
   *       @param["sym" Symish]
   *     ]
   *     @return[Boolean]
   *   ]]{
   *     A filter to test whether the given symbol should be merged into the
   *     target.
   *   }
   * ]
   */
  _mergeInNamespace: function(srcNS, targ, filterFunc) {
    var kids = srcNS.childrenByName;
    for (var key in kids) {
      var sym = kids[key];
      if (filterFunc && !filterFunc(sym))
        continue;

      if (key in targ) {
        if (targ[key] !== kids[key])
          console.warn("non-identical collision, already got:", targ[key],
                       "now seeing:", kids[key], "(ignoring it)");
      }
      else {
        targ[key] = kids[key];
      }
    }
  },

  /**
   * Process the contents of the module to get all of its contributions to our
   *  various namespaces.
   */
  _processModule: function(minfo) {
    // - exports
    this._mergeInNamespace(minfo.exportNS,
                           minfo.isPublic ? this.publicExportedThings
                                          : this.internalExportedThings);

    function isType(sym) {
      return sym.isType;
    }

    // - types
    // public types only draw from exports...
    if (minfo.isPublic) {
      this._mergeInNamespace(minfo.exportNS, this.publicTypes, isType);
    }
    // whereas internal types draw from exports and the module global namespace
    else {
      this._mergeInNamespace(minfo.exportNS, this.internalTypes, isType);
      this._mergeInNamespace(minfo.globalNS, this.internalTypes, isType);
    }
  },

  /**
   * Process
   */
  _processDoc: function() {

  },

  /**
   * Attempt to translate the given unqualified string to something.  In events
   *  of collisions we should maybe return a disambiguation thing or similar.
   */
  resolveInternal: function(name) {
    if (name in this.internalTypes)
      return this.internalTypes[name];
    if (name in this.internalExportedThings)
      return this.internalExportedThings[name];
    return null;
  },
};

/**
 *
 */
function ModuleInfo(name, packageFusion) {
  this.name = name;
  this.pkg = packageFusion;

  this.source = null;
  this.exportNS = null;
  this.globalNS = null;

  this.rawExportsScope = null;

  // assume it's not a public facing module by default
  this.isPublic = false;

  this.fileDocNode = null;
  this.standaloneDocNodes = [];
}
ModuleInfo.prototype = {
};
exports.ModuleInfo = ModuleInfo;

function DocFusion() {
  this.packages = {};
}
DocFusion.prototype = {
  requireModule: function(name, baseId) {
    var pkgName = name.split("/")[0];
    // require("./foo") by "bar/baz/bog" should net "bar/baz/foo"
    if (pkgName === "." && baseId) {
      // (grab all but the last part, which loses the trailing "/") +
      // (the slash after the "." onwards)
      name = baseId.split("/").slice(0, -1).join("/") + pkgName.substring(1);
    }
    if (pkgName in this.packages) {
      return this.packages[pkgName].requireModule(name);
    }

    var pkgFusion = this.packages[pkgName] = new PackageFusion(name);
    return when(pkgFusion.bootstrap(), function() {
      return pkgFusion.requireModule(name);
    });
  },
};
exports.docFusion = new DocFusion();
