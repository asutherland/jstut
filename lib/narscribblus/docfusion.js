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

require.def("narscribblus/docfusion",
  ["exports",
   "narscribblus-plat/utils/unifile",
   "narscribblus-plat/package-info",
   "narscribblus/scribble-loader",
   "narscribblus/utils/pwomise"],
  function(
    exports,
    unifile,
    pkginfo,
    loader,
    pwomise) {
var when = pwomise.when;

/**
 * Represents / populates the documentation and possibly source for a given
 *  package.
 */
function PackageFusion(name) {
  this.name = name;
  // in-process module infos
  this.moduleInfoPromisesByName = {};
  // fully processed module infos
  this.moduleInfoByName = {};

  this.docInfoPromisesByName = {};
  this.docInfoByName = {};

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
   *
   * XXX this is serial right now, but could/should be made parallel once we
   *  are stable enough that it wouldn't be a debugging nightmare.
   */
  _populatePubTypes: function() {
    var iThing = 0, self = this, things = null;
    function chewNextThing() {
      while (iThing < things.length) {
        var thing = things[iThing++];
        if (!(/^.+\.skwbl$/.test(thing.name)))
          continue;
        return when(self.requireDoc(self.name + "/typedocs/" + thing.name),
                    chewNextThing);
      }
      return true;
    }
    when(unifile.list(pkginfo.dataDirUrl(this.name + "/typedocs/")),
         function(resThings) {
           things = resThings;
           return chewNextThing();
         });
  },

  /**
   * Bootstrap the module by:
   * @itemize[
   *   @item{
   *     Processing all skwbl files in the package's typedocs dir and gobbling
   *     all their type definitions.
   *   }
   * ]
   */
  bootstrap: function() {
    return this._populatePubTypes();
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
                            this._gotSrcTrouble.bind(this, minfo));
    return (this.moduleInfoPromisesByName[name] = minfoPromise);
  },

  _gotSource: function(minfo, source) {
    minfo.source = source;
    var options = {
      mode: "meta",
      lang: "narscribblus/js",
      moduleInfo: minfo,
      pkg: this,
    };
    return when(loader.parseDocument(source, minfo.name, options),
                this._moduleReady.bind(this, minfo),
                this._gotSrcTrouble.bind(this, minfo));
  },
  _gotSrcTrouble: function(minfo, status) {
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
    if (name in this.docInfoByName)
      return this.docInfoByName[name];
    if (name in this.docInfoPromisesByName)
      return this.docInfoPromisesByName[name];

    var docInfo = new DocInfo(name, this);
    var docPromise = when(pkginfo.loadData(name),
                          this._gotDoc.bind(this, docInfo),
                          this._gotDocTrouble.bind(this, docInfo));
    return (this.docInfoPromisesByName[name] = docPromise);
  },

  _gotDoc: function(docInfo, text) {
    docInfo.text = text;

    var options = {
      mode: "meta",
      pkg: this,
      docInfo: docInfo,
    };
    return when(loader.parseDocument(text, docInfo.name, options),
                this._docReady.bind(this, docInfo),
                this._gotDocTrouble.bind(this, docInfo));
  },

  _docReady: function(docInfo, docMeta) {
    this._processDoc(docInfo, docMeta);
    this.docInfoByName[docInfo.name] = docMeta;
    return docInfo;
  },

  _gotDocTrouble: function(docInfo, status) {
    console.error("Status", status, "while retrieving doc", docInfo.name);
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
   * Process a document's top-level text stream for types.  We should probably
   *  switch to pushing a named contexts that types add themselves to.
   */
  _processDoc: function(docInfo, docMeta) {
    // we can't do anything more if there is no textStream to mine...
    if (!("textStream" in docMeta) || !docMeta.textStream)
      return;

    // scan the text stream for things that are types so that we can register
    //  them.
    var textStream = docInfo.textStream = docMeta.textStream;
    for (var i = 0; i < textStream.length; i++) {
      var node = textStream[i];
      // non-object nodes are not interesting
      if (!node || (typeof(node) !== "object"))
        continue;
      if (("isType" in node) && node.isType) {
        if (!(node.name in this.internalTypes))
          this.internalTypes[node.name] = node;
      }
    }
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
console.log("::::: trying to traverse", complexName);
    var nameBits = complexName.split(".");

    var curObj = this.resolveInternal(nameBits[0]);
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


/**
 * Info about a document, which for now just means 
 */
function DocInfo(name, packageFusion) {
  this.name = name;

  this.textStream = null;
}
DocInfo.prototype = {
};
exports.DocInfo = DocInfo;

function DocFusion() {
  this.packages = {};
}
DocFusion.prototype = {
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
   * ]
   * @return[@maybepromise[PackageFusion]]
   */
  getPackage: function(pkgName) {
    if (pkgName in this.packages) {
      return this.packages[pkgName];
    }

    var self = this;
    var pkgFusion = this.packages[pkgName] = new PackageFusion(pkgName);
    return when(pkgFusion.bootstrap(), function() {
      return pkgFusion;
    });
  },

  /**
   * Require a module, ensuring the package is first bootstrapped.
   */
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

    var pkgFusion = this.packages[pkgName] = new PackageFusion(pkgName);
    return when(pkgFusion.bootstrap(), function() {
      return pkgFusion.requireModule(name);
    });
  },
};
exports.docFusion = new DocFusion();

}); // end require.def
