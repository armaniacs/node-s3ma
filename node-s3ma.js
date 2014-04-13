var cluster = require('cluster');
var watch = require('node-watch');
var AWS = require('aws-sdk');
var numCPUs = require('os').cpus().length;
var mime = require('mime');
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var SysLogger = require('ain2');
var console = new SysLogger({tag: 'node-s3ma', facility: 'daemon'});

var numReqs = 0;
var worker;
var confFile = process.argv[2] || './conf/config.json';
var config = require(confFile);
AWS.config.loadFromPath(confFile);
var s3 = new AWS.S3();

if (config.mimeConfig) {
    mime.load(config.mimeConfig);
} else {
    mime.load('./conf/config_mime.types');
};


var s3sync = new AWS.S3({endpoint: config.endpointSync});

if (cluster.isMaster) {
    for (var i = 0; i < numCPUs; i++) {
	worker = cluster.fork();

	watch(config.watchDir, function(filename) {

	    if (path.basename(filename).charAt(0) == ".") {
		console.info("101\tSKIP hidden file: " + filename);
	    } else {
		worker.send({chat: filename+' is changed.', watchfile: filename});
	    }
	});
    }
} else {
    process.on('message', function(msg) {
	if (msg.watchfile) {
	    mtimeFile(msg.watchfile);
	};
    });
}

function mtimeFile(filename) {
    fs.stat(filename, function(err, stats) {
	if (err) {
	    console.error("400\t"+err);
	}
	else {
	    uploadingFile(filename, stats.mtime);
	}
    })
}

function uploadingFile(filename, mtime) {
    fs.readFile(filename, function(err, data) {
	if (err) {
	    if (err.errno == 28){
		console.info("102\tDIR\t"+filename)
		getDirFiles(filename, function(err, files){
		    // foreach XXX
		    files.forEach(function(v){
			mtimeFile(v);
		    })
		})
	    } else {
		console.error("400\t"+err);
	    }
	}
	else {	    
	    if (data.length == 0)
		console.info("103\tZeroByteFile\t"+ filename);
	    else
	    {
		uploading(filename, mtime, data);
	    }
	}
    })
};


function uploading(filename, mtime, data) {
    var filepath;
    if (config.watchDir.indexOf("/") == 0)
	filepath = filename.replace(config.watchDir, "");
    else
	filepath = filename;
    filepath = filepath.replace(/^\//, "");

    var momentMtime = moment.utc(mtime);
    //  Last-Modified: Sun, 06 Apr 2014 22:53:47 GMT
    var metadataMtime = momentMtime.format("ddd, DD MMM YYYY HH:mm:ss [GMT]");

    if (config.mtimeToMetaData){
	var params = {
		Bucket: config.bucket,
		Key: config.topPrefix + filepath,
		Body: data,
		ContentType: mime.lookup(filename),
		Metadata: {
		    mtime: metadataMtime
		},
		StorageClass: config.storageClass
	};
	}
    else
    {
	var params = {
	    Bucket: config.bucket,
	    Key: config.topPrefix + filepath,
	    Body: data,
	    ContentType: mime.lookup(filename),
	    StorageClass: config.storageClass
	}
    };
	

    s3.putObject(params, function(err, data) {
	if (err){
            console.error("401\ts3.putObject\t" + filename + "\t" + err);
	   }
	else {
	    console.log("201\tUPLOADED\t" + config.bucket+'/'+params.Key+ "\tETag\t" + data.ETag);
	    syncfile(filepath);
	}
    });
};

function syncfile(filename){
    var params = {
	Bucket: config.bucketSync,
	Key: config.topPrefixSync + filename,
	CopySource: encodeURIComponent(config.bucket+'/'+config.topPrefix+filename)
    };

    s3sync.copyObject(params, function(err,data){
	if (err)
	    console.error("400\t"+err)
	else {
	    console.log("202\tSYNCED\t" + decodeURIComponent(params.CopySource) + "\tTO\t" + params.Bucket + "/" + params.Key + "\tLastModified\t" + data.LastModified);
	}
    });
    
};

function getDirFiles(path, callback){
    // the callback gets ( err, files) where files is an array of file names
    if( typeof callback !== 'function' ) return
    var
    result = []
    , files = [ path.replace( /\/\s*$/, '' ) ]
    function traverseFiles (){
	if( files.length ) {
	    var name = files.shift()
	    fs.stat(name, function( err, stats){
		if( err ){
		    if( err.errno == 34 ) traverseFiles()
		    // in case there's broken symbolic links or a bad path
		    // skip file instead of sending error
		    else callback(err)
		}
		else if ( stats.isDirectory() ) fs.readdir( name, function( err, files2 ){
		    if( err ) callback(err)
		    else {
			files = files2
			    .map( function( file ){ return name + '/' + file } )
			    .concat( files )
			traverseFiles()
		    }
		})
		else{
		    result.push(name)
		    traverseFiles()
		}
	    })
	}
	else callback( null, result )
    }
    traverseFiles()
}