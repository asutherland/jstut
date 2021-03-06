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

define(
  [
    "jstut-plat/utils/unifile",
    "jstut-plat/package-info",
    "jstut/doc-loader",
    "jstut/utils/pwomise",
    "exports"
  ],
  function(
    unifile,
    $pkginfo,
    loader,
    pwomise,
    exports
  ) {
var when = pwomise.when;

var $path = {};
$path.basename = function basename(p) {
  var idxLastSlash = p.lastIndexOf('/');
  if (idxLastSlash === -1)
    return p;
  return p.slice(idxLastSlash + 1);
};
$path.dirname = function basename(p) {
  var idxLastSlash = p.lastIndexOf('/');
  if (idxLastSlash === -1)
    return p;
  return p.slice(0, idxLastSlash + 1);
};
$path.join = function join(a, b) {
  if (a[a.length - 1] !== '/')
    return a + '/' + b;
  return a + b;
};

/**
 * Represents / populates the documentation and possibly source for a given
 *  package.
 */
function PackageFusion(owningDocFusion, name, options) {
  this.docFusion = owningDocFusion;
  this.name = name;
  // in-process module infos
  this.moduleInfoPromisesByName = {};
  // fully processed module infos
  this.moduleInfoByName = {};

  this.docInfoPromisesByName = {};
  this.docInfoByName = {};

  /**
   * Have we processed all the documents in the typedocs folder to make sure we
   *  have all the global types available?
   */
  this._publicTypesPopulated = false;

  /**
   * The union namespace of module exports in this package that have not been
   *  explicitly marked as public.  (We allow that maybe people will do weird
   *  naming things at public library boundaries that would clutter or confuse
   *  things internally.)
   */
  this.internalExportedThings = {};
  /**
   * The union namespace of the exports of all modules marked as public-facing.
   */
  this.publicExportedThings = {};
  /**
   * The namespace of types used internally within the package.  These may
   *  overlap with internalExportedThings where types are real JS types.  The
   *  extra additions we may contain are type conventions defined by typedef
   *  nodes.
   */
  this.internalTypes = {};
  /**
   * The namespace of types exposed publicly; similar to @lxref{internalTypes}.
   */
  this.publicTypes = {};
  /**
   * The namespace of documented terms for internal package usage.
   */
  this.internalTerms = {};
  /**
   * The namespace of documented public terms.
   */
  this.publicTerms = {};

  /**
   * @listof["test filename"]
   */
  this.testFiles = null;

  /**
   * The documentation path for this package, if available.  The documentation
   *  path root is where we find the "jstut.json" file.
   */
  this.__docPath = null;
  this.__sourceMountPaths = {};
}
PackageFusion.prototype = {
  boring: false,

  /**
   * Make sure we have consumed all the (public) typedocs.
   *
   * XXX this is serial right now, but could/should be made parallel once we
   *  are stable enough that it wouldn't be a debugging nightmare.
   */
  _populatePubTypes: function() {
    var iThing = 0, self = this, things = null;
    function chewNextThing() {
      while (iThing < things.length) {
        var thing = things[iThing++];
        if (!(/^.+\.jstut$/.test(thing.name)))
          continue;
        return when(self.requireDoc("typedocs/" + thing.name),
                    chewNextThing);
      }
      this._publicTypesPopulated = true;
      return true;
    }
    return when(unifile.list(this.resolveDocPath('typedocs/')),
                function populatePubTypesChainer(resThings) {
                  things = resThings;
                  return chewNextThing();
                });
  },

  _populateTestFiles: function() {
    var self = this;
    return when(unifile.list($pkginfo.packageUrl(this.name, "tests/")),
        function populateTestFiles(allFileNames) {
      self.testFiles = allFileNames.filter(function(n) {
                                             return /^test.+\.js$/.test(n);
                                           });
    });
  },

  /**
   * Bootstrap the module by:
   * @itemize[
   *   @item{
   *     Processing all jstut files in the package's typedocs dir and gobbling
   *     all their type definitions.
   *   }
   * ]
   * @return[@oneof[
   *   @case[Promise]{
   *     We have work to do; the promise will be fulfilled upon completion.
   *   }
   *   @case[true]{
   *     All data is already available.
   *   }
   * ]]
   */
  bootstrap: function(neededData) {
    var promises = [];
    if (!neededData)
      neededData = {};

    function want(what) {
      return (((what in neededData) && neededData[what]) ||
              DEFAULT_NEEDED_DATA[what]);
    }

    if (want("types") && !this._publicTypesPopulated)
      promises.push(this._populatePubTypes());
    if (want("testFiles") && this.testFiles == null)
      promises.push(this._populateTestFiles());

    console.log("bootstrapping", this.name,
                "types?", want("types"),
                "testFiles?", want("testFiles"));
    //console.trace();

    if (promises.length) {
      return pwomise.all(promises, this, "pkg bootstrap", this.name);
    }
    return this;
  },

  /**
   * Resolve an (absolute) module path, just like you would pass to "require()".
   */
  resolveSourcePath: function(moduleName) {
    var idxSlash = moduleName.lastIndexOf('/');
    while (idxSlash !== -1) {
      var possibleMount = moduleName.slice(0, idxSlash);
      if (this.__sourceMountPaths.hasOwnProperty(possibleMount))
        return $path.join(this.__sourceMountPaths[possibleMount],
                        moduleName.slice(idxSlash + 1));
      idxSlash = moduleName.lastIndexOf('/', idxSlash - 1);
    }
    throw new Error("Unable to resolve path for: '" + moduleName + "'");
  },

  /**
   * Resolve a documentation path in the context of this package.
   */
  resolveDocPath: function(relDocPath) {
    if (this.__docPath)
      return $path.join(this.__docPath, relDocPath);
    // fallback to historical behaviour
    return $pkginfo.dataDirUrl(this.name);
  },

  /**
   * Crawl all source files as identified by our source paths so we can have
   *  a global understanding of the package.  This assumes the unifile library
   *  can list the contents of a directory.  This currently mandates an http
   *  server with indices enabled; we have only ever used apache for this.
   */
  crawlAllSourceFiles: function() {
    console.log("Initiating crawling of all source files.");
    var things = [], iNextThing = 0, self = this;
    for (var key in this.__sourceMountPaths) {
      things.push(['dir', key + '/', this.__sourceMountPaths[key] + '/']);
    }

    function gotFileList(baseModuleName, path, files) {
      console.log("  for dir", path, "got", files);
      for (var i = 0; i < files.length; i++) {
        var file = files[i], m;
        // directory?
        if (file.isDir) {
          things.push(['dir', baseModuleName + file.name + '/',
                       path + file.name + '/']);
        }
        else if ((m = /(.+)\.(.+)$/.exec(file.name))) {
          switch (m[2]) {
            case 'js':
              things.push(['js', baseModuleName + m[1]]);
              break;
            default:
              // ignore non-source files
              break;
          }
        }
      }
      return chewNextThing();
    }

    function chewNextThing() {
      while (iNextThing < things.length) {
        var thing = things[iNextThing++];
        switch (thing[0]) {
          case 'dir':
            return when(unifile.list(thing[2]),
                        gotFileList.bind(null, thing[1], thing[2]));
          case 'js':
            return when(self.requireModule(thing[1]),
                        chewNextThing);
        }
        throw new Error("Unknown thing: " + thing);
      }
      return true;
    }
    return chewNextThing();
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
    var minfoPromise = when($pkginfo.urlFetch(
                              this.resolveSourcePath(name + '.js')),
                            this._gotSource.bind(this, minfo),
                            this._gotSrcTrouble.bind(this, minfo),
                            "requireModule",
                            name);
    return (this.moduleInfoPromisesByName[name] = minfoPromise);
  },

  _gotSource: function(minfo, source) {
    minfo.source = source;
    var options = {
      mode: "meta",
      lang: "jstut/js",
      metaInfo: minfo,
      pkg: this,
      docFusion: this.docFusion,
    };
    return when(loader.parseDocument(source, minfo.name, options),
                this._moduleReady.bind(this, minfo),
                this._gotSrcTrouble.bind(this, minfo),
                "boring:_gotSource", minfo.name);
  },
  _gotSrcTrouble: function(minfo, status) {
    console.error("Status", status, "while retrieving module", minfo.name);
  },

  _moduleReady: function(minfo, langOutput) {
    minfo.langOutput = langOutput;
    this._processModule(minfo);
    this.moduleInfoByName[minfo.name] = minfo;
    return minfo;
  },

  /**
   * Load the given document in 'meta' mode and returning the `DocInfo`
   *  structure as a result once it has been fully processed.
   */
  requireDoc: function(name, basePath) {
    if (basePath && name[0] === '.') {
      if (name[1] === '/')
        name = $path.join($path.dirname(basePath), name.substring(2));
      else
        throw new Error("Only same-directory magic is supported! No up-dir!");
    }
    if (name in this.docInfoByName)
      return this.docInfoByName[name];
    if (name in this.docInfoPromisesByName)
      return this.docInfoPromisesByName[name];

    var docInfo = new DocInfo(name, this);
    var docPromise = when($pkginfo.urlFetch(this.resolveDocPath(name)),
                          this._gotDoc.bind(this, docInfo),
                          this._gotDocTrouble.bind(this, docInfo),
                          "requireDoc", name);
    return (this.docInfoPromisesByName[name] = docPromise);
  },

  _gotDoc: function(docInfo, text) {
    docInfo.text = text;

    var options = {
      mode: "meta",
      pkg: this,
      docFusion: this.docFusion,
      metaInfo: docInfo,
    };
    return when(loader.parseDocument(text, docInfo.name, options),
                this._docReady.bind(this, docInfo),
                this._gotDocTrouble.bind(this, docInfo),
                "boring:_gotDoc", docInfo.name);
  },

  _docReady: function(docInfo, langOutput) {
    docInfo.langOutput = langOutput;
    this._processDoc(docInfo);
    this.docInfoByName[docInfo.name] = docInfo;
    return docInfo;
  },

  _gotDocTrouble: function(docInfo, status) {
    console.error("Status", status, "while retrieving doc", docInfo.name);
    return $Q.reject(status);
  },

  /**
   * Merge the contents of the source `Namespace` into the target
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
        // XXX this warning is useless thus far and complicates testing, so
        //  let's turn it off until we need it and have time to normalize the
        //  testing situations.
        /*
        if (targ[key] !== kids[key])
          console.warn("non-identical collision, already got:", targ[key],
                       "now seeing:", kids[key], "(ignoring it)");
         */
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
   * Process a document to get its contributions to our namespaces.
   */
  _processDoc: function(docInfo) {
    function isType(sym) {
      return sym.isType;
    }
    this._mergeInNamespace(docInfo.exportNS, this.internalTypes, isType);
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

  /**
   * General purpose traversal of complex names from the conceptual root
   *  namespace of the package.
   */
  traverse: function(complexName) {
    var nameBits = complexName.split(".");
console.log("::::: trying to traverse", complexName, nameBits);

    var curObj = this.resolveInternal(nameBits[0]);
    console.log("resolved to", curObj);
    for (var i = 1; curObj && i < nameBits.length; i++) {
      var name = nameBits[i], nextObj = null;
      if ("traverseChild" in curObj)
        nextObj = curObj.traverseChild(name);
      if (!nextObj && ("traverseArg" in curObj))
        nextObj = curObj.traverseArg(name);
      if (!nextObj)
        return null;
      curObj = nextObj;
    }
console.log("   :: returning", curObj);
    return curObj;
  },
};

/**
 * Information about a source module.  In the common case this will be the
 *  result of parsing a source file, but it could also include fused data from
 *  a parallel documentation file, or even just be the result of a documentation
 *  file without any source file consultation.
 */
function ModuleInfo(name, packageFusion) {
  this.name = name;
  this.pkg = packageFusion;

  /**
   * The raw source string that provides the text of the source file.
   */
  this.source = null;
  /**
   * The "exports" `Namespace` of the module as per the CommonJS/AMD idiom.
   */
  this.exportNS = null;
  /**
   * The global `Namespace` of the module.  It is our goal to pierce function
   *  wrappers used for safety.  For example, if the module is defined using the
   *  AMD idiom, the namespace will be that of the defining function (hopefully).
   */
  this.globalNS = null;

  /**
   * The abstract interpretation representation of the module's exports object.
   *  This either ends up dummied out or as a wrapper around `exportNS`.
   */
  this.rawExportsScope = null;

  /**
   * Does this module form part of the package's public API?  By default, the
   *  answer is no.
   */
  this.isPublic = false;

  /**
   * The documentation node that is believed to summarize the entire file.  In
   *  jstut-style formatted source files, this is (by convention) the first
   *  standalone doc node in the file, as indicated by a doc-block opened with
   *  two asterisks and closed with two asterisks.
   */
  this.fileDocNode = null;
  /**
   * A list of all of the documentation blocks in the file that were not
   *  associated to a type/group/etc.  The first detected standalone doc node
   *  in a jstut-formatted file will end up as the `fileDocNode`.  Standalone
   *  blocks are opened with two asterisks and closed with two asterisks.
   */
  this.standaloneDocNodes = [];

  /**
   * The parsing routine to use for doc blocks for this module.  For jstut
   *  syntax files, this will be `jstut/langs/manual.js::decodeFlow`, but
   *  this can be extended/changed to support other syntaxes.
   */
  this.formatTextStream = null;
}
ModuleInfo.prototype = {
};
exports.ModuleInfo = ModuleInfo;


var DEFAULT_NEEDED_DATA = {
  types: true,
  testFiles: false,
};

/**
 * Information extracted from/about a documentation file.
 */
function DocInfo(name, packageFusion) {
  this.name = name;

  this.exportNS = null;
  /**
   * @listof[DocInfo]{
   *   The documents this document depends on.  Populated by "requireDoc"
   *   directives.  Used by type lookups within this document that cannot be
   *   satisfied from within the document.
   * }
   */
  this.requiredDocs = [];

  this.textStream = null;
}
DocInfo.prototype = {
  resolveType: function(name) {
    var child;
    if (this.exportNS) {
      child = this.exportNS.traverseChild(name);
      if (child)
        return child;
    }
    for (var i = 0; i < this.requiredDocs.length; i++) {
      var reqDoc = this.requiredDocs[i];
      if (reqDoc.exportNS) {
        child = reqDoc.exportNS.traverseChild(name);
        if (child)
          return child;
      }
    }
    return null;
  },
};
exports.DocInfo = DocInfo;

/**
 * A NOP package that produces NOP modules; used when our jstut.json explicitly
 *  warns us off of trying to follow-up on a package.  This would happen for
 *  all packages that aren't us right now, but eventually it would make sense
 *  to be able to bridge to other jstut documented packages.
 */
function DummyPackage(name) {
  this.name = name;
  this.dummyModules = {};
}
DummyPackage.prototype = {
  boring: true,

  bootstrap: function() {
    return this;
  },
  requireModule: function(name) {
    if (!this.dummyModules.hasOwnProperty(name)) {
      var module = this.dummyModules[name] = new ModuleInfo(name, this);
      // Provide an empty exports scope.  The rep we are cramming here is
      //  actually `interp.js` specific, so this is sorta sketchy.
      module.rawExportsScope = {type: 'object', data: {}};
    }
    return this.dummyModules[name];
  },
};

function DocFusion() {
  this.originPackage = null;

  this.packages = {};
  this.boringPackages = {};
}
DocFusion.prototype = {
  /**
   * Bootstrap our understanding of stuff by consuming a jstut.json file
   */
  bootstrapUniverse: function(pathToJson) {
    if (!pathToJson)
      throw new Error("The universe needs a path to a JSON file!");
    var self = this;
    return when($pkginfo.urlFetch(pathToJson,
                                  "bootstrapUniverse", pathToJson),
                function(text) {
      var obj = JSON.parse(text), key;

      // dependencies are boring; don't go looking for them
      for (key in obj.deps) {
        if (!obj.deps[key]) {
          self.packages[key] = new DummyPackage(key);
        }
      }

      var ourPackage = self.originPackage = new PackageFusion(self,
                                                              obj.us.name);
      ourPackage.__docPath = $path.dirname(pathToJson);

      // make note of the source dir mappings...
      var packageRoot = $path.join(ourPackage.__docPath, obj.us.root),
          loadingPackages = [];
      for (key in obj.us.mappings) {
        var mountAs = key,
            basePath = packageRoot + obj.us.mappings[key];

        ourPackage.__sourceMountPaths[mountAs] = basePath;
        self.packages[mountAs] = ourPackage;
      }

      return ourPackage.bootstrap(DEFAULT_NEEDED_DATA);
    });
  },

  /**
   * Fetch the (hopefully) populated package for the given name.
   *
   * If the package is not currently known, we return a promise for the
   *  bootstrapped package.  If the package has already been requested,
   *  we return it whether it is fully bootstrapped yet or not.  This
   *  is a pre-emptive strike against weird infinite loops but should not
   *  actually be required.
   *
   * @args[
   *   @param[pkgName String]{
   *     The name of the package you want the dirt on.
   *   }
   *   @param[neededData @dict[
   *     @key[types @default[true] Boolean]{
   *       Should all public types be discovered/processed?  This is important
   *       for resolving types used in documentation that does not express
   *       explicit dependencies on the modules that define those types.
   *     }
   *     @key[testFiles @default[false] Boolean]{
   *       Should we find out the names of all the unit test files for this
   *       package?  You would likely want this if you are a test runner or
   *       want to analyze/parse the tests to provide information on what
   *       APIs are tested.
   *     }
   *   ]]{
   *     Allows you to indicate what data about the package you need so you
   *     only pay for what you use.
   *   }
   * ]
   * @return[@maybepromise[PackageFusion]]
   */
  getPackage: function(pkgName, neededData) {
    if (neededData === undefined) {
      neededData = DEFAULT_NEEDED_DATA;
    }

    if (!(pkgName in this.packages))
      this.packages[pkgName] = new PackageFusion(this, pkgName);

    return this.packages[pkgName].bootstrap(neededData);
  },

  /**
   * Require a module, ensuring the package is first bootstrapped.
   */
  requireModule: function(name, baseId) {
    var pkgName;
    if (name.indexOf('/') === -1)
      pkgName = name;
    else
      pkgName = name.split("/")[0];
    // require("./foo") by "bar/baz/bog" should net "bar/baz/foo"
    if (pkgName === "." && baseId) {
      // (grab all but the last part, which loses the trailing "/") +
      // (the slash after the "." onwards)
      name = baseId.split("/").slice(0, -1).join("/") + pkgName.substring(1);
    }

    if (this.packages.hasOwnProperty(pkgName)) {
      return this.packages[pkgName].requireModule(name);
    }

    var pkgFusion = this.packages[pkgName] = new PackageFusion(this, pkgName);
    return when(pkgFusion.bootstrap(), function() {
      return pkgFusion.requireModule(name);
    });
  },
};
exports.DocFusion = DocFusion;

}); // end define
