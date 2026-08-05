#!/usr/bin/env python3
"""Gera Macros.xcodeproj/project.pbxproj a partir dos ficheiros em Macros/.

Não há Xcode disponível neste ambiente para gerar o projeto pela via normal
(File > New > Project), por isso este script escreve um project.pbxproj
válido diretamente. Corre-se uma vez; se adicionares/removeres ficheiros
Swift depois, corre-o outra vez (idempotente — os UUIDs são determinísticos,
derivados do caminho de cada ficheiro).
"""
import hashlib
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT_NAME = "Macros"
BUNDLE_ID = "com.joaoazul.macros"
DEPLOYMENT_TARGET = "17.0"
SRC_ROOT = os.path.join(ROOT, PROJECT_NAME)  # ios/Macros


def uuid_for(name: str) -> str:
    """UUID de 24 hex chars, determinístico a partir do nome (formato pbxproj)."""
    h = hashlib.sha1(name.encode("utf-8")).hexdigest().upper()
    return h[:24]


SWIFT_FILES = []
RESOURCE_DIRS = []  # (name, path relative to SRC_ROOT) — .xcassets tratados como pacote

for dirpath, dirnames, filenames in os.walk(SRC_ROOT):
    dirnames[:] = [d for d in dirnames if not d.endswith(".xcassets")]
    for f in sorted(filenames):
        if f.endswith(".swift"):
            rel = os.path.relpath(os.path.join(dirpath, f), SRC_ROOT)
            SWIFT_FILES.append(rel)

for dirpath, dirnames, filenames in os.walk(SRC_ROOT):
    for d in list(dirnames):
        if d.endswith(".xcassets"):
            rel = os.path.relpath(os.path.join(dirpath, d), SRC_ROOT)
            RESOURCE_DIRS.append(rel)

SWIFT_FILES.sort()
RESOURCE_DIRS.sort()

print("Swift files:", len(SWIFT_FILES))
for f in SWIFT_FILES:
    print("  ", f)
print("Resource dirs:", RESOURCE_DIRS)

# ---------------------------------------------------------------------------
# Construção da árvore de grupos (pastas amarelas) a partir dos caminhos.
# ---------------------------------------------------------------------------

class Group:
    def __init__(self, name, path):
        self.name = name
        self.path = path  # caminho completo relativo a SRC_ROOT (para o group "path")
        self.children_groups = {}  # name -> Group
        self.file_refs = []  # list of (name, rel_path)


root_group = Group(PROJECT_NAME, "")


def get_group(rel_dir: str) -> Group:
    if rel_dir in ("", "."):
        return root_group
    parts = rel_dir.split(os.sep)
    node = root_group
    accum = []
    for p in parts:
        accum.append(p)
        if p not in node.children_groups:
            node.children_groups[p] = Group(p, os.sep.join(accum))
        node = node.children_groups[p]
    return node


for rel in SWIFT_FILES:
    d = os.path.dirname(rel)
    fname = os.path.basename(rel)
    get_group(d).file_refs.append(("swift", fname, rel))

for rel in RESOURCE_DIRS:
    d = os.path.dirname(rel)
    fname = os.path.basename(rel)
    get_group(d).file_refs.append(("assets", fname, rel))

# ---------------------------------------------------------------------------
# IDs fixos
# ---------------------------------------------------------------------------

ID_PROJECT = uuid_for("PBXProject")
ID_MAIN_GROUP = uuid_for("MainGroup")
ID_PRODUCTS_GROUP = uuid_for("ProductsGroup")
ID_APP_PRODUCT = uuid_for("AppProductRef")
ID_TARGET = uuid_for("AppTarget")
ID_TARGET_CONFIG_LIST = uuid_for("TargetConfigList")
ID_TARGET_DEBUG = uuid_for("TargetConfigDebug")
ID_TARGET_RELEASE = uuid_for("TargetConfigRelease")
ID_PROJECT_CONFIG_LIST = uuid_for("ProjectConfigList")
ID_PROJECT_DEBUG = uuid_for("ProjectConfigDebug")
ID_PROJECT_RELEASE = uuid_for("ProjectConfigRelease")
ID_SOURCES_PHASE = uuid_for("SourcesPhase")
ID_RESOURCES_PHASE = uuid_for("ResourcesPhase")
ID_FRAMEWORKS_PHASE = uuid_for("FrameworksPhase")
ID_ROOT_GROUP_REF = uuid_for("RootGroupRef::" + PROJECT_NAME)

file_refs = {}       # rel_path -> (fileref_id, kind)
build_files = {}      # rel_path -> build_file_id
group_ids = {}         # rel_dir -> group_id


