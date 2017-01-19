
const routeMessages = true;
const routeContacts = true;

require('dotenv').config();

const http = require('http');
const https = require('https');
const chalk = require('chalk');
const async = require('async');
const _ = require('lodash');
const util = require('util');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const express = require('express');
const auth = require('./auth');
const sendmail = require('./smtp');
const jsonParser = require('body-parser').json();

const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const ObjectID = mongodb.ObjectID;

var db;

var app = express();
app.set('json spaces', 2);
app.disable('etag');

var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 8080;

server.listen(port, function() {
	//	?
});

io.on('connection', (socket) => {
	console.log(`> Client connected`);
	
		
});

MongoClient.connect(process.env.MONGODB_URI, (err, database) => {
	if (err) {
		console.log(err);
		process.exit(1);
	}

	// Save database object from the callback for reuse.
	app.locals.db = db = database;
	console.log("> Ready");

	app.use(/^\/(inbox|sent|conversation|contacts|main|outgoing).*$/, auth);
	
	app.use(express.static('public'));
	
	/* /// INBOX REQUESTS /// */
	if(routeMessages) {
		app.get('/', (req, res) => {
			console.log('> Redirecting...');
			
			res.redirect(301, '/main');
		});
		
		app.get('/main', (req, res) => {
			console.log('> Reading main.html...');
			fs.readFile('main.html', (err, data) => {
				if(err)
					return res.status(500).send(err);
				
				console.log('> Sending to client...');
				res.set('Content-Type', 'text/html');
				res.send(data);
			});
		});

		//	Get all messages
		app.get('/inbox',  (req, res) => {
			console.log('/inbox');
			db.collection('messages')
				.find({type: {$ne: "outboundText"} })
				.map(mapMsg)
				.sort({timestamp: -1})
				.toArray((err, items) => {
					if (err)
						return res.status(500).json(err);
					
					return res.json(items);
				}
			);
		});

		app.get('/inbox/from', (req, res) => {
			console.log('/inbox/from');
			db.collection('messages').find({type: {$ne: "outboundText"}}).sort({timestamp: -1}).toArray(function(err, items) {
				if(err)
					return res.status(500).json(err);
					
				var senderList = [];
				for(var i=0; i<items.length; i++)
					if(!_.includes(senderList, items[i].contact))
						senderList.push(items[i].contact);
				
				async.map(senderList, function(sender, callback) {
					db.collection('contacts').findOne({number: sender}, (err, contactEntry) => {
						if(contactEntry)
							return callback(null, {number: sender, name: contactEntry.fullName});
						
						return callback(null, {number: sender, name: sender});
					});
				}, function(err, results) {						
					return res.status(200).json(results);
				});
			});
		});
		
		//	Get all messages from :number
		app.get('/inbox/from/:number',  (req, res) => {
			console.log('/inbox/from/:number');
			db.collection('messages')
				.find({sender: req.params.number})
				.map(mapMsg)
				.sort({timestamp: -1})
				.toArray( (err, items) => {
					if (err)
						return res.status(500).json(err);

					return res.status(200).json(items);
				}
			);
		});
				
		app.get('/conversation', (req, res) => {
			console.log('/conversation');
			
			db.collection('messages')
				.find({})
				.sort({timestamp: -1})
//				.distinct('contact')
				.toArray((err, messageList) => {
					if(err)
						return res.status(404).json(err);
					
					var contactList = _.uniq(_.map(messageList, 'contact'));
					
					async.series(contactList.map(n => lookupContactName.bind(undefined, n)), (err, results) => {
						if(err)
							return res.status(500).json(err);
						
						return res.json(results);
					});
					
					function lookupContactName(_number, callback) {
						db.collection('contacts').findOne({number: _number}, (err, c) => {
							return callback(null, {number: _number, name: c?c.name:_number});
						});
					}
			});
		});
				
		app.get('/conversation/:number', (req, res) => {
			console.log('/conversation/:number');
			var theirNumber = req.params.number;
			
			db.collection('messages')
				.find({contact: theirNumber})
				.sort({timestamp: 1})
				.map(mapMsg)
				.toArray((err, messageList) => {
					if(err)
						return res.status(404).json(err);
					
					res.json(messageList);
			});
		});
		
		app.get('/all', (req, res) => {
			console.log('/all');
			
			db.collection('messages').find({}).toArray((err1, allMessages) => {
					
				res.json(allMessages);
			});
			
		});

		//	Get specific message by :msgID
		app.get('/msg/:msgID',  (req, res) => {
			db.collection('messages')
				.findOne({_id: new mongodb.ObjectID(req.params.msgID)},
				(err, msg) => {
					if(err)
						return res.status(500).json(err);

					if(!msg)
						return res.status(404).json(new Error(`Message ID [${req.params.msgID}] not found`));

					res.status(200).json(mapMsg(msg));
				}
			);
		});

		//	Delete message :msgID
		app.delete('/msg/:msgID', (req, res) => {
			db.collection('messages')
				.deleteOne({_id: new mongodb.ObjectID(req.params.msgID)},
				(err, r) => {
					if(err) return res.status(500).json(err);

					if(r.deletedCount !== 1)
						return res.status(404).json(new Error(`Message ID [${req.params.msgID}] not found`));

					return res.status(204).json(r);
			});
		});

		//	Set message :msgID status to 'read'
		app.put('/msg/:msgID',  (req, res) => {
			db.collection('messages')
				.updateOne(
					{_id	: new mongodb.ObjectID(req.params.msgID)},	//	filter object
					{$set	: { readFlag: true, newFlag: false }},
					{upsert	: false},
					(err, result) => {
						if(err)
							return res.status(500).json(err);

						res.status(202).json(result);
					}
				);
		});
		

		app.post('/outgoing', [jsonParser, formatOutgoingMessageJSON], (req, res) => {
			var host = process.env.BURNER_HOST;
			var burnerID = process.env.BURNER_ID;
			var token = process.env.BURNER_TOKEN
			var urlPath = `/webhooks/burner/${burnerID}?token=${token}`;
			var fullURL = `https://${server}${urlPath}`;
			
			var reqOptions = {
				host: host,
				path: urlPath,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': +req.outgoing.length
				}
			};
			
			var postReq = https.request(reqOptions, (resFromBurner) => {
				console.log(`> Outgoing message: ${resFromBurner.statusCode}`);
				resFromBurner.setEncoding('utf8');
				var chunky = '';
				
				resFromBurner.on('data', (chunk) => {
					chunky += chunk; 
				});
				
				resFromBurner.on('end', () => {
					var sendSuccess = JSON.parse(chunky).success;
					var sendSuccessString = sendSuccess ? chalk.green('Success') : chalk.red('FAILURE');
					console.log(`> Send successful: ${sendSuccessString}`);
					
					var headerFields = Object.keys(resFromBurner.headers);
					for (i=0; i<headerFields.length; i++)
						res.set(headerFields[i], resFromBurner.headers[headerFields[i]]);
					
					db.collection('messages').insertOne(req.msgDocument, (err, r) => {
						if(err) {
							console.log(`> !! Error inserting outgoing record: ${err}`);
							return res.status(500).json({error: err});
						}
						
						// lookup the newly inserted sent text record and send to client for insertion into UX:
						db.collection('messages').findOne({_id: ObjectID(r.insertedId)}, (err, textRecord) => {
							if(err) {
								console.log(`> !! Unable to retrieve inserted record: ${err}`);
								return res.status(500).json({error: err, status: `Unable to retrieve inserted record`});
							}
							
							res.status(201).json(mapMsg(textRecord));
						});					
					});					
				});
				
			});
			postReq.on('error', (e) => {
			  console.log(`> !! Problem with request: ${e.message}`);
			});
			
			postReq.write(req.outgoing);
			postReq.end();
		});
		

		//	Incoming text webhook (used by Burner)
		app.post('/incoming', [jsonParser, formatIncomingMessageJSON], (req, res) => {
			
			db.collection('messages').insertOne(req.incoming, (err, r) => {
				if (err) 
					return res.status(500).json(err);
			
				var ip = req.connection.remoteAddress;
				var len = req.get('Content-Length');
				
				console.log(`> Incoming message via [${ip}]: ${len} bytes.`);
				
				io.emit('incoming', mapMsg(req.incoming));
				
				return res.status(201).json(r);
			});
		});

		function mapMsg(m) {
			if(m.type === 'outboundText') {
				m.msgUrl = `/sent/msg/${m._id}`;
				m.toUrl = `/sent/to/${m.toNumber}`;
			}
			else {
				m.msgUrl = `/inbox/msg/${m._id}`;
				m.fromUrl = `/inbox/from/${m.sender}`;
			}
//			if(m.text)
//				m.data = m.text;
			
			m.dateTime = getFormattedDateTime(m.timestamp);
			
			return m;
		}
	}
	

	/* /// CONTACTS REQUESTS /// */
	if(routeContacts) {
		//	Create new contact entry:
		app.post('/contacts',  [jsonParser, formatContactInfoJSON], (req, res) => {
			try {
				db.collection('contacts').insertOne(req.json, (err, r) => {
					if(err)
						return res.status(400).json(err);

					return res.status(201).json(r);
				});
			}
			catch (err) {
				return res.status(500).json(err);
			}
		});

		//	List all contacts information:
		app.get('/contacts',  (req, res) => {
			db.collection('contacts')
				.find({})
				.map(mapContact)
				.sort({'number': 1})
				.toArray((err, contactList) => {
					if(err)
						return res.status(500).json(err);

					res.status(200).json(contactList);
				});
		});

		//	Update existing contact entry:
		app.put('/contacts/:number',  jsonParser, (req, res) => {
			if (!req.body)
				return res.status(415).json(new Error('Invalid JSON request body'));

			try {
				var upBlob = {};
				var gotIssues = [];

				if(req.body.name)
					if(/^\w+$/.test(req.body.name))
						upBlob.name = req.body.name;
					else
						gotIssues.push(`Invalid value for field [name]: '${req.body.name}' (must contain only A-Z, 0-9, and _ characters)`);

				if(req.body.fullName)
					upBlob.fullName = req.body.fullName;

				if(req.body.number)		// this should probably be a seperate HTTP method (PATCH?) but fuckit
					if(/^\d+$/.test(req.body.number))
						upBlob.number = req.body.number;
					else
						gotIssues.push(`Invalid value for field [number]: '${req.body.number}' (must contain only digits 0-9)`);

				if(typeof req.body.blocked === 'boolean')
					upBlob.blocked = req.body.blocked;

				if(gotIssues.length)
					res.status(400).json({errorList: gotIssues});
				else
					if(Object.keys(upBlob).length > 0)
						db
							.collection('contacts')
							.updateOne(
								{number	: req.params.number},	//	filter object
								{$set	: upBlob},				//	update object
								{upsert	: false},				//	error if doesn't exist
								(err, r) => {
									if(err)
										return res.status(418).json(err);

									return res.status(204).location(`/contacts/number/${req.params.number}`).end();
								}
							);
					else
						res.status(418).json({error: 'No valid data fields found in request'});
			}
			catch (err) {
				return res.status(500).json(err);
			}
		});

		//	Retrieve contact entry
		app.get('/contacts/:number',  (req, res) => {
			var number = req.params.number;
			db.collection('contacts').findOne({number: number}, (err, contact) => {
				if(err || !contact)
					return res.status(404).json({result: number});

				res.status(200).json({result: contact.name});
			});
		});

		//	Delete contact
		app.delete('/contacts/:contact',  (req, res) => {
			var searchField = /^\d+$/.test(req.params.contact) ? 'number' : 'name';
			var searchObj = {};
			searchObj[searchField] = req.params.contact;
			db.collection('contacts').deleteOne(searchObj, (err, r) => {
				if(err) return res.status(500).json(err);
				res.status(204).json(r);
			});
		});

		function mapContact(c) {
			c.url = `/contacts/${c.number}`;
			c.senderListUrl = `/inbox/from/${c.number}`;
			return c;
		}
	}

	
	// Initialize the app.
//	server = app.listen(port, '0.0.0.0', function () {
//		var address = server.address();
//		
//		var port = server.address().port;
//		console.log(`> App listening on port [${port}]`);
//	});
});


