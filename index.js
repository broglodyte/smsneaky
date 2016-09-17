
require('dotenv').config();

var fs = require('fs');
var path = require('path');
var moment = require('moment');

var express = require('express');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var app = express();

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

var db;

MongoClient.connect(process.env.DB_URI, function (err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = database;
  console.log("Database connection ready");

  // Initialize the app.
  var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });
});

// var Db = mongodb.Db;
// var Server = mongodb.Server;
// var Connection = mongodb.Connection;

// const DB_HOST = process.env.DB_HOST;
// const DB_PORT = process.env.DB_PORT;
// const DB_NAME = process.env.DB_NAME;
// const DB_USER = process.env.DB_USER;
// const DB_PASS = process.env.DB_PASS;

// var mongoUri = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
// console.log('MongoDB URI: ' + mongoUri);

// var db = new Db(DB_NAME, new Server(DB_HOST, DB_PORT, {}), {
	// native_parser : false
// });

app.set('port', process.env.PORT || 10101);

app.get('/', (req, res) => {
	console.log('redirect...');
	res.redirect(301, '/inbox');
});

app.get('/inbox', function (request, response) {
	db.collection('inbox').find({}).toArray((err, items) => {
		if (err)
			return response.status(500).json({
				error : `Error reading database: ${err}`,
				status : 'failure'
			});

		response.json(items);
	});
});

/* --JSON data formats-- /*

Incoming JSON blobs should be all like:
[for now we only care about 'type', 'payload', 'fromNumber', and 'toNumber']	{
"type" : "inboundText",
"payload" : "You are now reading a text message from [xyz]",
"fromNumber" : "+19185559876",
"toNumber" : "+19182152005",
"burnerId" : "b06553cc-7630-4061-9d75-8e258a741822",
"userId" : "0a3d6fb2-9af9-11e4-a7c4-73252e699852-6a68e080"
}


Storage file should be all like:	{
"+[recipientNumber]": [ {msgBlob1}, {msgBlob2}, {...etc...} ],
"+1234567890": [ {another list of msgBlobs} ]
}

msgBlobs should be like so:	{
"fromNumber" : "[whoever sent the text]",
"payload"    : "[whatever the text said]"
"timestamp"  : "[whatever the date/time of arrival is]",
"dateTime"   : "[formatted date and time, calculated from 'timestamp']"
}

 */

app.post('/incoming', jsonParser, (req, resp) => {
	if (!req.body || !req.body.type)
		return resp.status(400).json({
			error : 'invalid data',
			status : 'failure'
		});

	if (req.body.type === 'inboundText') {
		var msgSender = req.body.fromNumber;
		var msgBlob = getBlobFromJSON(req.body);

		db.collection('inbox').insertOne(msgBlob, (err, r) => {
			if (err || r.insertedCount !== 1)
				return resp.status(500).json({
					error : err || `[insertedCount (${r.insertedCount}) not equal to 1]`,
					status : 'failure'
				});

			return resp.status(201).json({
				status : 'success',
				resultData : r
			});
		});
	} else {
		return resp.status(401).json({
			error : `error: invalid data`,
			status : 'failure'
		});
	}
});

function getBlobFromJSON(jsonTxt) {
	var timestamp = Date.now();
	var fmtDateTime = moment(timestamp).format("ddd, MMM Do YYYY - hh:mm:ss.SSS A [[]Z[]]");
	var returnBlob = {
		fromNumber : jsonTxt.fromNumber,
		payload : jsonTxt.payload,
		timestamp : timestamp,
		dateTime : fmtDateTime
	};
	return returnBlob;
}