def register_file(rel_path: str, kind: str):
    fref_id = uuid_for("FileRef::" + rel_path)
    file_refs[rel_path] = (fref_id, kind)
    if kind in ("swift", "assets"):
        bf_id = uuid_for("BuildFile::" + rel_path)
        build_files[rel_path] = bf_id
    return fref_id


for rel in SWIFT_FILES:
    register_file(rel, "swift")
for rel in RESOURCE_DIRS:
    register_file(rel, "assets")


def file_type_for(kind: str, name: str) -> str:
    if kind == "swift":
        return "sourcecode.swift"
    if kind == "assets":
        return "folder.assetcatalog"
    return "text"


# ---------------------------------------------------------------------------
# PBXFileReference + PBXBuildFile
# ---------------------------------------------------------------------------

lines_filerefs = []
lines_buildfiles_sources = []
lines_buildfiles_resources = []

for rel, (fref_id, kind) in file_refs.items():
    name = os.path.basename(rel)
    ftype = file_type_for(kind, name)
    lines_filerefs.append(
        f'\t\t{fref_id} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = {ftype}; '
        f'path = "{name}"; sourceTree = "<group>"; }};'
    )

for rel in SWIFT_FILES:
    fref_id, _ = file_refs[rel]
    bf_id = build_files[rel]
    name = os.path.basename(rel)
    lines_buildfiles_sources.append(
        f'\t\t{bf_id} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {fref_id} /* {name} */; }};'
    )

for rel in RESOURCE_DIRS:
    fref_id, _ = file_refs[rel]
    bf_id = build_files[rel]
    name = os.path.basename(rel)
    lines_buildfiles_resources.append(
        f'\t\t{bf_id} /* {name} in Resources */ = {{isa = PBXBuildFile; fileRef = {fref_id} /* {name} */; }};'
    )

# ---------------------------------------------------------------------------
# PBXGroup (recursivo)
# ---------------------------------------------------------------------------

lines_groups = []


def emit_group(group: Group, rel_dir: str) -> str:
    gid = uuid_for("Group::" + rel_dir) if rel_dir else uuid_for("TargetRootGroup")
    group_ids[rel_dir] = gid

    child_refs = []
    for cname in sorted(group.children_groups.keys()):
        child_rel = os.path.join(rel_dir, cname) if rel_dir else cname
        cgid = emit_group(group.children_groups[cname], child_rel)
        child_refs.append(f'{cgid} /* {cname} */')

    for kind, fname, rel in sorted(group.file_refs, key=lambda t: t[1]):
        fref_id, _ = file_refs[rel]
        child_refs.append(f'{fref_id} /* {fname} */')

    children_str = ",\n\t\t\t".join(child_refs)
    name = group.name if rel_dir else PROJECT_NAME
    lines_groups.append(
        f'\t\t{gid} /* {name} */ = {{\n'
        f'\t\t\tisa = PBXGroup;\n'
        f'\t\t\tchildren = (\n'
        f'\t\t\t{children_str}{"," if children_str else ""}\n'
        f'\t\t\t);\n'
        f'\t\t\tpath = "{group.name}";\n'
        f'\t\t\tsourceTree = "<group>";\n'
        f'\t\t}};'
    )
    return gid


# grupo raiz do alvo (pasta Macros/) fica dentro do main group do projeto
target_root_gid = emit_group(root_group, "")

# main group do projeto: contém o grupo do alvo + Products
lines_groups.append(
    f'\t\t{ID_MAIN_GROUP} /* Project */ = {{\n'
    f'\t\t\tisa = PBXGroup;\n'
    f'\t\t\tchildren = (\n'
    f'\t\t\t{target_root_gid} /* {PROJECT_NAME} */,\n'
    f'\t\t\t{ID_PRODUCTS_GROUP} /* Products */,\n'
    f'\t\t\t);\n'
    f'\t\t\tsourceTree = "<group>";\n'
    f'\t\t}};'
)
lines_groups.append(
    f'\t\t{ID_PRODUCTS_GROUP} /* Products */ = {{\n'
    f'\t\t\tisa = PBXGroup;\n'
    f'\t\t\tchildren = (\n'
    f'\t\t\t{ID_APP_PRODUCT} /* {PROJECT_NAME}.app */,\n'
    f'\t\t\t);\n'
    f'\t\t\tname = Products;\n'
    f'\t\t\tsourceTree = "<group>";\n'
    f'\t\t}};'
)

# ---------------------------------------------------------------------------
# Sources / Resources build phase file lists
# ---------------------------------------------------------------------------

sources_list = "\n".join(
    f'\t\t\t\t{build_files[rel]} /* {os.path.basename(rel)} in Sources */,' for rel in SWIFT_FILES
)
resources_list = "\n".join(
    f'\t\t\t\t{build_files[rel]} /* {os.path.basename(rel)} in Resources */,' for rel in RESOURCE_DIRS
)

