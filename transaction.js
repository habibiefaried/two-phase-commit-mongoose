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
	  tasks: [{
	  	status: Number,
	  	undo_id: mongoose.Schema.ObjectId, //mengacu pada undo_task_log
	  	dbase: Object, //mongoose_model
	  	act: Number, //update, delete, insert
	  	data: Object, //data khusus insert, update
	  	params: Object, //parameter khusus update, delete
	  }],
	  status: Number,
	  information: String, //informasi apapun, bisa null
	  created_at: Date,
	  updated_at: Date
	});

	var ModelTrans = mongoose.model('transaction_2pc', transaction_2pc);

	var undo_task_log = new mongoose.Schema({
		_id: mongoose.Schema.ObjectId,
		dbase: Object, //collections
		act: String,
		data: Object, //khusus delete bernilai null
		params: Object,
		ID: mongoose.Schema.ObjectId,
	});
	var ModelUndo = mongoose.model('undo_task_log', undo_task_log);

	var trans = {};

	function insertUndoTaskLog(mongoose_model, act, data, params, information_id){
		/*
		var obj = {};
		obj._id = mongoose.Types.ObjectId();
		obj.dbase = mongoose_model;
		obj.act = act;
		obj.data = data;
		obj.params = params;
		obj.ID = information_id;
		new ModelUndo(obj).save(); 
		return obj._id;
		*/
	}

	function createInitTransaction(information) {
		//@return transaction_id
		//masih init
		var obj_transaction = {};
		obj_transaction._id = mongoose.Types.ObjectId();
		obj_transaction.tasks = [];
		obj_transaction.status = statusTransEnum.INITIAL;
		obj_transaction.information = information;
		obj_transaction.created_at = new Date();
		obj_transaction.updated_at = new Date();
		new ModelTrans(obj_transaction).save();
		return obj_transaction._id;
	}

	function addTransactionTask(mongoose_model, act, data, information_id, status, transaction_id, undo_id, callback){
		var trans_task = {};
		trans_task.status = status;
		trans_task.undo_id = undo_id;
		trans_task.dbase = mongoose_model;
		trans_task.act = act;
		trans_task.data = data;
		trans_tas.
	}

	trans.apply = function(param, callback){
		var logger = [];
		var obj_transaction = {};
		var id_transaction = createInitTransaction("No Information");

		async.forEachSeries(param, function(e, cb) {
			if (e.act == "insert") {
				new e.mongoose_model(e.data).save(function(err, result){
					if (err) {
						logger.push(err);
						cb();
					}
					else {
						logger.push("Sukses dimasukkan: "+result._id);
						insertUndoTaskLog(e.mongoose_model, "delete", null, result._id);
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
						insertUndoTaskLog(e.mongoose_model, "update", result, result._id);
						logger.push("Terupdate\n"+result); //previous data before update
						cb();
					}
				});
			} else if (e.act == "delete") {
				e.mongoose_model.findOneAndRemove(e.param, function(err,result){
					if (err) logger.push(err);
					else {
						if (result) {
							insertUndoTaskLog(e.mongoose_model, "insert", result, null);
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
			ModelUndo.find({}, function(err, mm){
				console.log(mm);
				callback(logger);
			});
		});
	};

	return trans;
};