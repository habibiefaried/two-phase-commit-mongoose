var mongoose = require('mongoose'); mongoose.connect('mongodb://localhost/demo');
var async = require('async');
var randomstring = require('randomstring');
var transaction = require('./transaction.js')(mongoose,async);

var userSchema = new mongoose.Schema({
  _id: mongoose.Schema.ObjectId,
  name: String,
  balance: Number,
});
var User = mongoose.model('User', userSchema);

var query_insert = {
	act: "insert",
	data: {
		_id: mongoose.Types.ObjectId(),
		name: "Habibie",
		balance: "10000",
	},
	mongoose_model: User,
};

var query_update = {
	act: "update",
	param: { //ini parameter and, bukan OR
		name: "lJXOhFTfDM",
	}, //parameter update
	data: {
		balance: "1290021",
	},
	mongoose_model: User,
};

var query_delete = {
	act: "delete",
	param: {
		name: "Habibie",
	}, //parameter delete
	mongoose_model: User,
};

var query_delete2 = {
	act: "delete",
	param: {
		name: "Testing",
	}, //parameter delete
	mongoose_model: User,
};

transaction.apply([query_insert,query_update], function(isError, callback){	
	User.find({}, function(err, users) {
		if (err) throw err;
	  	else console.log("User: "+JSON.stringify(users, null, 2));
	  	console.log("RESP: "+JSON.stringify(callback, null, 2));
		mongoose.connection.db.dropDatabase();
		mongoose.connection.db.close();
	});
});


