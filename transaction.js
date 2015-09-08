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
	  	dbase: Object, //mongoose_model
	  	act: String, //update, delete, insert
	  	data: Object, //data khusus insert, update
	  	param: Object,
	  }],
	  undo_tasks : [{
	  	_id: mongoose.Schema.ObjectId,
		dbase: Object, //collections
		act: String,
		data: Object, //khusus delete bernilai null
		ID: mongoose.Schema.ObjectId,
	  }],
	  status: Number,
	  information: String, //informasi apapun, bisa null
	  created_at: Date,
	  updated_at: Date
	});
	var ModelTrans = mongoose.model('transaction_2pc', transaction_2pc);
	
	var trans = {};

	function insertUndoTaskLog(dt, nomor, mongoose_model, act, data, information_id){
		var obj = {};
		obj._id = mongoose.Types.ObjectId();
		obj.dbase = mongoose_model;
		obj.act = act;
		obj.data = data;
		obj.ID = information_id;
		dt.undo_tasks.unshift(obj);
		dt.tasks[nomor].status = statusTaskEnum.SUCCESS;
		dt.save();
	}

	function createInitTransaction(information, param, callback) {
		//@return transaction_id
		//masih init
		var obj_transaction = {};
		obj_transaction._id = new mongoose.Types.ObjectId();
		obj_transaction.tasks = [];
		obj_transaction.undo_tasks = [];
		obj_transaction.status = statusTransEnum.PENDING;
		obj_transaction.information = information;
		obj_transaction.created_at = new Date();
		obj_transaction.updated_at = new Date();
		
		for (var i=0; i<param.length; i++){
			var task = {};
			task.status = statusTaskEnum.INIT;
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

	function LiveRollback(data_trans, callback) {
		//data transaksi setelah transaksi dijalankan
		var logger = [];
		if (data_trans.status == statusTransEnum.CANCELLED) {
			async.forEachSeries(data_trans.undo_tasks, function(e,cb){
				if (e.act == "insert") {
					new e.dbase(e.data).save(function(err, result){
						if (err) logger.push(err);
						else logger.push("Delete rollback -> Inserting");
						cb();
					});
				}
				else if (e.act == "delete") {
					e.dbase.findOneAndRemove({_id: e.ID},function(err,result){
						if (err) logger.push(err);
						else logger.push("Insert rollback -> Deleting "+e.ID);
						cb();
					});
				}
				else if (e.act == "update") {
					e.dbase.findOneAndUpdate({_id: e.ID}, e.data, function(err,result){
						if (err) logger.push(err);
						else logger.push("Update rollback -> Updating");
						cb();
					});
				} else if (e.act == "update_num") {
					e.dbase.findOneAndUpdate({_id: e.ID}, {$inc: e.data}, function(err,result){
						if (err) logger.push(err);
						else logger.push("Update increment rollback -> Updating");
						cb();
					});
				} else {
					logger.push("[ERROR-ROLLBACK] Aksi kok tidak ditemukan");
					cb();
				}
			}, function(){
				data_trans.status = statusTransEnum.ROLLEDBACK;
				data_trans.save();
				callback(logger);
			});
		} else if (data_trans.status == statusTransEnum.INIT){
			callback("INIT-TERUSIN");
		} else {
			callback("SUCCEED or ROLLEDBACK");
		}
	}

	function negateData(obj){
		for (var attr in obj){
			obj[attr] = 0 - obj[attr];
		}
		return obj;
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
							dt.save();
							logger.push(err);
							isError = true;
							cb(new Error(err));
						}
						else {
							logger.push("Sukses dimasukkan: "+result._id);
							insertUndoTaskLog(dt, nomor, e.mongoose_model, "delete", null, result._id);
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
								logger.push("Update berhasil dijalankan"+result);
								insertUndoTaskLog(dt, nomor, e.mongoose_model, "update", result, result._id);
								cb();
							} else {
								dt.tasks[nomor].status = statusTaskEnum.ERROR;
								dt.save();
								isError = true;
								var msg_err = "[ERROR] Tidak ada record yang akan diupdate";
								logger.push(msg_err);
								cb(new Error(msg_err));
							}
							
						}
					});
				} else if (e.act == "update_num") {
					e.mongoose_model.findOneAndUpdate(e.param,{$inc: e.data},function(err,result){
						if (err) {
							logger.push(err);
							isError = true;
							cb(new Error(err));
						} else {
							if (result) {
								logger.push("Update increment berhasil dijalankan"+result);
								insertUndoTaskLog(dt, nomor, e.mongoose_model, "update_num", negateData(e.data), result._id);
								cb();
							} else {
								dt.tasks[nomor].status = statusTaskEnum.ERROR;
								dt.save();
								isError = true;
								var msg_err = "[ERROR] Tidak ada record yang akan diupdate";
								logger.push(msg_err);
								cb(new Error(msg_err));
							}
						}
					});
				}
				else if (e.act == "delete") {
					e.mongoose_model.findOneAndRemove(e.param, function(err,result){
						if (err) {
							logger.push(err);
							isError = true;
							cb(new Error(err));
						}
						else {
							if (result) {
								logger.push("Delete berhasil dijalankan"+result);
								insertUndoTaskLog(dt, nomor, e.mongoose_model, "insert", result, null);
								cb();
							} else {
								isError = true;
								dt.tasks[nomor].status = statusTaskEnum.ERROR;
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

				LiveRollback(dt, function(rollback) {
					var hasil = {};
					hasil.normal = logger;
					hasil.rollback = rollback;
					//console.log("Trans: "+JSON.stringify(dt, null, 2));
					callback(isError, hasil); 
				});
			});
		});
	};

	return trans;
};
