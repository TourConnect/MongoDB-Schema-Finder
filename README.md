# MongoDB-Schema-Finder

MongoDB-Schema-Finder is a Node tool that guesses what the schema is for each collection from a mongo connection.

MongoDB-Schema-Finder does this by querying a sample from each Connection from the MongoDB connection and validates the types from the sample, then it writes a json formatted document for each collection.

### Installation



```sh
$ npm install mongodb-schema-finder
```

### How to Use
```js
var CreateDocumentation = require('mongodb-schema-finder');

new CreateDocumentation({
  mongoConnectionURI: 'mongodb://[username:password@]host1[:port1]',
  limit: 100,
  documentDir: '/documentation'
});
```

### Customization

The following options are supported:
- mongoConnectionURI - your MongoDB connection string
- limit - how many documents to sample from each collection
- documentDir - where to place the found schemas. This must be writeable, and only one directory deep.

### Version
0.1.0

License
----

MIT
