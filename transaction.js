"use strict";

module.exports = function(mongoose, async) {
	var statusTransEnum = Object.freeze({
		INITIAL: 0,
		PENDING: 1,
		DONE: 2,
		CANCELLED: 3,
		ROLLEDBACK: 4,
	});

	var statusTaskEnum = Object.freeze({
		INIT: 0,
		SUCCESS: 1,
		ERROR: 2,
		CANCELLED: 3,
	});

	var transaction_2pc = new mongoose.Schema({
	  _id: mongoose.Schema.ObjectId,
	  tasks: String,
	  status: Number,
	  information: String,
	  created_at: Date,
	  updated_at: Date
	});

	var undo_task_log = new mongoose.Schema({
		_id: mongoose.Schema.ObjectId,
		dbase: String, //collections
		act: Number,
		data: String,
	});

	var trans = {};

	trans.apply = function(param, callback){
		async.forEachSeries(param, function(e, cb) {
			//console.log(e);
			
			cb();
		}, function(){
			callback("A");
		});

	};

	return trans;
};