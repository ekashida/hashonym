# hashonym

cp files using the content hash as the filename. Calculates the minimum hash
length required to avoid hash-collisions for files with different content, but
this can be overriden via configuration.


# example

```
var Hashonym = require('hashonym');

var hasher = new Hashonym(outputDirectory, {
    ext: true,      // preserve the file extension of the source file
    minHashLen: 3   // the minimum hash length to use for the file name
});

hasher.add('./some/file.js');
hasher.add(['./some/other/file.js']);

hasher.hashonymize(function (err, map) {
    if (err) {
        return console.error(err);
    }
    console.log(JSON.stringify(map));
});
```

```
{
  './some/file.js': 'a16.js',
  './some/other/file.js': '2hs.js'
}
```


# methods

## hashonym.add(filepath)

Adds a file to the set of files that should be evaluated at a later time.

Adding a new file after a call to `hashonymize()` will require a recalcuation
due to the fact that the minimum hash length may change.

## hashonym.hashonymize(callback);

Copies all added files to the specified directory using the content hash as the
file name.

Returns a mapping of the source files and the hash files.


# install

```
npm install hashonym
```


# license

BSD
