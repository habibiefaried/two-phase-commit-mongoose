"use strict";

module.exports = function(mongoose, async) {
	var statusTransEnum = Object.freeze({
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
	  	act: String, //update, delete, insert
	  	data: Object, //data khusus insert, update
	  	param: Object,
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
		ID: mongoose.Schema.ObjectId,
	});
	var ModelUndo = mongoose.model('undo_task_log', undo_task_log);

	var trans = {};

	function insertUndoTaskLog(mongoose_model, act, data, information_id){
		
		var obj = {};
		obj._id = mongoose.Types.ObjectId();
		obj.dbase = mongoose_model;
		obj.act = act;
		obj.data = data;
		obj.ID = information_id;
		new ModelUndo(obj).save(); 
		return obj._id;
		
	}

	function createInitTransaction(information, param, callback) {
		//@return transaction_id
		//masih init
		var obj_transaction = {};
		//obj_transaction._id = mongoose.Types.ObjectId();
		obj_transaction._id = new mongoose.Types.ObjectId();
		obj_transaction.tasks = [];
		obj_transaction.status = statusTransEnum.PENDING;
		obj_transaction.information = information;
		obj_transaction.created_at = new Date();
		obj_transaction.updated_at = new Date();
		
		for (var i=0; i<param.length; i++){
			var task = {};
			task.status = statusTaskEnum.INIT;
			task.undo_id = null;
			task.dbase = param[i].mongoose_model;
			task.act = param[i].act;
			task.data = param[i].data;
			task.param = param[i].param;
			obj_transaction.tasks.push(task);
		} 

		var instance = new ModelTrans(obj_transaction);
		instance.save(function(err){
			if (err) callback(err);
			else callback(null,instance);
		})
	}

	function LiveRollback(data_trans) {
		//data transaksi setelah insert
	}

	trans.apply = function(param, callback){
		var logger = [];
		var obj_transaction = {};
		createInitTransaction("No Information", param, function(err, dt){
			var nomor = -1;
			var isError = false; //awalnya false

			async.forEachSeries(param, function(e, cb) {
				nomor++;
				if (e.act == "insert") {
					new e.mongoose_model(e.data).save(function(err, result){
						if (err) {
							dt.tasks[nomor].status = statusTaskEnum.ERROR;
							dt.tasks[nomor].undo_id = idx;
							dt.save();
							logger.push(err);
							isError = true;
							cb(new Error(err));
						}
						else {
							logger.push("Sukses dimasukkan: "+result._id);
							var idx = insertUndoTaskLog(e.mongoose_model, "delete", null, result._id);
							dt.tasks[nomor].status = statusTaskEnum.SUCCESS;
							dt.tasks[nomor].undo_id = idx;
							dt.save();
							cb();
						}	
					});
				} else if (e.act == "update") {
					e.mongoose_model.findOneAndUpdate(e.param,e.data,function(err,result){
						if (err) {
							logger.push(err);
							isError = true;
							cb(new Error(err));
						}
						else {
							if (result) {
								var idx = insertUndoTaskLog(e.mongoose_model, "update", result, result._id);
								dt.tasks[nomor].status = statusTaskEnum.SUCCESS;
								dt.tasks[nomor].undo_id = idx;
								dt.save();
								cb();
							} else {
								dt.tasks[nomor].status = statusTaskEnum.ERROR;
								dt.tasks[nomor].undo_id = idx;
								dt.save();
								isError = true;
								var msg_err = "[ERROR] Tidak ada record yang akan diupdate";
								logger.push(msg_err);
								cb(new Error(msg_err));
							}
							
						}
					});
				} else if (e.act == "delete") {
					e.mongoose_model.findOneAndRemove(e.param, function(err,result){
						if (err) {
							logger.push(err);
							isError = true;
							cb(new Error(err));
						}
						else {
							if (result) {
								var idx = insertUndoTaskLog(e.mongoose_model, "insert", result, null);
								dt.tasks[nomor].status = statusTaskEnum.SUCCESS;
								dt.tasks[nomor].undo_id = idx;
								dt.save();
								cb();
							} else {
								isError = true;
								dt.tasks[nomor].status = statusTaskEnum.ERROR;
								dt.tasks[nomor].undo_id = idx;
								dt.save();
								var msg_err = "[ERROR] Tidak ada record yang akan dihapus";
								logger.push(msg_err);
								cb(new Error(msg_err));
							}
						}
					});
				} else {
					logger.push("Aksi tidak ditemukan");
					cb();
				}
			}, function(){
				if (isError) dt.status = statusTransEnum.CANCELLED;
				else dt.status = statusTransEnum.DONE;
				dt.save();
				console.log("Trans: "+JSON.stringify(dt, null, 2));

				var hasil = {};
				hasil.normal = logger;

				if (!isError) hasil.rollback = "";
				else {

				}
				
				callback(isError, hasil); 
			});
		});
	};

	return trans;
};
