
config.fetch_file_cb = asset => App.fetchFile(asset);
config.environmentVariables = config.environmentVariables || {};

var Module = {
    onRuntimeInitialized: function () {
        MONO.mono_load_runtime_and_bcl(
            config.vfs_prefix,
            config.deploy_prefix,
            config.enable_debugging,
            config.file_list,
            function () {
                App.init();
            },
            config.fetch_file_cb
        );
    },
    instantiateWasm: function (imports, successCallback) {

        // There's no way to get the filename from mono.js right now.
        // so we just hardcode it.
        const wasmUrl = config.mono_wasm_runtime || "mono.wasm";
        if (typeof WebAssembly.instantiateStreaming === 'function') {

            App.fetchWithProgress(
                wasmUrl)
                .then(response => {
                    if (Module.isElectron()) {
                        /*
                         * Chromium does not yet suppport instantiateStreaming
                         * with custom headers.
                         */
                        return response.arrayBuffer()
                            .then(buffer => {
                                WebAssembly
                                    .instantiate(buffer, imports)
                                    .then(results => {
                                        successCallback(results.instance);
                                    });
                            });
                    }
                    else {
                        return WebAssembly
                            .instantiateStreaming(response, imports)
                            .then(results => {
                                successCallback(results.instance);
                            });
                    }
                });
        }
        else {
            fetch(wasmUrl)
                .then(response => {
                    response.arrayBuffer().then(function (buffer) {
                        return WebAssembly.instantiate(buffer, imports)
                            .then(results => {
                                successCallback(results.instance);
                            });
                    });
                });
        }

        return {}; // Compiling asynchronously, no exports.
    },
    isElectron: function () {
        return navigator.userAgent.indexOf('Electron') !== -1;
    }
};

var MonoRuntime = {
    // This block is present for backward compatibility when "MonoRuntime" was provided by mono-wasm.

    init: function () {
        this.load_runtime = Module.cwrap("mono_wasm_load_runtime", null, ["string", "number"]);
        this.assembly_load = Module.cwrap("mono_wasm_assembly_load", "number", ["string"]);
        this.find_class = Module.cwrap("mono_wasm_assembly_find_class", "number", ["number", "string", "string"]);
        this.find_method = Module.cwrap("mono_wasm_assembly_find_method", "number", ["number", "string", "number"]);
        this.invoke_method = Module.cwrap("mono_wasm_invoke_method", "number", ["number", "number", "number"]);
        this.mono_string_get_utf8 = Module.cwrap("mono_wasm_string_get_utf8", "number", ["number"]);
        this.mono_string = Module.cwrap("mono_wasm_string_from_js", "number", ["string"]);
    },

    conv_string: function (mono_obj) {
        if (mono_obj === 0)
            return null;
        const raw = this.mono_string_get_utf8(mono_obj);
        const res = Module.UTF8ToString(raw);
        Module._free(raw);

        return res;
    },

    call_method: function (method, this_arg, args) {
        const args_mem = Module._malloc(args.length * 4);
        const eh_throw = Module._malloc(4);
        for (let i = 0; i < args.length; ++i)
            Module.setValue(args_mem + i * 4, args[i], "i32");
        Module.setValue(eh_throw, 0, "i32");

        const res = this.invoke_method(method, this_arg, args_mem, eh_throw);

        const eh_res = Module.getValue(eh_throw, "i32");

        Module._free(args_mem);
        Module._free(eh_throw);

        if (eh_res !== 0) {
            const msg = this.conv_string(res);
            throw new Error(msg);
        }

        return res;
    }
};


console.logGr = s =>  console.log("%c " + s, "color: green; font-size: 24px");

