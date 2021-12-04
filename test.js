'use strict';

var net_fn = require('./index.min.js');

function fnTest(number, callback) {
    callback(number * 2);
}

var worker = net_fn.createServer(fnTest, 8021);
var fn = net_fn.connect(fnTest, 8021);
setTimeout(function () {
    fn(10, function (result) {

        console.log("result: " + result);
        //debugger;
    });
}, 100);

var worker1 = net_fn.tryToRunServer([fnTest], 8022);
var fns1 = net_fn.connect([fnTest], 8022);
setTimeout(function () {
    fns1.fnTest(20, function (result) {

        console.log("result: " + result);
        //debugger;
    });
}, 100);

var worker2 = net_fn.tryToRunServer({ fnTest: fnTest }, 8023);
var fns2 = net_fn.connect({ fnTest: fnTest }, 8023);
setTimeout(function () {
    fns2.fnTest(30, function (result) {

        console.log("result: " + result);
        //debugger;
    });
}, 100);