function formatIncomingMessageJSON(req, res, next) {
	if (!req.body)
		return res.status(415).json(new Error('Invalid JSON request body'));

	var jsonTxt = req.body
	var timestamp = Date.now();
	
	var returnBlob = {
		contact		: jsonTxt.fromNumber.replace(/\D/g,''),
		type		: jsonTxt.type,
		data		: jsonTxt.payload,
		timestamp	: timestamp,
		readFlag	: false,
		newFlag		: true,
		externalSrc	: jsonTxt.type !== 'inboundText'
	};

	switch (jsonTxt.type) {
		case "voiceMail":
		case "inboundMedia":
		case "inboundText":
			req.incoming = returnBlob;
			next();
			break;

		default:
			var err = new Error(`Invalid message type [${jsonTxt.type}]`);
			console.log('> !! Error receiving text:');
			console.log(`   ${util.inspect(err)}`);
			return res.status(400).json(err);
	}
}


function formatOutgoingMessageJSON(req, res, next) {
	if(!req.body)
		return res.status(415).json({error: "Missing JSON request data"});
	
	var msg = req.body;
	
	if(!(msg.contact || msg.message))
		return res.status(415).json({error: "Invalid JSON request data"});
	
	req.outgoing = JSON.stringify({
		intent: 'message',
		data:	{
			toNumber:	msg.contact,
			text:		msg.message
		}
	});
	
	req.msgDocument = {
		contact		: msg.contact,
		data		: msg.message,
		type		: 'outboundText',
		timestamp	: Date.now(),
		sentFlag	: false,
	}
	next();
}