var App = {

    preInit() {
        console.logGr("Downloading files for MONO");
        console.log(config.file_list.join(";"))
    },

    init: function () {
        this.initializeRequire();
    },

    mainInit: function () {
        try {
            App.attachDebuggerHotkey(config.file_list);
            MonoRuntime.init();
            BINDING.call_static_method("[DiplomaDemo.NetStandard] DiplomaDemo.NetStandard.InitClass:Main", []);

            if (AfterMonoInit) {
                AfterMonoInit();
            }
        } catch (e) {
            console.error(e);
        }
    },

    raiseLoadingError: function (err) {
        this.loader.setAttribute("loading-alert", "error");

        const alert = this.loader.querySelector(".alert");

        let title = alert.getAttribute("title");
        if (title) {
            title += `\n${err}`;
        } else {
            title = `${err}`;
        }
        alert.setAttribute("title", title);
    },

    raiseLoadingWarning: function (msg) {
        if (this.loader.getAttribute("loading-alert") !== "error") {
            this.loader.setAttribute("loading-alert", "warning");
        }

        const alert = this.loader.querySelector(".alert");

        let title = alert.getAttribute("title");
        if (title) {
            title += `\n${msg}`;
        } else {
            title = `${msg}`;
        }
        alert.setAttribute("title", title);
    },

    fetchWithProgress: function (url) {

        return fetch(url, this.getFetchInit(url));
    },

    // todo what is this?
    getFetchInit: function (url) {
        const fileName = url.substring(url.lastIndexOf("/") + 1);

        const init = { credentials: "omit" };

        if (config.files_integrity.hasOwnProperty(fileName)) {
            init.integrity = config.files_integrity[fileName];
        }

        return init;
    },

    fetchFile: function (asset) {

        if (asset.lastIndexOf(".dll") !== -1) {
            asset = asset.replace(".dll", `.${config.assemblyFileExtension}`);
        }
        
        if (!config.enable_debugging) {
            // Assembly fetch streaming is disabled during debug, it seems to
            // interfere with the ability for mono or the chrome debugger to 
            // initialize the debugging session properly. Streaming in debug is
            // not particularly interesting, so we can skip it.

            const assemblyName = asset.substring(asset.lastIndexOf("/") + 1);
            if (config.assemblies_with_size.hasOwnProperty(assemblyName)) {
                return this
                    .fetchWithProgress(asset, (loaded, adding) => this.reportAssemblyLoading(adding));
            }
        }
        else {
            return fetch(asset);
        }
    },

    initializeRequire: function () {
        if (config.enable_debugging) console.log("Done loading the BCL");
        App.mainInit(); 
    },

    hasDebuggingEnabled: function () {
        return hasReferencedPdbs && App.currentBrowserIsChrome;
    },

    attachDebuggerHotkey: function (loadAssemblyUrls) {

        //
        // Imported from https://github.com/aspnet/Blazor/tree/release/0.7.0
        //
        // History:
        //  2019-01-14: Adjustments to make the debugger helper compatible with Uno.Bootstrap.
        //

        App.currentBrowserIsChrome = window.chrome
            && navigator.userAgent.indexOf("Edge") < 0; // Edge pretends to be Chrome

        hasReferencedPdbs = loadAssemblyUrls
            .some(function (url) { return /\.pdb$/.test(url); });

        // Use the combination shift+alt+D because it isn't used by the major browsers
        // for anything else by default
        const altKeyName = navigator.platform.match(/^Mac/i) ? "Cmd" : "Alt";

        if (App.hasDebuggingEnabled()) {
            console.info(`Debugging hotkey: Shift+${altKeyName}+D (when application has focus)`);
        }

        // Even if debugging isn't enabled, we register the hotkey so we can report why it's not enabled
        document.addEventListener("keydown", function (evt) {
            if (evt.shiftKey && (evt.metaKey || evt.altKey) && evt.code === "KeyD") {
                if (!hasReferencedPdbs) {
                    console.error("Cannot start debugging, because the application was not compiled with debugging enabled.");
                }
                else if (!App.currentBrowserIsChrome) {
                    console.error("Currently, only Chrome is supported for debugging.");
                }
                else {
                    App.launchDebugger();
                }
            }
        });
    },

    launchDebugger: function () {

        //
        // Imported from https://github.com/aspnet/Blazor/tree/release/0.7.0
        //
        // History:
        //  2019-01-14: Adjustments to make the debugger helper compatible with Uno.Bootstrap.
        //

        // The noopener flag is essential, because otherwise Chrome tracks the association with the
        // parent tab, and then when the parent tab pauses in the debugger, the child tab does so
        // too (even if it's since navigated to a different page). This means that the debugger
        // itself freezes, and not just the page being debugged.
        //
        // We have to construct a link element and simulate a click on it, because the more obvious
        // window.open(..., 'noopener') always opens a new window instead of a new tab.
        const link = document.createElement("a");
        link.href = `_framework/debug?url=${encodeURIComponent(location.href)}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
    }
};

//todo add something to preinit - log wasm for dotvvm is loading
document.addEventListener("DOMContentLoaded", () => App.preInit());

