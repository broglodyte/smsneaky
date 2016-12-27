//	sneakydb.js

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

var db;


function SneakyDB(api_key) {
	
	
}



var proto = {
	Init: function(callback) {
		MongoClient.connect(process.env.MONGODB_URI, (err, database) => {
		if (err) return callback(err);
		
		db = database;
		
	}

		
	},
	GetMessage(_msgID, callback) {
		
		
	},
	GetMessages(callback) {
		
		
	},
	GetMessagesFrom(_sender, callback) {
		
		
	},
	GetNewMessages(callback) {
		
		
	},
	ReceiveMessage(_msg, callback) {
		
		
	}
	
};

SneakyDB.prototype = Object.create(proto, props);