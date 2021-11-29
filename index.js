/**net-fn functions. @preserve Copyright (c) 2021 Manuel Lõhmus.*/
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
            };
        }
    });


    if (net_fns["anonymous"])
        return net_fns["anonymous"];
    else
        return net_fns;
}
exports.connect = connect;

/**
 * @param {any} fns  function or [ fn0, nf1, nf2, ... ] or { fnName: nf, ... }
 * @param {number} port
 * @param {number} hostname Default: "localhost".
 * @returns {net.Server}
 */
function createServer(fns, port, hostname = "localhost") {

    fns = to_fnsObj(fns);

    return net
        .createServer(function (client) {
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
            client.on("close", function (isErr) {
                console.log(isErr ? "Connection closed with error." : "Connection closed");
            });
        })
        .listen(port, hostname, function () {
            console.log("'net-fn' service", {
                hostname: hostname,
                port: port,
                pid: process.pid
            });
        });
}
exports.createServer = createServer;

function tryToRunServer(fns, port, hostname = "localhost") {

    fns = to_fnsObj(fns);

    var code = '"use strict";var fns = {'
        + Object.keys(fns)
            .reduce(function (output, key) {
                return output + key + ': ' + fns[key] + ',';
            }, "")
        + '};require("./index.min.js").createServer(fns, ' + port + ', "' + hostname + '");';
    //console.log(code);
    return require("try-to-run").try_to_run(code);
}
exports.tryToRunServer = tryToRunServer;