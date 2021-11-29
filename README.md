# net-fn:  a Node.js Inter Process Communication library

[![npm-version](https://badgen.net/npm/v/net-fn)](https://www.npmjs.com/package/net-fn)
[![npm-week-downloads](https://badgen.net/npm/dw/net-fn)](https://www.npmjs.com/package/net-fn)

'Inter-process communication' Allows you to communicate with background processes over the 'net' module.
The callback APIs perform all operations asynchronously, without blocking the event loop, then invoke a callback function upon completion or error.


## Installing

`npm install net-fn`

## Usage example

```js
var net_fn = require("net-fn");
var bg_module = require("your-background-module");
var port = 8021;

var worker = net_fn.tryToRunServer(bg_module, port, "localhost");
var bgModule = net_fn.connect(bg_module, port, "localhost");

// the background module is ready for use
bgModule.fn(arg, function callback(err, result){
    ...
});

```

## License

[MIT](LICENSE)

Copyright (c) 2021 Manuel L&otilde;hmus <manuel@hauss.ee>