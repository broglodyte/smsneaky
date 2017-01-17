
const routeMessages = true;
const routeContacts = true;

require('dotenv').config();

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
	
function main(err, db) {
	if (err) {
		console.log(err);
		process.exit(1);
	}
}

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
				.find({type: ""})
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
			db.collection('inbox').find({}).sort({timestamp: -1}).toArray(function(err, items) {
				if(err)
					return res.status(500).json(err);
					
				var senderList = [];
				for(var i=0; i<items.length; i++)
					if(!_.includes(senderList, items[i].sender))
						senderList.push(items[i].sender);
				
				async.map(senderList, function(sender, callback) {
					db.collection('contacts').findOne({number: sender}, (err, contact) => {
						if(contact)
							return callback(null, {number: sender, name: contact.fullName});
						
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
			db.collection('inbox')
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
			var theirNumber = req.params.number;
			
			//	first get msgs from [everybody] to me:
			db.collection('inbox')
				.find({})
				.map((m) => {
					m.contact = m.sender;
					return m;
				})
				.toArray((err, fromSender) => {
//					if(err)
//						return res.status(404).json(err);
					
					//	now get msgs from me to [everybody]
					db.collection('sent')
						.find({})
						.map(function(m) {
							m.contact = m.toNumber;
							return m;
						})
						.toArray((err, fromMe) => {
							if(err)
								return res.status(404).json(err);
							
							//	then put them all together in one array and sort it by timestamp
							var contactList = _.map(_.uniqBy(_.sortBy(_.concat(fromSender, fromMe), 'timestamp'), 'contact'), (m) => {return m.contact});
//							var contactsWithTimestamps = _.map(allMessages, function(msg) {return {contact: msg.contact, timestamp: msg.timestamp}});
//							var justContactNumbers = _.map(allMessages, function(msg) {return msg.contact});
//							console.log(_.join(justTimeStamps, '\n'));
//							console.log('Total entries: '+ justContactNumbers.length);
							
//							justContactNumbers = _.uniq(justContactNumbers);
//							console.log('Unique:        '+ justContactNumbers.length)
//							console.log(_.join(justContactNumbers, '\n'));
							
//							checkTimestamps(contactsWithTimestamps);
							
							//	filter down to list of unique phone numbers
//							var contactList = _.uniqBy(contactsWithTimestamps, 'contact');		//[];
//							for(var i=0; i<contactsWithTimestamps.length; i++) {
//								var ts = contactsWithTimestamps[i].timestamp,
//									cn = contactsWithTimestamps[i].contact,
//									next_ts;
//								
//								if(i<contactsWithTimestamps.length-1) {
//									next_ts = contactsWithTimestamps[i+1].timestamp;
//									if(next_ts < ts)
//										console.log(`ERROR: timestamps not sorted correctly at index [${i}] !`);
//								}								
//								
//								if(!_.includes(contactList, contactsWithTimestamps[i].contact))
//									contactList.push(contactsWithTimestamps[i].contact);
//							}

							var fnList = contactList.map((n) => {return lookupContactName.bind(undefined, n)});		
							async.series(fnList, (err, results) => {
								if(err)
									return res.status(500).json(err);
								
								return res.json(results)
							});
							
//							async.map(contactList, function(contact, callback) {
//								db.collection('contacts').findOne({number: contact}, (err, contactEntry) => {
//									if(contactEntry)
//										return callback(null, {number: contact, name: contactEntry.name});
//									
//									return callback(null, {number: contact});
//								});
//							}, function(err, results) {						
//								return res.status(200).json(_.reverse(results));
//							});
							
							function lookupContactName(_number, callback) {
								db.collection('contacts').findOne({number: _number}, (err, c) => {
//									if(c)
										return callback(null, {number: _number, name: c?c.name:_number});
									
//									return callback(null, {number: _number});
								});
							}
							
//							function checkTimestamps(_list) {
//								for(var i=1;i<_list.length;i++)
//									if(_list[i].timestamp < _list[i-1].timestamp)
//										console.log(`Error: [${_list[i].timestamp}] < [${_list[i-1].timestamp}] !!\nIndex: [${i}]`);
//							}
						}
					);
				}
			);
		});
				
		app.get('/conversation/:number', (req, res) => {
			console.log('/conversation/:number');
			var theirNumber = req.params.number;
			
			//	first get msgs from them to me:
			db.collection('inbox')
				.find({sender: theirNumber})
				.map(mapMsg)
				.toArray((err, fromSender) => {
					if(err)
						return res.status(404).json(err);
					
					console.log(` > From: ${fromSender.length}`);
					
					//	now get msgs from me to them
					db.collection('sent')
						.find({toNumber: theirNumber})
						.map(mapMsg)
						.toArray((err, fromMe) => {
							if(err)
								return res.status(404).json(err);
							
							console.log(` > To:   ${fromMe.length}`);
							
							var allMessages = _.sortBy(_.concat(fromSender, fromMe), 'timestamp');
//							_.reverse(allMessages);
							res.json(allMessages);
						}
					);
				}
			);
		});
		
		app.get('/all', (req, res) => {
			console.log('/all');
			
			db.collection('inbox').find({}).toArray((err1, inbox) => {				
				db.collection('sent').find({}).toArray((err2, sent) => {
					if(err1 || err2)
						return res.status(500).json({inboxError: err1, sentError: err2});
					
					var allMessages = _.concat(inbox, sent);
					var allMessagesSortedByTimestamp = _.sortBy(allMessages, 'timestamp');
					var allMessagesSortedAndNormalized = allMessagesSortedByTimestamp.map((m) => {
						m.dateTime = getShortDateTime(m.timestamp);
						
						if(m.toNumber) 
							m.contact = m.toNumber;
						if(m.sender)
							m.contact = m.sender;
						
						if(m.contact)
							return m;
					});
					var allMessagesSortedAndNormalizedAndFiltered = allMessagesSortedAndNormalized.filter(m => !!m);
					var invalidMessages = allMessagesSortedAndNormalized.length - allMessagesSortedAndNormalizedAndFiltered.length;
					if(invalidMessages)
						console.log(`Invalid messages: [${invalidMessages}]`);
					
					res.json(allMessagesSortedAndNormalizedAndFiltered);
					
				});
				
			});
			
		});

		//	Get specific message by :msgID
		app.get('/inbox/msg/:msgID',  (req, res) => {
			db.collection('inbox')
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
		app.delete('/inbox/msg/:msgID', (req, res) => {
			db.collection('inbox')
				.deleteOne({_id: new mongodb.ObjectID(req.params.msgID)},
				(err, r) => {
					if(err) return res.status(500).json(err);

					if(r.deletedCount !== 1)
						return res.status(404).json(new Error(`Message ID [${req.params.msgID}] not found`));

					return res.status(204).json(r);
			});
		});

		//	Set message :msgID status to 'read'
		app.put('/inbox/msg/:msgID',  (req, res) => {
			db.collection('inbox')
				.updateOne(
					{_id	: new mongodb.ObjectID(req.params.msgID)},	//	filter object
					{$set	: { readFlag: true }},
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
					
					db.collection('messages').insertOne(req.body, (err, r) => {
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
			if(m.text)
				m.data = m.text;
			
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
	var server = app.listen(process.env.PORT || 8080, '0.0.0.0', function () {
		var address = server.address();
		
		var port = server.address().port;
		console.log(`> App listening on port [${port}]`);
	});
});


function formatIncomingMessageJSON(req, res, next) {
	if (!req.body)
		return res.status(415).json(new Error('Invalid JSON request body'));

	var jsonTxt = req.body
	var timestamp = Date.now();
	
	var returnBlob = {
		sender		: jsonTxt.fromNumber.replace(/\D/g,''),
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
	
	var outgoingMsg = {
		intent: 'message',
		data:	{
			toNumber:	msg.contact,
			text:		msg.message
		}
	};
	
	req.outgoing = JSON.stringify(outgoingMsg);
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