# ---------------------------------------------------------------------------
# project.pbxproj
# ---------------------------------------------------------------------------

pbxproj = f'''// !$*UTF8*$!
{{
\tarchiveVersion = 1;
\tclasses = {{
\t}};
\tobjectVersion = 56;
\tobjects = {{

/* Begin PBXBuildFile section */
{chr(10).join(lines_buildfiles_sources + lines_buildfiles_resources)}
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
\t\t{ID_APP_PRODUCT} /* {PROJECT_NAME}.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = {PROJECT_NAME}.app; sourceTree = BUILT_PRODUCTS_DIR; }};
{chr(10).join(lines_filerefs)}
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
\t\t{ID_FRAMEWORKS_PHASE} /* Frameworks */ = {{
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
{chr(10).join(lines_groups)}
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
\t\t{ID_TARGET} /* {PROJECT_NAME} */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {ID_TARGET_CONFIG_LIST} /* Build configuration list for PBXNativeTarget "{PROJECT_NAME}" */;
\t\t\tbuildPhases = (
\t\t\t\t{ID_SOURCES_PHASE} /* Sources */,
\t\t\t\t{ID_FRAMEWORKS_PHASE} /* Frameworks */,
\t\t\t\t{ID_RESOURCES_PHASE} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = {PROJECT_NAME};
\t\t\tproductName = {PROJECT_NAME};
\t\t\tproductReference = {ID_APP_PRODUCT} /* {PROJECT_NAME}.app */;
\t\t\tproductType = "com.apple.product-type.application";
\t\t}};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
\t\t{ID_PROJECT} /* Project object */ = {{
\t\t\tisa = PBXProject;
\t\t\tattributes = {{
\t\t\t\tBuildIndependentTargetsInParallel = 1;
\t\t\t\tLastSwiftUpdateCheck = 1520;
\t\t\t\tLastUpgradeCheck = 1520;
\t\t\t\tTargetAttributes = {{
\t\t\t\t\t{ID_TARGET} = {{
\t\t\t\t\t\tCreatedOnToolsVersion = 15.2;
\t\t\t\t\t}};
\t\t\t\t}};
\t\t\t}};
\t\t\tbuildConfigurationList = {ID_PROJECT_CONFIG_LIST} /* Build configuration list for PBXProject "{PROJECT_NAME}" */;
\t\t\tcompatibilityVersion = "Xcode 14.0";
\t\t\tdevelopmentRegion = pt;
\t\t\thasScannedForEncodings = 0;
\t\t\tknownRegions = (
\t\t\t\tpt,
\t\t\t\tBase,
\t\t\t);
\t\t\tmainGroup = {ID_MAIN_GROUP};
\t\t\tproductRefGroup = {ID_PRODUCTS_GROUP} /* Products */;
\t\t\tprojectDirPath = "";
\t\t\tprojectRoot = "";
\t\t\ttargets = (
\t\t\t\t{ID_TARGET} /* {PROJECT_NAME} */,
\t\t\t);
\t\t}};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
\t\t{ID_RESOURCES_PHASE} /* Resources */ = {{
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
{resources_list}
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
\t\t{ID_SOURCES_PHASE} /* Sources */ = {{
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
{sources_list}
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
\t\t{ID_PROJECT_DEBUG} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
\t\t\t\tCLANG_ANALYZER_NONNULL = YES;
\t\t\t\tCLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;
\t\t\t\tCLANG_ENABLE_OBJC_WEAK = YES;
\t\t\t\tCLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
\t\t\t\tCLANG_WARN_BOOL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_COMMA = YES;
\t\t\t\tCLANG_WARN_CONSTANT_CONVERSION = YES;
\t\t\t\tCLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
\t\t\t\tCLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
\t\t\t\tCLANG_WARN_DOCUMENTATION_COMMENTS = YES;
\t\t\t\tCLANG_WARN_EMPTY_BODY = YES;
\t\t\t\tCLANG_WARN_ENUM_CONVERSION = YES;
\t\t\t\tCLANG_WARN_INFINITE_RECURSION = YES;
\t\t\t\tCLANG_WARN_INT_CONVERSION = YES;
\t\t\t\tCLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
\t\t\t\tCLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
\t\t\t\tCLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;
\t\t\t\tCLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
\t\t\t\tCLANG_WARN_STRICT_PROTOTYPES = YES;
\t\t\t\tCLANG_WARN_SUSPICIOUS_MOVE = YES;
\t\t\t\tCLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;
\t\t\t\tCLANG_WARN_UNREACHABLE_CODE = YES;
\t\t\t\tCLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
\t\t\t\tCOPY_PHASE_STRIP = NO;
\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;
\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;
\t\t\t\tENABLE_TESTABILITY = YES;
\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = YES;
\t\t\t\tGCC_C_LANGUAGE_STANDARD = gnu17;
\t\t\t\tGCC_DYNAMIC_NO_PIC = NO;
\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;
\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;
\t\t\t\tGCC_PREPROCESSOR_DEFINITIONS = (
\t\t\t\t\t"DEBUG=1",
\t\t\t\t\t"$(inherited)",
\t\t\t\t);
\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;
\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;
\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;
\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};
\t\t\t\tMTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
\t\t\t\tMTL_FAST_MATH = YES;
\t\t\t\tONLY_ACTIVE_ARCH = YES;
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";
\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";
\t\t\t}};
\t\t\tname = Debug;
\t\t}};
\t\t{ID_PROJECT_RELEASE} /* Release */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
\t\t\t\tCLANG_ANALYZER_NONNULL = YES;
\t\t\t\tCLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;
\t\t\t\tCLANG_ENABLE_OBJC_WEAK = YES;
\t\t\t\tCLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
\t\t\t\tCLANG_WARN_BOOL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_COMMA = YES;
\t\t\t\tCLANG_WARN_CONSTANT_CONVERSION = YES;
\t\t\t\tCLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
\t\t\t\tCLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
\t\t\t\tCLANG_WARN_DOCUMENTATION_COMMENTS = YES;
\t\t\t\tCLANG_WARN_EMPTY_BODY = YES;
\t\t\t\tCLANG_WARN_ENUM_CONVERSION = YES;
\t\t\t\tCLANG_WARN_INFINITE_RECURSION = YES;
\t\t\t\tCLANG_WARN_INT_CONVERSION = YES;
\t\t\t\tCLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
\t\t\t\tCLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
\t\t\t\tCLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
\t\t\t\tCLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;
\t\t\t\tCLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
\t\t\t\tCLANG_WARN_STRICT_PROTOTYPES = YES;
\t\t\t\tCLANG_WARN_SUSPICIOUS_MOVE = YES;
\t\t\t\tCLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;
\t\t\t\tCLANG_WARN_UNREACHABLE_CODE = YES;
\t\t\t\tCLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
\t\t\t\tCOPY_PHASE_STRIP = NO;
\t\t\t\tDEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
\t\t\t\tENABLE_NS_ASSERTIONS = NO;
\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;
\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = YES;
\t\t\t\tGCC_C_LANGUAGE_STANDARD = gnu17;
\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;
\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;
\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;
\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;
\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};
\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;
\t\t\t\tMTL_FAST_MATH = YES;
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_COMPILATION_MODE = wholemodule;
\t\t\t\tVALIDATE_PRODUCT = YES;
\t\t\t}};
\t\t\tname = Release;
\t\t}};
\t\t{ID_TARGET_DEBUG} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_ASSET_PATHS = "\\"{PROJECT_NAME}/Preview Content\\"";
\t\t\t\tENABLE_PREVIEWS = YES;
\t\t\t\tGENERATE_INFOPLIST_FILE = YES;
\t\t\t\tINFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
\t\t\t\tINFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;
\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait;
\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = Macros;
\t\t\t\tINFOPLIST_KEY_NSHumanReadableCopyright = "";
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t}};
\t\t\tname = Debug;
\t\t}};
\t\t{ID_TARGET_RELEASE} /* Release */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_ASSET_PATHS = "\\"{PROJECT_NAME}/Preview Content\\"";
\t\t\t\tENABLE_PREVIEWS = YES;
\t\t\t\tGENERATE_INFOPLIST_FILE = YES;
\t\t\t\tINFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
\t\t\t\tINFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;
\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait;
\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = Macros;
\t\t\t\tINFOPLIST_KEY_NSHumanReadableCopyright = "";
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t}};
\t\t\tname = Release;
\t\t}};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
\t\t{ID_PROJECT_CONFIG_LIST} /* Build configuration list for PBXProject "{PROJECT_NAME}" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{ID_PROJECT_DEBUG} /* Debug */,
\t\t\t\t{ID_PROJECT_RELEASE} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};
\t\t{ID_TARGET_CONFIG_LIST} /* Build configuration list for PBXNativeTarget "{PROJECT_NAME}" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{ID_TARGET_DEBUG} /* Debug */,
\t\t\t\t{ID_TARGET_RELEASE} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};
/* End XCConfigurationList section */
\t}};
\trootObject = {ID_PROJECT} /* Project object */;
}}
'''

out_dir = os.path.join(ROOT, f"{PROJECT_NAME}.xcodeproj")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "project.pbxproj")
with open(out_path, "w") as f:
    f.write(pbxproj)

print("Escrito:", out_path)
