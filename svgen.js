//svgen.js


const express		= require('express');
const bodyParser	= require('body-parser');
const DOMParser 	= require('xmldom');
// const _			= require('lodash');

var app = express();
app.set('json spaces', 2);
app.disable('etag');

app.use(bodyParser.urlencoded({extended: false}));

app.post('/apps/svgen', (req, res) => {
	var formFields = ['numberOfHoles', 'holeSize', 'holeSpacing', 'marginSize']
	var f = req.body;
	
	var numberOfHoles	= f.numberOfHoles;
	var holeSize		= f.holeSize;
	var holeSpacing		= f.holeSpacing;
	var marginSize		= f.marginSize;
	var totalSideLength	= 2 * marginSize + (numberOfHoles-1) * holeSpacing;
	
	
	
	res.setHeader('Content-Type', 'image/svg+xml');
	
	
	
});

app.listen(1337, function() {
	console.log('Node.js web app server listening on port [1337]')
});