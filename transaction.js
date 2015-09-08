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
	  	act: String, //update, delete, insert, update-num
	  	data: Object, //data khusus insert, update
	  	param: Object,
	  }],
	  undo_tasks : [{
	  	_id: mongoose.Schema.ObjectId,
		dbase: Object, //collections
		act: String, //action update, delete, insert, update-num
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
		//memasukkan undo_task kedalam transaction
		//berguna ketika rollback
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
		//membuat transaksi, mengembalikan instance transaction
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
		//lakukan rollback jika transaksiknya cancel
		var logger = [];
		if (data_trans.status == statusTransEnum.CANCELLED) {
			async.forEachSeries(data_trans.undo_tasks, function(e,cb){
				if (e.act == "insert") {
					new e.dbase(e.data).save(function(err, result){
						if (err) logger.push({info:"[ERROR-INSERT]", data:err});
						else logger.push({info:"Delete rollback -> Inserting",data:result});
						cb();
					});
				}
				else if (e.act == "delete") {
					e.dbase.findOneAndRemove({_id: e.ID},function(err,result){
						if (err) logger.push({info:"[ERROR-DELETE]", data:err});
						else logger.push({info:"Insert rollback -> Deleting",data:result});
						cb();
					});
				}
				else if (e.act == "update") {
					e.dbase.findOneAndUpdate({_id: e.ID}, e.data, function(err,result){
						if (err) logger.push({info:"[ERROR-UPDATE]", data:err});
						else logger.push({info:"Update rollback -> Updating",data:result});
						cb();
					});
				} else if (e.act == "update_num") {
					e.dbase.findOneAndUpdate({_id: e.ID}, {$inc: e.data}, function(err,result){
						if (err) logger.push({info:"[ERROR-UPDATENUM]", data:err});
						else logger.push({info:"Update increment rollback -> Updating",data:result});
						cb();
					});
				} else {
					logger.push({info:"[ERROR-ROLLBACK] Aksi kok tidak ditemukan", data:null});
					cb();
				}
			}, function(){
				data_trans.status = statusTransEnum.ROLLEDBACK;
				data_trans.save();
				logger.push({info:"ROLLEDBACK",data:null});
				callback(logger);
			});
		}
		else if (data_trans.status == statusTransEnum.INIT) {
			logger.push({info:"INIT-TERUSIN",data:null});
			callback(logger);
		}
		else if (data_trans.status == statusTransEnum.DONE) {
			logger.push({info:"SUCCESS",data:null});
			callback(logger);
		}
		else if (data_trans.status = statusTransEnum.ROLLEDBACK) {
			logger.push({info:"ROLLEDBACK",data:null});
			callback(logger);
		}
		else {
			logger.push({info:"STATUS NOT FOUND",data:null});
			callback(logger);
		}
	}

	function negateData(obj){
		//melakukan negasi dari increment yang sudah dilakukan
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
							logger.push({info:"[ERROR-INSERT]",data:err});
							isError = true;
							cb(new Error(err));
						}
						else {
							logger.push({info:"[SUCCESS-INSERT]",data:result});
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
								logger.push({info:"[SUCCESS-UPDATE]",data:result});
								insertUndoTaskLog(dt, nomor, e.mongoose_model, "update", result, result._id);
								cb();
							} else {
								dt.tasks[nomor].status = statusTaskEnum.ERROR;
								dt.save();
								isError = true;
								var msg_err = "[ERROR-UPDATE]";
								logger.push({info:msg_err,data:null});
								cb(new Error(msg_err));
							}
							
						}
					});
				} else if (e.act == "update_num") {
					e.mongoose_model.findOneAndUpdate(e.param,{$inc: e.data},function(err,result){
						if (err) {
							logger.push({info:"[ERROR-UPDATENUM]",data:err});
							isError = true;
							cb(new Error(err));
						} else {
							if (result) {
								logger.push({info:"[SUCCESS-UPDATENUM]",data:result});
								insertUndoTaskLog(dt, nomor, e.mongoose_model, "update_num", negateData(e.data), result._id);
								cb();
							} else {
								dt.tasks[nomor].status = statusTaskEnum.ERROR;
								dt.save();
								isError = true;
								var msg_err = "[ERROR-UPDATENUM]";
								logger.push({info:msg_err,data:null});
								cb(new Error(msg_err));
							}
						}
					});
				}
				else if (e.act == "delete") {
					e.mongoose_model.findOneAndRemove(e.param, function(err,result){
						if (err) {
							logger.push({info:"[ERROR-DELETE]",data:err});
							isError = true;
							cb(new Error(err));
						}
						else {
							if (result) {
								logger.push({info:"[SUCCESS-DELETE]",data:result});
								insertUndoTaskLog(dt, nomor, e.mongoose_model, "insert", result, null);
								cb();
							} else {
								isError = true;
								dt.tasks[nomor].status = statusTaskEnum.ERROR;
								dt.save();
								var msg_err = "[ERROR-DELETE]";
								logger.push({info:msg_err,data:null});
								cb(new Error(msg_err));
							}
						}
					});
				} else {
					logger.push({info:"Aksi tidak ditemukan",data:null});
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
					callback(isError, hasil); 
				});
			});
		});
	};

	return trans;
};
