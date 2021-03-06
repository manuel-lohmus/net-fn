/**net-fn functions. @preserve Copyright (c) 2021 Manuel L?hmus.*/
"use strict";

var net = require("net");
var callbacks = {}, count = 1;

function argArrMap(argArr) {

    return argArr.map(function (arg) {

        if (typeof arg === "function") {

            var k = "fn" + count++;
            callbacks[k] = arg;

            return k;
        }

        else { return arg; }
    });
}

/**
 * @param {any} fns
 * @returns {{}} { fnName: nf, ... }
 */
function to_fnsObj(fns) {

    var fnsObj = fns;

    if (typeof fns === "function") {

        fnsObj = {};
        fnsObj["anonymous"] = fns;
    }
    else if (Array.isArray(fns)) {

        fnsObj = fns.reduce(function (obj, fn) {
            if (typeof fn === "function")
                obj[fn.name] = fn;
            return obj;
        }, {});
    }

    return fnsObj;
}

/**
 * @param {any} fns function or [ fn0, nf1, nf2, ... ] or { fnName: nf, ... }
 * @param {number} port
 * @param {number} hostname Default: "localhost".
 * @returns {any} Methods interface.
 */
function connect(fns, port, hostname = "localhost") {

    var net_fns = {};
    fns = to_fnsObj(fns);


    Object.keys(fns).forEach(function (key) {

        if (typeof fns[key] === "function") {

            net_fns[key] = function () {

                var argArr = Array.from(arguments);
                var client = net.connect(
                    { port: port, host: hostname },
                    function () {

                        client.on("data", function (msg) {

                            var msgObj = JSON.parse(msg);

                            if (msgObj.result) {
                                client.end();
                                return msgObj.result;
                            }

                            if (Array.isArray(msgObj.argArr)) {

                                msgObj.argArr.forEach(function (arg) {

                                    if (typeof callbacks[arg[0]] === "function") {

                                        arg[1] = arg[1].map(function (a) {

                                            if (typeof a === "string" && a.startsWith("fn")) {

                                                return function () {

                                                    var args = argArrMap(Array.from(arguments));
                                                    client.write(JSON.stringify({ key: a, argArr: args }));
                                                };
                                            }

                                            else { return a; }
                                        });

                                        callbacks[arg[0]].apply(null, arg[1]);

                                        delete callbacks[arg[0]];
                                    }
                                });
                            }
                        });

                        argArr = argArrMap(argArr);
                        client.write(JSON.stringify({ key: key, argArr: argArr }));

                        if (!Object.keys(callbacks).length) { client.end(); }
                    }
                );
                client.on("error", function (err) { console.error("fn_connect:", err); });
            };
        }
    });


    if (net_fns["anonymous"])
        return net_fns["anonymous"];
    else
        return net_fns;
}
exports.connect = connect;

function isPortFree(port, callback, hostname = "localhost") {

    var client = net.connect({ port: port, host: hostname });
    client.on("error", function () { client.end(); if (typeof callback === "function") { callback(true); } });
    client.on("ready", function () { client.end(); if (typeof callback === "function") { callback(false); } });
    client.on("timeout", function () { client.end(); if (typeof callback === "function") { callback(false); } });
}
exports.isPortFree = isPortFree;

/**
 * @param {any} fns  function or [ fn0, nf1, nf2, ... ] or { fnName: nf, ... }
 * @param {number} port
 * @param {number} hostname Default: "localhost".
 * @returns {net.Server}
 */
function createServer(fns, port, callback, hostname = "localhost") {

    fns = to_fnsObj(fns);

    isPortFree(port, function (isPortFree) {

        //console.log("isPortFree: ", isPortFree);

        if (isPortFree) {

            var server = net.createServer(function (client) {
                client.on("data", function (msg) {

                    var isCallback = false;
                    var msgObj = JSON.parse(msg);
                    var fn = fns[msgObj.key];

                    if (!fn) {

                        fn = callbacks[msgObj.key];
                        if (fn) { delete callbacks[msgObj.key]; }
                    }

                    if (typeof fn === "function") {

                        msgObj.argArr = msgObj.argArr.map(function (arg) {

                            if (typeof arg === "string" && arg.startsWith("fn")) {

                                isCallback = true;

                                return function () {

                                    var argArr = Array.from(arguments);
                                    argArr = argArrMap(argArr, callbacks);
                                    client.write(JSON.stringify({ argArr: [[arg, argArr]] }));
                                };
                            }

                            else { return arg; }
                        });

                        var result = fn.apply(null, msgObj.argArr);
                        if (result) { client.write(JSON.stringify({ result: result })); }
                        else if (!isCallback) { client.end(); }
                    }

                    else { throw new Error("The '" + msgObj.key + "' is undefined."); }
                });
                //client.on("close", function (isErr) {
                //    console.log(isErr ? "Connection closed with error." : "Connection closed");
                //});
            })
                .listen(port, hostname, function () {
                    console.log("'net-fn' service:", {
                        hostname: hostname,
                        port: port,
                        file: process.argv[1],
                        pid: process.pid
                    });
                })
            server.on("error", function (err) { console.error("fn_server", err); });

            if (typeof callback === "function") { callback(server); }

        }
    }, hostname);
}
exports.createServer = createServer;

var try_to_run = require("try-to-run");

function tryToRunServer(fns, port, callback, hostname = "localhost") {

    isPortFree(port, function (isPortFree) {

        //console.log("isPortFree: ", isPortFree);

        if (isPortFree) {

            if (typeof fns === "string") {

                if (typeof callback === "function") { callback(try_to_run(fns)); }
            }
            else {

                fns = to_fnsObj(fns);
                var code = '"use strict";var fns = {'
                    + Object.keys(fns)
                        .reduce(function (output, key) {
                            return output + key + ': ' + fns[key] + ',';
                        }, "")
                    + '};'
                    + (require.main.path.endsWith("net-fn") ? 'require("./index.js")' : 'require("net-fn")')
                    + '.createServer(fns, ' + port + ', "' + hostname + '");';
                //console.log(code);

                if (typeof callback === "function") { callback(try_to_run(code)); }
            }
        }
        else {

            //console.log("kill!");
            require("worker_threads").parentPort.postMessage("kill");
        }
    }, hostname);
}
exports.tryToRunServer = tryToRunServer;