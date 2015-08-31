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
		var logger = [];
		async.forEachSeries(param, function(e, cb) {
			if (e.act == "insert") {
				new e.mongoose_model(e.data).save(function(err, result){
					if (err) {
						logger.push(err);
						cb();
					}
					else {
						logger.push("Sukses dimasukkan: "+result._id);
						cb();
					}	
				});
				//cb();
			} else if (e.act == "update") {
				e.mongoose_model.findOneAndUpdate(e.param,e.data,function(err,result){
					if (err) {
						logger.push(err);
						cb();
					}
					else {
						logger.push("Terupdate\n"+result) //previous data before update
						cb();
					}
				});
			} else if (e.act == "delete") {
				e.mongoose_model.findOneAndRemove(e.param, function(err,result){
					if (err) logger.push(err);
					else {
						if (result) {
							logger.push("Terhapus\n"+result); //ambil data yang terhapus
							
						} else logger.push("[ERROR] Tidak ada record yang akan dihapus");
					}
					cb();
				});
			} else {
				logger.push("Aksi tidak ditemukan");
				cb();
			}
		}, function(){
			callback(logger);
		});
	};

	return trans;
};