function formatContactInfoJSON(req, res, next) {
	if (!req.body)
		return res.status(415).json(new Error('Invalid JSON request body'));

	try {
		var jsonData = {
			number:		req.body.number.replace(/\D/g, ''),
			name:   	req.body.name.replace(/\W/g, ''),
			fullName: 	req.body.fullName || req.body.name
		};
		req.json = jsonData;

		next();
	}
	catch (err) {
		return res.status(400).json(err);
	}
}

function getShortDateTime(tstamp) {
	return moment(tstamp).tz("America/Winnipeg").format("YYYY.MM.DD_HH:mm:ss");
}

function getFormattedDateTime(tstamp) {
	return moment(tstamp).tz("America/Winnipeg").format("ddd, MMM Do YYYY - hh:mm:ss A");
}



if(false) {
//
//		function fireNewMsgEmail(_sender, _msg) {
//			sparky.transmissions.send({
//					transmissionBody: {
//					content: {
//						from: 'testing@' + process.env.SPARKPOST_SANDBOX_DOMAIN,
//						  subject: 'DEBUG',
//						  html: `<html><body><p>I/O Event: ${encodeSenderNumberAsHex(_sender)} items in queue!</p>
//						  <p><span style="color: F0F0F0; font-size: 0.7em">${_msg}</span></p>
//						  </body></html>`
//						},
//						recipients: [
//						  {address: 'broginator@gmail.com'}
//						]
//					  }
//					}, function(err, res) {
//					  if (err) {
//						console.log('Whoops! Something went wrong');
//						console.log(err);
//					  } else {
//						console.log('Email sent!');
//					  }
//					});
//			
//			function encodeSenderNumberAsHex(_number) {
//				var randomPrefix = (Math.random() * Number.MAX_SAFE_INTEGER) & 0xFFFF;
//				var senderSuffix = _number.replace(/^.*?(\d{4})$/, "$1");
//				return `0x${randomPrefix}${senderSuffix}`;
//			}
//		}
}