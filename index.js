var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser')
var app = express();
var jsonParser = bodyParser.json();
app.set('port', (process.env.PORT || 5000));
var filename = 'texts.txt';
var utf8 = 'utf8';
app.set('filename', filename);
app.use(express.static(__dirname + '/public'));

// views is directory for all template files
// app.set('views', __dirname + '/views');
// app.set('view engine', 'ejs');

app.get('/', function (request, response) {
	fs.readFile(filename, utf8, (err, data) => {
		if(err)
			return response.status(500).json({error: 'Error reading file: ' + err});
		
		try {
			var jsonData = JSON.parse(data);
			fs.writeFile(filename, '{}', utf8, (err) => {
			if(err)
				return response.status(500).json({status: 'Error clearing file: ' + err});
				
			response.json(jsonData);
			});
		}
		catch(err) {
			response.status(500).json({status: 'Unknown error: ' + err});
		}
	});
});

var fileCount = 1;
app.post('/incoming', jsonParser, (req, resp) => {
	if(!req.body) return resp.status(400);
	
	
	fs.writeFile(filename, JSON.stringify(req.body, null, 4), utf8, (err) => {
		if(err)
			return resp.status(500).send('Error writing file: ' + err);
		
		resp.status(201).json({status: 'Success'});
	});
});

app.listen(app.get('port'), function () {
	console.log('Node app is running on port', app.get('port'));
});
