/// <reference path="typings/node/node.d.ts"/>
var fs = require('fs');
var mongoose = require('mongoose');
var ignoreCollections = ['system.indexes', 'admin_users'];
var debug = process.env.DEBUG_DOCUMENT_CREATOR;
var idIdentifier = 'thisIsARandomidString';
var dateIdentifier = 'thisIsARandomDateString';

function writeValues(dir, array) {
  if(!debug) {
    return;
  }
  fs.writeFileSync(dir + '.json', JSON.stringify(array));
}

function createDir(dir, override) {
  if(!debug && !override) {
    return;
  }
  if(!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}


module.exports = CreateDocumentation;


function CreateDocumentation(options) {
  self = this;
  if(typeof options !== 'object') {
    throw new Error('You must define a schema');
  }
  if(typeof options.mongoConnectionURI != 'string') {
    throw new Error('You must define a mongo connection schema.');
  }
  if(!options.documentDir) {
    options.documentDir = require('path').dirname(require.main.filename) + '/documentation';
  }
  createDir(options.documentDir, true);
  this.ignoreLimit = options.ignoreLimit;
  this.limit = options.limit;
  var connection = mongoose.createConnection(options.mongoConnectionURI);
  connection.on('error', function (err) {
    throw new Error(err);
  });
  connection.on('open', function() {
    connection.db.collectionNames(function(err, collections) {
      if(err) {
        throw new Error(err);
      }
      self.collections = {};
      collections.forEach(function(collection, index) {
        if(ignoreCollections.indexOf(collection.name) === -1) {
          self.createSchema(connection.model(collection.name, new mongoose.Schema({})), collection.name, options.documentDir); 
          self.collections[collection.name] = {
            name: collection.name,
            complete: false
          };
        }
      });
    });
  });
}


CreateDocumentation.prototype.finish = function(collectionName) {
  this.collections[collectionName].complete = true;
  console.log(collectionName + ' done');
  for(var key in this.collections) {
    if(!this.collections[key].complete) {
      return;
    }
  }
  console.log('All processed');
};

CreateDocumentation.prototype.createSchema = function (Model, collectionName, documentDir) {
  var self = this;
  var folderStruct = {};
  var dir = documentDir + '/' + collectionName;
  var query = Model.find();
  if(!this.ignoreLimit) {
    var query2 = query.limit(this.limit || 100);
  }
  query.lean().exec(function(err, documents) {
    documents.forEach(function(thisDocument) {
      for(var key in thisDocument) {
        var val = thisDocument[key];
        var isSpecial = false;
        if(isId(val)) {
          isSpecial = true;
          val = idIdentifier;
        }
        if(isDate(val)) {
          isSpecial = true;
          val = dateIdentifier;
        }
        if (!Array.isArray(val) && typeof val == 'object' && !isSpecial) {
          if(!folderStruct[key]) {
            folderStruct[key] = {};
          }
          writeObject(val, folderStruct[key]);
        } else {
          addToFolderStruct(folderStruct, key, val);
        }
      }
    });
    createDir(dir);
    writeFolderOutlineToDir(folderStruct, dir);
    fs.writeFileSync(documentDir + '/'+ collectionName +'.json', JSON.stringify(folderStruct, null, '\t'));
    self.finish(collectionName);
  });
};

function isDate(value) {
  return value instanceof Date;
}

function isId(value) {
  if(value !== null && typeof value == 'object' && value._bsontype === 'ObjectID') {
    return true;
  } else {
    return false;
  }
}

function addToFolderStruct(folderStruct, folder, val) {
  if(!Array.isArray(folderStruct[folder])) {
    folderStruct[folder] = [];
  }
  if(folderStruct[folder].indexOf(val) === -1) {
    folderStruct[folder].push(val); 
  }
}

function writeObject(obj, folder) {
  for (var key in obj) {
    var val = obj[key];
    var isSpecial = false;
    if(isId(val)) {
      isSpecial = true;
      val = idIdentifier;
    }
    if(isDate(val)) {
      isSpecial = true;
      val = dateIdentifier;
    }
    if(typeof val === 'object' && !Array.isArray(val) && !isSpecial) {
      if(!folder[key]) {
        folder[key] = {};
      }
      writeObject(val, folder[key]);
    } else {
      if(!Array.isArray(folder[key])) {
        folder[key] = [];
      }
      if(folder[key].indexOf(val) === -1) {
        folder[key].push(val); 
      }
    }
  }
}

function getType(key, values) {
  var types = {
    String: 0,
    _id: 0,
    Number: 0,
    Array: 0,
    Boolean: 0,
    Date: 0
  };

  values.forEach(function(val) {
    if(val === idIdentifier) {
      types._id++;
    } else if(val === dateIdentifier){
      types.Date++;
    } else if(typeof val === 'number') {
      types.Number++;
    } else if(typeof val === 'string') {
      types.String++;
    } else if(Array.isArray(val)) {
      types.Array++;
    } else if(typeof val === 'boolean'){
      types.Boolean++;
    }
  });
  var topValue = 0;
  var guess = 'String';
  for(var thisType in types) {
    if(types[thisType] > topValue) {
      topValue = types[thisType];
      guess = thisType;
    }
  }
  if(guess === 'Array') {
    guess = deepTypes(values);
  }
  if(typeof guess === 'string') {
    guess = {type: guess, required: false};
  }
  return guess;
}

function deepTypes(value) {
    while(Array.isArray(value) && value.length) {
      for(var i = 0; i < value.length; i++) {
        if(value[i].length) {
          value = value[i];
          break;
        }
      }
      value = value[0];
    }
    var guess;
    if(isId(value)) { 
      guess = [{type: '_id', required: false}];
    } else if(isDate(value)) {
      guess = [{type: 'Date', required: false}];
    } else if(typeof value === 'string') {
      guess = [{type: 'String', required: false}];
    } else if(typeof value === 'number') {
      guess = [{type: 'Number', required: false}];
    } else if(Array.isArray(value)) {
      guess = 'Array[Array]';
    } else if (typeof value === 'object') {
      guess = {
        
      };
      for(var key in value) {
        guess[key] = deepTypes(value[key])[0];
      }
      guess = [guess];
    } else if(typeof value === 'boolean'){
      guess = [{type: 'Boolean', required: false}];
    } else {
      guess = [{type: 'unknown', required: false}];
    }
    return guess
}

function writeFolderOutlineToDir(folder, dir, fn) {
  for (var key in folder) {
    var newDir = dir + '/' + key;
    if(typeof folder[key] === 'object' && !Array.isArray(folder[key])) {
      createDir(newDir);
      writeFolderOutlineToDir(folder[key], newDir, fn);
    } else {
      //write file
      writeValues(newDir, folder[key]);
      var guess = getType(key, folder[key]);
      folder[key] = guess;
    }
  }
}