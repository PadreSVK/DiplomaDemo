var fs = require( 'fs')
var config = require('./tmp/config.js');
fs.writeFileSync('./tmp/config.json', JSON.stringify(config, null, 2), 'utf-8'); 